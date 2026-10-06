import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Article from "./models/Article";
import Product, { IProduct } from "./models/Product";
import Order, { ORDER_STATUSES } from "./models/Order";
import UserProfile from "./models/UserProfile";
import { verifyAuth, AuthedRequest } from "./middleware/verifyAuth";
import { actionLimiter } from "./middleware/rateLimiter";
import { requireAdmin } from "./middleware/requireAdmin";
import { defaultProducts } from "./catalog";
import Category from "./models/Category";
import { categorySlug, defaultCategories } from "./categories";
import GalleryImage from "./models/GalleryImage";
import NewsletterSubscriber from "./models/NewsletterSubscriber";
import Seller from "./models/Seller";
import SiteContent from "./models/SiteContent";
import Conversation from "./models/Conversation";
import ProductReview from "./models/ProductReview";
import ProductReaction from "./models/ProductReaction";
import { randomUUID } from "node:crypto";
import { Chapa } from "chapa-nodejs";
const app = express();
const PORT = Number(process.env.PORT || 8000);
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error("MONGO_URI is required");
}
app.set("trust proxy", 1);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const siteContentFields = [
  "brandName", "brandLogoUrl", "announcementText", "homeEyebrow", "homeTitle",
  "homeEmphasis", "homeLead", "homeImageOne", "homeImageTwo", "homeImageThree",
  "aboutTitle", "aboutLead", "aboutStoryHeading",
  "homeRitualEyebrow", "homeRitualTitle", "homeRitualAction",
  "homeFeaturedEyebrow", "homeFeaturedTitle", "homeCategoryEyebrow",
  "homeCategoryTitle", "homeOriginEyebrow", "homeOriginTitle", "homeTrustEyebrow",
  "homeTrustTitle", "homeTrustBody", "homeProcessEyebrow", "homeProcessTitle",
  "homeProcessStepOneTitle", "homeProcessStepOneBody", "homeProcessStepTwoTitle",
  "homeProcessStepTwoBody", "homeProcessStepThreeTitle", "homeProcessStepThreeBody",
  "homeNewsletterEyebrow", "homeNewsletterTitle", "homeNewsletterBody",
  "aboutStoryBody", "aboutCoverageHeading", "aboutCoverageBody",
  "aboutMethodHeading", "aboutMethodBody", "footerTitle", "footerText",
  "contactEmail", "contactOffices", "telegramUsername",
  "shopVideoUrl", "shopVideoTitle", "shopVideoCategory",
] as const;

app.get("/api/site-content", async (_req, res) => {
  const content = await SiteContent.findOne({ key: "main" }).lean();
  res.json(content || new SiteContent().toObject());
});

app.put("/api/admin/site-content", actionLimiter, verifyAuth, requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const update: Record<string, string> = {};
  for (const field of siteContentFields) {
    if (typeof body[field] !== "string") {
      return res.status(400).json({ error: "Complete every site-content field before saving." });
    }
    update[field] = body[field].trim();
  }
  if (
    siteContentFields.some((field) => field !== "brandLogoUrl" && field !== "shopVideoUrl" && !update[field]) ||
    (update.brandLogoUrl !== "" && !isCloudinaryUrl(update.brandLogoUrl)) ||
    ["homeImageOne", "homeImageTwo", "homeImageThree"].some((field) => {
      try {
        return new URL(update[field]).protocol !== "https:";
      } catch {
        return true;
      }
    }) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.contactEmail) ||
    !/^[A-Za-z0-9_]{1,64}$/.test(update.telegramUsername) ||
    (update.shopVideoUrl !== "" && !isAllowedVideoUrl(update.shopVideoUrl))
  ) {
    return res.status(400).json({ error: "Enter valid site content, a Cloudinary logo, contact email, and Telegram username." });
  }
  const limits: Record<(typeof siteContentFields)[number], number> = {
    brandName: 80, brandLogoUrl: 1000, announcementText: 250, homeEyebrow: 120,
    homeTitle: 120, homeEmphasis: 120, homeLead: 500,
    homeImageOne: 1000, homeImageTwo: 1000, homeImageThree: 1000, aboutTitle: 120,
    homeRitualEyebrow: 120, homeRitualTitle: 250, homeRitualAction: 100,
    homeFeaturedEyebrow: 120, homeFeaturedTitle: 150, homeCategoryEyebrow: 120,
    homeCategoryTitle: 150, homeOriginEyebrow: 120, homeOriginTitle: 150,
    homeTrustEyebrow: 120, homeTrustTitle: 200, homeTrustBody: 500,
    homeProcessEyebrow: 120, homeProcessTitle: 150, homeProcessStepOneTitle: 150,
    homeProcessStepOneBody: 500, homeProcessStepTwoTitle: 150, homeProcessStepTwoBody: 500,
    homeProcessStepThreeTitle: 150, homeProcessStepThreeBody: 500,
    homeNewsletterEyebrow: 120, homeNewsletterTitle: 150, homeNewsletterBody: 500,
    aboutLead: 1000, aboutStoryHeading: 120, aboutStoryBody: 2000,
    aboutCoverageHeading: 120, aboutCoverageBody: 2000, aboutMethodHeading: 120,
    aboutMethodBody: 2000, footerTitle: 120, footerText: 500, contactEmail: 254,
    contactOffices: 2000, telegramUsername: 64,
    shopVideoUrl: 1500, shopVideoTitle: 150, shopVideoCategory: 100,
  };
  if (siteContentFields.some((field) => update[field].length > limits[field])) {
    return res.status(400).json({ error: "One or more site-content fields exceed their maximum length." });
  }
  const content = await SiteContent.findOneAndUpdate(
    { key: "main" },
    { ...update, key: "main" },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  res.json(content);
});

const verifyChapaOrder = async (order: InstanceType<typeof Order>) => {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) throw new Error("Chapa payment is not configured.");

  const chapa = new Chapa({ secretKey });
  const result = await chapa.verify({ tx_ref: order.transactionId });
  const transaction = result.data;
  const expectedCurrency = order.currency.toUpperCase();
  const expectedAmount = order.amountPaid ?? (
    expectedCurrency === "USD" ? order.subtotal : order.amountEtb
  );
  const amount = Number(transaction?.amount);
  const valid =
    result.status === "success" &&
    transaction?.status?.toLowerCase() === "success" &&
    transaction.tx_ref === order.transactionId &&
    ["USD", "ETB"].includes(expectedCurrency) &&
    transaction.currency?.toUpperCase() === expectedCurrency &&
    expectedAmount !== undefined &&
    Number.isFinite(amount) &&
    Math.abs(amount - expectedAmount) < 0.01;

  if (!valid) {
    return {
      paid: false,
      paymentStatus: transaction?.status || result.status || "pending",
      amountPaid: expectedAmount,
      currency: expectedCurrency,
    };
  }

  if (order.paymentStatus !== "paid") {
    order.paymentStatus = "paid";
    if (order.status === "pending" || order.status === "under_review" || order.status === "rejected") {
      order.status = "confirmed";
    }
    await order.save();
  }
  return { paid: true, paymentStatus: "paid", amountPaid: expectedAmount, currency: expectedCurrency };
};

const asPublicProduct = <T extends { assets?: unknown }>(product: T, seller?: {
  shopName: string;
  logoUrl: string;
  description: string;
  city: string;
  address: string;
  phoneNumber: string;
}) => {
  const { assets: _privateAssets, ...publicProduct } = product;
  return { ...publicProduct, ...(seller ? { seller } : {}) };
};

const isCloudinaryUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
};

const isAllowedVideoUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (host === "res.cloudinary.com" && url.pathname.includes("/video/upload/")) ||
      host === "youtube.com" || host === "www.youtube.com" ||
      host === "youtu.be" || host === "www.youtube-nocookie.com" ||
      host === "vimeo.com" || host === "www.vimeo.com" ||
      host === "player.vimeo.com" ||
      /\.(mp4|webm|ogg)$/i.test(url.pathname);
  } catch {
    return false;
  }
};

const validateSpecifications = (value: unknown): value is { name: string; value: string }[] =>
  Array.isArray(value) &&
  value.length <= 30 &&
  value.every((item) =>
    item !== null &&
    typeof item === "object" &&
    typeof (item as { name?: unknown }).name === "string" &&
    (item as { name: string }).name.trim().length > 0 &&
    (item as { name: string }).name.trim().length <= 80 &&
    typeof (item as { value?: unknown }).value === "string" &&
    (item as { value: string }).value.trim().length > 0 &&
    (item as { value: string }).value.trim().length <= 250,
  );

const findPublicProduct = async (id: string) => {
  const product = await Product.findOne({ id, active: true }).select("id sellerId sellerListingStatus").lean();
  if (!product) return null;
  if (!product.sellerId) return product;
  if (product.sellerListingStatus !== "approved") return null;
  const seller = await Seller.exists({ uid: product.sellerId, status: "approved" });
  return seller ? product : null;
};

app.post("/api/newsletter", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  if (req.user?.email_verified !== true) {
    return res.status(403).json({ error: "Verify your account email before subscribing." });
  }
  const email = req.user.email;
  const { consent } = req.body as { consent?: unknown };
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "Your signed-in account must have a valid email address." });
  }
  if (consent !== true) {
    return res.status(400).json({ error: "Newsletter consent is required." });
  }

  try {
    await NewsletterSubscriber.create({ email: email.trim().toLowerCase() });
    return res.status(201).json({ message: "You’re subscribed to Nech Work updates." });
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      return res.status(200).json({ message: "This email is already subscribed." });
    }
    throw error;
  }
});

app.get(
  "/api/admin/newsletter",
  verifyAuth,
  requireAdmin,
  async (_req: AuthedRequest, res) => {
    const subscribers = await NewsletterSubscriber.find()
      .sort({ createdAt: -1 })
      .select("email consentedAt createdAt")
      .lean();
    res.json(subscribers);
  },
);

app.get("/api/profile", verifyAuth, async (req: AuthedRequest, res) => {
  const profile = await UserProfile.findOne({ uid: req.user!.uid }).lean();
  res.json(profile || null);
});

app.put("/api/profile", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  const { firstName, lastName, phoneNumber } = req.body as {
    firstName?: unknown;
    lastName?: unknown;
    phoneNumber?: unknown;
  };
  if (
    typeof firstName !== "string" ||
    !firstName.trim() ||
    typeof lastName !== "string" ||
    !lastName.trim() ||
    typeof phoneNumber !== "string" ||
    !/^\+[1-9]\d{7,14}$/.test(phoneNumber.trim())
  ) {
    return res.status(400).json({
      error: "First name and last name are required. Phone numbers must use international format, for example +251912345678.",
    });
  }

  const profile = await UserProfile.findOneAndUpdate(
    { uid: req.user!.uid },
    {
      uid: req.user!.uid,
      email: req.user!.email || "",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim(),
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.json(profile);
});

app.get(
  "/api/admin/profiles",
  verifyAuth,
  requireAdmin,
  async (_req: AuthedRequest, res) => {
    const profiles = await UserProfile.find().sort({ updatedAt: -1 }).lean();
    res.json(profiles);
  },
);

app.post("/api/seller/apply", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  const {
    firstName, lastName, phoneNumber, shopName, description, city, address,
    bankName, accountHolderName, accountNumber, mobileMoneyNumber,
  } = req.body as Record<string, unknown>;
  const requiredText = [firstName, lastName, shopName, description, city, address, bankName, accountHolderName, accountNumber];
  if (
    requiredText.some((value) => typeof value !== "string" || !value.trim()) ||
    typeof phoneNumber !== "string" || !/^\+[1-9]\d{7,14}$/.test(phoneNumber.trim()) ||
    (mobileMoneyNumber !== undefined && typeof mobileMoneyNumber !== "string")
  ) {
    return res.status(400).json({ error: "Complete the shop, contact, and payout details before applying." });
  }
  if (
    (description as string).trim().length > 1000 ||
    (shopName as string).trim().length > 100 ||
    (address as string).trim().length > 300 ||
    (accountNumber as string).trim().length > 100
  ) {
    return res.status(400).json({ error: "One or more application fields exceed the allowed length." });
  }
  const current = await Seller.findOne({ uid: req.user!.uid });
  if (current?.status === "approved") {
    return res.status(409).json({ error: "Your seller account is already approved." });
  }
  if (current?.status === "pending") {
    return res.status(409).json({ error: "Your seller application is already awaiting review." });
  }
  const seller = await Seller.findOneAndUpdate(
    { uid: req.user!.uid },
    {
      uid: req.user!.uid,
      email: req.user!.email || "",
      firstName: (firstName as string).trim(),
      lastName: (lastName as string).trim(),
      phoneNumber: phoneNumber.trim(),
      shopName: (shopName as string).trim(),
      description: (description as string).trim(),
      city: (city as string).trim(),
      address: (address as string).trim(),
      bankName: (bankName as string).trim(),
      accountHolderName: (accountHolderName as string).trim(),
      accountNumber: (accountNumber as string).trim(),
      mobileMoneyNumber: typeof mobileMoneyNumber === "string" ? mobileMoneyNumber.trim() : "",
      status: "pending",
      commissionRate: 0.05,
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.status(201).json(seller);
});

app.get("/api/seller/me", verifyAuth, async (req: AuthedRequest, res) => {
  const seller = await Seller.findOne({ uid: req.user!.uid }).select("-accountNumber -mobileMoneyNumber").lean();
  res.json(seller || null);
});

const validateSellerProfile = (body: Record<string, unknown>) => {
  const fields = ["shopName", "logoUrl", "description", "city", "address", "phoneNumber"] as const;
  if (fields.some((field) => typeof body[field] !== "string")) return null;
  const profile = Object.fromEntries(fields.map((field) => [field, (body[field] as string).trim()])) as Record<(typeof fields)[number], string>;
  if (
    !profile.shopName || profile.shopName.length > 100 ||
    (profile.logoUrl !== "" && !isCloudinaryUrl(profile.logoUrl)) ||
    !profile.description || profile.description.length > 1000 ||
    !profile.city || profile.city.length > 100 ||
    !profile.address || profile.address.length > 300 ||
    !/^\+[1-9]\d{7,14}$/.test(profile.phoneNumber)
  ) return null;
  return profile;
};

app.put("/api/seller/profile", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  const profile = validateSellerProfile(req.body as Record<string, unknown>);
  if (!profile) return res.status(400).json({ error: "Enter a valid shop name, Cloudinary logo, description, location, and international phone number." });
  const seller = await Seller.findOneAndUpdate(
    { uid: req.user!.uid, status: "approved" },
    profile,
    { new: true, runValidators: true },
  ).select("-accountNumber -mobileMoneyNumber").lean();
  if (!seller) return res.status(403).json({ error: "Only approved sellers can update their shop profile." });
  res.json(seller);
});

app.get("/api/admin/sellers", verifyAuth, requireAdmin, async (_req, res) => {
  const sellers = await Seller.find().sort({ createdAt: -1 }).lean();
  res.json(sellers);
});

app.put("/api/admin/sellers/:uid/profile", actionLimiter, verifyAuth, requireAdmin, async (req, res) => {
  const profile = validateSellerProfile(req.body as Record<string, unknown>);
  if (!profile) return res.status(400).json({ error: "Enter a valid shop name, Cloudinary logo, description, location, and international phone number." });
  const seller = await Seller.findOneAndUpdate(
    { uid: req.params.uid },
    profile,
    { new: true, runValidators: true },
  ).lean();
  if (!seller) return res.status(404).json({ error: "Seller not found." });
  res.json(seller);
});

app.patch("/api/admin/sellers/:uid/status", actionLimiter, verifyAuth, requireAdmin, async (req, res) => {
  const { status } = req.body as { status?: unknown };
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "Seller status must be approved or rejected." });
  }
  const seller = await Seller.findOneAndUpdate(
    { uid: req.params.uid, status: "pending" },
    { status },
    { new: true, runValidators: true },
  );
  if (!seller) return res.status(404).json({ error: "Pending seller application not found." });
  res.json(seller);
});

app.get("/api/seller/products", verifyAuth, async (req: AuthedRequest, res) => {
  const seller = await Seller.findOne({ uid: req.user!.uid });
  if (!seller) return res.status(403).json({ error: "Submit a seller application before managing products." });
  const products = await Product.find({ sellerId: seller.uid }).sort({ createdAt: -1 }).lean();
  res.json(products);
});

app.post("/api/seller/products", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  const seller = await Seller.findOne({ uid: req.user!.uid });
  if (!seller || seller.status !== "approved") {
    return res.status(403).json({ error: "Your seller application must be approved before listing products." });
  }
  if (req.user?.email_verified !== true) {
    return res.status(403).json({ error: "Verify your email before listing products." });
  }
  const { name, category, description, price, image, kind, assets, specifications } = req.body as Record<string, unknown>;
  if (
    typeof name !== "string" || !name.trim() || name.trim().length > 150 ||
    typeof category !== "string" || !category.trim() ||
    typeof description !== "string" || !description.trim() || description.trim().length > 2000 ||
    typeof price !== "number" || !Number.isFinite(price) || price <= 0 ||
    !isCloudinaryUrl(image) ||
    (kind !== "physical" && kind !== "digital") ||
    (specifications !== undefined && !validateSpecifications(specifications)) ||
    !Array.isArray(assets) || assets.length > 10 ||
    assets.some((asset) =>
      !asset || typeof asset !== "object" ||
      typeof (asset as { name?: unknown }).name !== "string" ||
      !(asset as { name: string }).name.trim() ||
      !isCloudinaryUrl((asset as { url?: unknown }).url),
    )
  ) {
    return res.status(400).json({ error: "Provide valid product details, a Cloudinary image, a product type, and up to 10 Cloudinary files." });
  }
  if (kind === "physical" && assets.length > 0) {
    return res.status(400).json({ error: "Downloadable files can only be attached to digital products." });
  }
  const categoryRecord = await Category.findOne({ name: category.trim(), active: true }).lean();
  if (!categoryRecord) return res.status(400).json({ error: "Choose an active product category." });
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45) || "seller-product";
  const id = `${slug}-${randomUUID().slice(0, 8)}`;
  const product = await Product.create({
    id,
    name: name.trim(),
    category: category.trim(),
    description: description.trim(),
    price: Math.round(price * 100) / 100,
    image,
    kind,
    assets: assets.map((asset) => ({
      name: (asset as { name: string }).name.trim().slice(0, 150),
      url: (asset as { url: string }).url,
    })),
    specifications: specifications || [],
    sellerId: seller.uid,
    sellerListingStatus: "pending",
    active: false,
  });
  res.status(201).json(product);
});

app.put("/api/seller/products/:id", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  const seller = await Seller.findOne({ uid: req.user!.uid, status: "approved" });
  if (!seller) return res.status(403).json({ error: "Your approved seller account is required to edit products." });
  if (req.user?.email_verified !== true) {
    return res.status(403).json({ error: "Verify your email before editing products." });
  }
  const { name, category, description, price, image, kind, assets, specifications } = req.body as Record<string, unknown>;
  if (
    typeof name !== "string" || !name.trim() || name.trim().length > 150 ||
    typeof category !== "string" || !category.trim() ||
    typeof description !== "string" || !description.trim() || description.trim().length > 2000 ||
    typeof price !== "number" || !Number.isFinite(price) || price <= 0 ||
    !isCloudinaryUrl(image) ||
    (kind !== "physical" && kind !== "digital") ||
    (specifications !== undefined && !validateSpecifications(specifications)) ||
    !Array.isArray(assets) || assets.length > 10 ||
    assets.some((asset) =>
      !asset || typeof asset !== "object" ||
      typeof (asset as { name?: unknown }).name !== "string" ||
      !(asset as { name: string }).name.trim() ||
      !isCloudinaryUrl((asset as { url?: unknown }).url),
    )
  ) {
    return res.status(400).json({ error: "Provide valid product details, a Cloudinary image, a product type, and up to 10 Cloudinary files." });
  }
  if (kind === "physical" && assets.length > 0) {
    return res.status(400).json({ error: "Downloadable files can only be attached to digital products." });
  }
  const categoryRecord = await Category.findOne({ name: category.trim(), active: true }).lean();
  if (!categoryRecord) return res.status(400).json({ error: "Choose an active product category." });
  const product = await Product.findOneAndUpdate(
    { id: req.params.id, sellerId: seller.uid },
    {
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: Math.round(price * 100) / 100,
      image,
      kind,
      assets: assets.map((asset) => ({
        name: (asset as { name: string }).name.trim().slice(0, 150),
        url: (asset as { url: string }).url,
      })),
      specifications: specifications || [],
      sellerListingStatus: "pending",
      active: false,
    },
    { new: true, runValidators: true },
  );
  if (!product) return res.status(404).json({ error: "Your product listing was not found." });
  res.json(product);
});

app.get("/api/admin/seller-products", verifyAuth, requireAdmin, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid listing status." });
  }
  const listingFilter: Record<string, unknown> = {
    sellerId: { $exists: true },
    sellerListingStatus: status as IProduct["sellerListingStatus"],
  };
  const products = await Product.find(listingFilter).sort({ createdAt: -1 }).lean();
  res.json(products);
});

app.patch("/api/admin/seller-products/:id/status", actionLimiter, verifyAuth, requireAdmin, async (req, res) => {
  const { status } = req.body as { status?: unknown };
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "Listing status must be approved or rejected." });
  }
  const product = await Product.findOneAndUpdate(
    { id: req.params.id, sellerId: { $exists: true }, sellerListingStatus: "pending" },
    { sellerListingStatus: status, active: status === "approved" },
    { new: true, runValidators: true },
  );
  if (!product) return res.status(404).json({ error: "Pending seller listing not found." });
  res.json(product);
});

app.get("/api/products", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const approvedSellers = await Seller.find({ status: "approved" }).distinct("uid");
  const filter: Record<string, unknown> = {
    active: true,
    $or: [
      { sellerId: { $exists: false } },
      { sellerId: null },
      { sellerId: { $in: approvedSellers }, sellerListingStatus: "approved" },
    ],
  };
  if (category && category !== "All") filter.category = category;
  const products = await Product.find(filter).select("-assets").sort({ createdAt: -1 }).lean();
  const productIds = products.map((product) => product.id);
  const [reactionCounts, reviewCounts, orderCounts] = await Promise.all([
    ProductReaction.aggregate<{ _id: string; count: number }>([
      { $match: { productId: { $in: productIds } } },
      { $group: { _id: "$productId", count: { $sum: 1 } } },
    ]),
    ProductReview.aggregate<{ _id: string; count: number }>([
      { $match: { productId: { $in: productIds } } },
      { $group: { _id: "$productId", count: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: string; count: number }>([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: "$items.productId", count: { $sum: "$items.quantity" } } },
    ]),
  ]);
  const popularity = new Map<string, number>();
  for (const group of [...reactionCounts, ...reviewCounts, ...orderCounts]) {
    popularity.set(group._id, (popularity.get(group._id) || 0) + group.count);
  }
  const sellerIds = [...new Set(products.map((product) => product.sellerId).filter((uid): uid is string => Boolean(uid)))];
  const sellers = await Seller.find({ uid: { $in: sellerIds }, status: "approved" })
    .select("uid shopName logoUrl description city address phoneNumber").lean();
  const sellerById = new Map(sellers.map((seller) => [seller.uid, seller]));
  res.json(products.map((product) => {
    const seller = product.sellerId ? sellerById.get(product.sellerId) : undefined;
    return { ...asPublicProduct(product, seller ? {
      shopName: seller.shopName,
      logoUrl: seller.logoUrl || "",
      description: seller.description,
      city: seller.city,
      address: seller.address,
      phoneNumber: seller.phoneNumber,
    } : undefined), popularity: popularity.get(product.id) || 0 };
  }));
});

app.get("/api/categories", async (_req, res) => {
  const categories = await Category.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean();
  res.json(categories);
});

app.post("/api/categories", actionLimiter, verifyAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: unknown };
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Category name is required" });
  const category = await Category.create({ name: name.trim(), slug: categorySlug(name), sortOrder: 0 });
  res.status(201).json(category);
});

app.put("/api/categories/:slug", actionLimiter, verifyAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { name, active } = req.body as { name?: unknown; active?: unknown };
  const update: { name?: string; slug?: string; active?: boolean } = {};
  if (typeof name === "string" && name.trim()) {
    update.name = name.trim();
    update.slug = categorySlug(name);
  }
  if (typeof active === "boolean") update.active = active;
  const category = await Category.findOneAndUpdate({ slug: req.params.slug }, update, { new: true, runValidators: true });
  if (!category) return res.status(404).json({ error: "Category not found" });
  res.json(category);
});

app.get("/api/products/:id", async (req, res) => {
  const product = await Product.findOne({ id: req.params.id, active: true }).select("-assets").lean();
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (product.sellerId) {
    const seller = await Seller.findOne({ uid: product.sellerId, status: "approved" }).select("shopName logoUrl description city address phoneNumber").lean();
    if (!seller || product.sellerListingStatus !== "approved") return res.status(404).json({ error: "Product not found" });
    return res.json(asPublicProduct(product, {
      shopName: seller.shopName,
      logoUrl: seller.logoUrl || "",
      description: seller.description,
      city: seller.city,
      address: seller.address,
      phoneNumber: seller.phoneNumber,
    }));
  }
  res.json(asPublicProduct(product));
});

app.get("/api/products/:id/reviews", async (req, res) => {
  const product = await findPublicProduct(String(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found." });
  const [reviews, upvotes] = await Promise.all([
    ProductReview.find({ productId: product.id }).sort({ createdAt: -1 }).select("postedBy rating text createdAt").lean(),
    ProductReaction.countDocuments({ productId: product.id }),
  ]);
  res.json({ reviews, upvotes });
});

app.get("/api/products/:id/reactions/me", verifyAuth, async (req: AuthedRequest, res) => {
  const product = await findPublicProduct(String(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found." });
  const reacted = await ProductReaction.exists({ productId: product.id, uid: req.user!.uid });
  res.json({ reacted: Boolean(reacted) });
});

app.post("/api/products/:id/reactions", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  const product = await findPublicProduct(String(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found." });
  const current = await ProductReaction.findOne({ productId: product.id, uid: req.user!.uid });
  let reacted: boolean;
  if (current) {
    await current.deleteOne();
    reacted = false;
  } else {
    try {
      await ProductReaction.create({ productId: product.id, uid: req.user!.uid });
      reacted = true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        reacted = true;
      } else {
        throw error;
      }
    }
  }
  const upvotes = await ProductReaction.countDocuments({ productId: product.id });
  res.json({ reacted, upvotes });
});

app.post("/api/products/:id/reviews", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  if (req.user?.email_verified !== true) {
    return res.status(403).json({ error: "Verify your account email before reviewing products." });
  }
  const product = await findPublicProduct(String(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found." });
  const { rating, text } = req.body as { rating?: unknown; text?: unknown };
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5 ||
      typeof text !== "string" || text.trim().length < 2 || text.trim().length > 1500) {
    return res.status(400).json({ error: "Choose a 1–5 star rating and write a review between 2 and 1500 characters." });
  }
  const purchased = await Order.exists({
    userId: req.user!.uid,
    paymentStatus: "paid",
    "items.productId": product.id,
  });
  if (!purchased) return res.status(403).json({ error: "Only verified buyers of this product can post a review." });
  const reviewerProfile = await UserProfile.findOne({ uid: req.user!.uid }).lean();
  const reviewerName = [reviewerProfile?.firstName, reviewerProfile?.lastName].filter(Boolean).join(" ") || "Verified buyer";
  try {
    const review = await ProductReview.create({
      productId: product.id,
      uid: req.user!.uid,
      postedBy: reviewerName,
      rating: rating as number,
      text: text.trim(),
    });
    return res.status(201).json(review);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return res.status(409).json({ error: "You have already reviewed this product." });
    }
    throw error;
  }
});

app.post(
  "/api/products",
  actionLimiter,
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const { id, name, category, description, price, image, badge, specifications } = req.body;
    if (
      typeof id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
      typeof name !== "string" ||
      !name.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      typeof image !== "string" ||
      !image.trim() ||
      (specifications !== undefined && !validateSpecifications(specifications))
    ) {
      return res.status(400).json({
        error: "id, name, category, description, non-negative price, and image are required",
      });
    }
    const existing = await Product.findOne({ id });
    if (existing) return res.status(409).json({ error: "A product with this id already exists" });
    const product = await Product.create({
      id: id.trim(),
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: Math.round(price * 100) / 100,
      image: image.trim(),
      badge: typeof badge === "string" && badge.trim() ? badge.trim() : undefined,
      specifications: specifications || [],
    });
    res.status(201).json(product);
  },
);

app.put(
  "/api/products/:id",
  actionLimiter,
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const { name, category, description, price, image, badge, specifications } = req.body;
    if (
      typeof name !== "string" || !name.trim() ||
      typeof category !== "string" || !category.trim() ||
      typeof description !== "string" || !description.trim() ||
      typeof price !== "number" || !Number.isFinite(price) || price < 0 ||
      typeof image !== "string" || !image.trim() ||
      (specifications !== undefined && !validateSpecifications(specifications))
    ) {
      return res.status(400).json({
        error: "name, category, description, non-negative price, and image are required",
      });
    }
    const product = await Product.findOneAndUpdate(
      { id: req.params.id },
      {
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        price: Math.round(price * 100) / 100,
        image: image.trim(),
        badge: typeof badge === "string" && badge.trim() ? badge.trim() : undefined,
        specifications: specifications || [],
      },
      { new: true, runValidators: true },
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  },
);

app.delete(
  "/api/products/:id",
  actionLimiter,
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const product = await Product.findOneAndUpdate(
      { id: req.params.id },
      { active: false },
      { new: true },
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product archived" });
  },
);

app.post("/api/payments/chapa/initialize", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  if (req.user?.email_verified !== true) {
    return res.status(403).json({ error: "Verify your email before placing an order." });
  }

  const secretKey = process.env.CHAPA_SECRET_KEY;
  const backendUrl = process.env.BACKEND_URL;
  const frontendUrl = process.env.FRONTEND_URL;
  const exchangeRate = Number(process.env.USD_TO_ETB_RATE);
  if (!secretKey || !backendUrl || !frontendUrl || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    const missingConfig = [
      !secretKey && "CHAPA_SECRET_KEY",
      !backendUrl && "BACKEND_URL",
      !frontendUrl && "FRONTEND_URL",
      (!Number.isFinite(exchangeRate) || exchangeRate <= 0) && "USD_TO_ETB_RATE",
    ].filter((name): name is string => Boolean(name));
    return res.status(503).json({
      error: `Chapa checkout is not fully configured on the server. Missing or invalid settings: ${missingConfig.join(", ")}.`,
    });
  }

  const { items, shipping, currency } = req.body as {
    items?: Array<{ productId?: unknown; quantity?: unknown }>;
    shipping?: Record<string, unknown>;
    currency?: unknown;
  };
  if (currency !== "USD" && currency !== "ETB") {
    return res.status(400).json({ error: "Choose USD or ETB as the payment currency." });
  }
  const validItems = Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) =>
      typeof item.productId === "string" &&
      typeof item.quantity === "number" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 99,
    );
  const requiredShipping = ["firstName", "lastName", "phoneNumber", "address", "city", "postalCode"];
  if (!validItems || !shipping || requiredShipping.some((field) =>
    typeof shipping[field] !== "string" || !String(shipping[field]).trim(),
  )) {
    return res.status(400).json({ error: "Valid order items and complete delivery details are required." });
  }

  const productIds = items.map((item) => item.productId as string);
  const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
  if (products.length !== new Set(productIds).size) {
    return res.status(400).json({ error: "One or more products are unavailable." });
  }
  const sellerIds = [...new Set(products.map((product) => product.sellerId).filter((uid): uid is string => Boolean(uid)))];
  const sellers = await Seller.find({ uid: { $in: sellerIds }, status: "approved" }).lean();
  if (sellers.length !== sellerIds.length || products.some((product) => product.sellerId && product.sellerListingStatus !== "approved")) {
    return res.status(400).json({ error: "One or more seller products are no longer available." });
  }
  const sellerById = new Map(sellers.map((seller) => [seller.uid, seller]));
  const orderItems = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error("Validated checkout product disappeared.");
    return {
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity as number,
      ...(product.sellerId ? { sellerId: product.sellerId } : {}),
      kind: product.kind || "physical",
    };
  });
  const subtotalUsd = Math.round(orderItems.reduce((total, item) => total + item.price * item.quantity, 0) * 100) / 100;
  const amountEtb = Math.round(subtotalUsd * exchangeRate * 100) / 100;
  if (amountEtb <= 0) return res.status(400).json({ error: "The order total must be greater than zero." });
  const amountPaid = currency === "USD" ? subtotalUsd : amountEtb;
  const sellerTotalsUsd = new Map<string, number>();
  for (const item of orderItems) {
    if (!item.sellerId) continue;
    sellerTotalsUsd.set(item.sellerId, (sellerTotalsUsd.get(item.sellerId) || 0) + item.price * item.quantity);
  }
  const sellerPayouts = [...sellerTotalsUsd.entries()].map(([sellerId, grossUsd]) => {
    const seller = sellerById.get(sellerId)!;
    const grossAmount = Math.round((currency === "USD" ? grossUsd : grossUsd * exchangeRate) * 100) / 100;
    const commissionAmount = Math.round(grossAmount * 0.05 * 100) / 100;
    return {
      sellerId,
      shopName: seller.shopName,
      grossAmount,
      commissionRate: 0.05,
      commissionAmount,
      payoutAmount: Math.round((grossAmount - commissionAmount) * 100) / 100,
      currency,
      status: "pending" as const,
    };
  });

  const txRef = `nech-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const profile = await UserProfile.findOne({ uid: req.user!.uid }).lean();
  const order = await Order.create({
    userId: req.user!.uid,
    email: req.user!.email || "",
    phoneNumber: profile?.phoneNumber || undefined,
    items: orderItems,
    sellerPayouts,
    shipping,
    subtotal: subtotalUsd,
    amountPaid,
    amountEtb,
    exchangeRate,
    currency,
    paymentMethod: "chapa",
    paymentStatus: "pending",
    transactionId: txRef,
    status: "pending",
  });

  const phone = typeof shipping.phoneNumber === "string" ? shipping.phoneNumber.replace(/\D/g, "") : "";
  const chapaPhone = phone.startsWith("251") && phone.length === 12 ? `0${phone.slice(3)}` : phone;
  const payload = {
    amount: amountPaid.toFixed(2),
    currency,
    email: req.user!.email || "",
    first_name: String(shipping.firstName).trim(),
    last_name: String(shipping.lastName).trim(),
    tx_ref: txRef,
    callback_url: `${backendUrl.replace(/\/$/, "")}/api/payments/chapa/webhook`,
    return_url: `${frontendUrl.replace(/\/$/, "")}/payment/return?tx_ref=${encodeURIComponent(txRef)}`,
    customization: {
      title: "Nech Work",
      description: `Order ${txRef}`,
    },
    ...( /^0[79]\d{8}$/.test(chapaPhone) ? { phone_number: chapaPhone } : {}),
  };

  try {
    const chapa = new Chapa({ secretKey });
    const result = await chapa.initialize(payload);
    if (result.status !== "success" || !result.data?.checkout_url) {
      order.paymentStatus = "failed";
      order.status = "rejected";
      await order.save();
      return res.status(502).json({ error: result.message || "Chapa could not initialize this payment." });
    }
    res.status(201).json({ checkoutUrl: result.data.checkout_url, txRef, amountPaid, currency });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Could not connect to Chapa.",
    });
  }
});

app.get("/api/payments/chapa/verify/:txRef", verifyAuth, async (req: AuthedRequest, res) => {
  const order = await Order.findOne({ transactionId: req.params.txRef, userId: req.user!.uid });
  if (!order) return res.status(404).json({ error: "Payment order not found." });
  try {
    const verification = await verifyChapaOrder(order);
    res.json({ ...verification, orderId: order._id, txRef: order.transactionId });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Payment verification failed." });
  }
});

app.post("/api/payments/chapa/webhook", actionLimiter, async (req, res) => {
  const body = req.body as { tx_ref?: unknown; data?: { tx_ref?: unknown } };
  const txRef = typeof body.tx_ref === "string"
    ? body.tx_ref
    : typeof body.data?.tx_ref === "string" ? body.data.tx_ref : "";
  if (!txRef) return res.status(400).json({ error: "Transaction reference is required." });
  const order = await Order.findOne({ transactionId: txRef, paymentMethod: "chapa" });
  if (!order) return res.status(404).json({ error: "Payment order not found." });
  try {
    const verification = await verifyChapaOrder(order);
    res.json({ received: true, paid: verification.paid });
  } catch {
    res.status(502).json({ error: "Could not verify the Chapa notification." });
  }
});

app.post("/api/orders", actionLimiter, verifyAuth, (_req, res) => {
  res.status(410).json({ error: "Manual transfer checkout is unavailable. Place your order through Chapa." });
});

app.get("/api/orders", verifyAuth, async (req: AuthedRequest, res) => {
  const orders = await Order.find({ userId: req.user!.uid }).sort({ createdAt: -1 }).lean();
  res.json(orders);
});

app.get("/api/orders/:id/downloads", verifyAuth, async (req: AuthedRequest, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id as string)) {
    return res.status(400).json({ error: "Invalid order ID." });
  }
  const order = await Order.findOne({ _id: req.params.id, userId: req.user!.uid }).lean();
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.paymentStatus !== "paid") return res.status(403).json({ error: "Downloads are available after payment is verified." });
  const digitalProductIds = order.items.filter((item) => item.kind === "digital").map((item) => item.productId);
  const products = await Product.find({ id: { $in: digitalProductIds }, kind: "digital", active: true })
    .select("id name assets sellerId").lean();
  const ownedProducts = new Set(order.items.filter((item) => item.kind === "digital").map((item) => item.productId));
  res.json(products
    .filter((product) => ownedProducts.has(product.id))
    .map((product) => ({ productId: product.id, name: product.name, assets: product.assets })));
});

app.get("/api/seller/payouts", verifyAuth, async (req: AuthedRequest, res) => {
  const seller = await Seller.findOne({ uid: req.user!.uid }).select("uid").lean();
  if (!seller) return res.status(403).json({ error: "Seller account not found." });
  const orders = await Order.find({ "sellerPayouts.sellerId": seller.uid, paymentStatus: "paid" })
    .select("transactionId currency sellerPayouts createdAt").sort({ createdAt: -1 }).lean();
  res.json(orders.flatMap((order) => {
    const payout = order.sellerPayouts.find((item) => item.sellerId === seller.uid);
    return payout ? [{ orderId: order._id, transactionId: order.transactionId, createdAt: order.createdAt, ...payout }] : [];
  }));
});

app.get("/api/admin/seller-payouts", verifyAuth, requireAdmin, async (_req, res) => {
  const orders = await Order.find({ paymentStatus: "paid", "sellerPayouts.0": { $exists: true } })
    .select("transactionId email sellerPayouts createdAt").sort({ createdAt: -1 }).lean();
  const sellerIds = [...new Set(orders.flatMap((order) => order.sellerPayouts.map((payout) => payout.sellerId)))];
  const sellers = await Seller.find({ uid: { $in: sellerIds } })
    .select("uid bankName accountHolderName accountNumber mobileMoneyNumber").lean();
  const sellerById = new Map(sellers.map((seller) => [seller.uid, seller]));
  res.json(orders.flatMap((order) => order.sellerPayouts.map((payout) => ({
    orderId: order._id,
    transactionId: order.transactionId,
    buyerEmail: order.email,
    createdAt: order.createdAt,
    ...payout,
    payoutDetails: sellerById.get(payout.sellerId) || null,
  }))));
});

app.patch("/api/admin/orders/:id/seller-payouts/:sellerId", actionLimiter, verifyAuth, requireAdmin, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id as string)) {
    return res.status(400).json({ error: "Invalid order ID." });
  }
  const { transferReference } = req.body as { transferReference?: unknown };
  if (typeof transferReference !== "string" || transferReference.trim().length < 3 || transferReference.trim().length > 200) {
    return res.status(400).json({ error: "Enter a valid bank transfer reference." });
  }
  const order = await Order.findOne({ _id: req.params.id, paymentStatus: "paid" });
  if (!order) return res.status(404).json({ error: "Verified paid order not found." });
  const payout = order.sellerPayouts.find((item) => item.sellerId === req.params.sellerId);
  if (!payout) return res.status(404).json({ error: "Seller payout not found." });
  if (payout.status === "transferred") return res.status(409).json({ error: "This seller payout is already marked as transferred." });
  payout.status = "transferred";
  payout.transferReference = transferReference.trim();
  payout.transferredAt = new Date();
  await order.save();
  res.json({ message: "Seller payout recorded.", payout });
});

app.get(
  "/api/admin/orders",
  verifyAuth,
  requireAdmin,
  async (_req: AuthedRequest, res) => {
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  },
);

app.patch(
  "/api/admin/orders/:id/status",
  actionLimiter,
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const { status } = req.body as { status?: unknown };
    if (
      typeof status !== "string" ||
      !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])
    ) {
      return res.status(400).json({
        error: `status must be one of: ${ORDER_STATUSES.join(", ")}`,
      });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id as string)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  },
);

app.get("/api/conversations", verifyAuth, async (req: AuthedRequest, res) => {
  const filter = req.user?.admin === true
    ? {}
    : { $or: [{ buyerUid: req.user!.uid }, { sellerUid: req.user!.uid }] };
  const conversations = await Conversation.find(filter)
    .select("-messages -buyerEmail")
    .sort({ lastMessageAt: -1 })
    .lean();
  res.json(conversations);
});

app.post("/api/conversations", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  const { productId, orderId } = req.body as { productId?: unknown; orderId?: unknown };
  const isSupport = typeof orderId === "string";
  if (isSupport === (typeof productId === "string")) {
    return res.status(400).json({ error: "Choose a product seller or an order for support." });
  }

  const profile = await UserProfile.findOne({ uid: req.user!.uid }).lean();
  const buyerName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    req.user!.email?.split("@")[0] || "Customer";
  const buyerFields = {
    buyerUid: req.user!.uid,
    buyerName,
    buyerEmail: req.user!.email || "",
  };

  if (isSupport) {
    if (!mongoose.Types.ObjectId.isValid(orderId as string)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }
    const order = await Order.findOne({ _id: orderId, userId: req.user!.uid }).select("_id transactionId").lean();
    if (!order) return res.status(404).json({ error: "Your order was not found." });
    let conversation = await Conversation.findOne({ kind: "support", buyerUid: req.user!.uid, orderId: String(order._id) });
    if (!conversation) {
      conversation = await Conversation.create({
        kind: "support",
        ...buyerFields,
        orderId: String(order._id),
        productName: `Order ${order.transactionId}`,
      });
    }
    return res.status(200).json(conversation);
  }

  if (typeof productId !== "string" || !productId.trim()) {
    return res.status(400).json({ error: "A product is required to contact its seller." });
  }
  const product = await Product.findOne({ id: productId.trim(), active: true }).select("id name sellerId sellerListingStatus").lean();
  if (!product || !product.sellerId || product.sellerListingStatus !== "approved") {
    return res.status(404).json({ error: "This product does not have an available marketplace seller." });
  }
  if (product.sellerId === req.user!.uid) {
    return res.status(403).json({ error: "You cannot start a buyer conversation with your own shop." });
  }
  const seller = await Seller.findOne({ uid: product.sellerId, status: "approved" }).select("uid shopName").lean();
  if (!seller) return res.status(404).json({ error: "The seller is not available." });
  let conversation = await Conversation.findOne({
    kind: "seller",
    buyerUid: req.user!.uid,
    sellerUid: seller.uid,
    productId: product.id,
  });
  if (!conversation) {
    conversation = await Conversation.create({
      kind: "seller",
      ...buyerFields,
      sellerUid: seller.uid,
      sellerName: seller.shopName,
      productId: product.id,
      productName: product.name,
    });
  }
  res.status(200).json(conversation);
});

app.get("/api/conversations/:id", verifyAuth, async (req: AuthedRequest, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id as string)) {
    return res.status(400).json({ error: "Invalid conversation ID." });
  }
  const conversation = await Conversation.findById(req.params.id).select("-buyerEmail");
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });
  const canAccess = req.user?.admin === true ||
    conversation.buyerUid === req.user!.uid ||
    conversation.sellerUid === req.user!.uid;
  if (!canAccess) return res.status(403).json({ error: "You do not have access to this conversation." });
  res.json(conversation);
});

app.post("/api/conversations/:id/messages", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id as string)) {
    return res.status(400).json({ error: "Invalid conversation ID." });
  }
  const { text } = req.body as { text?: unknown };
  if (typeof text !== "string" || text.trim().length < 1 || text.trim().length > 4000) {
    return res.status(400).json({ error: "Messages must be between 1 and 4000 characters." });
  }
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });
  const canAccess = req.user?.admin === true ||
    conversation.buyerUid === req.user!.uid ||
    conversation.sellerUid === req.user!.uid;
  if (!canAccess) return res.status(403).json({ error: "You do not have access to this conversation." });
  const profile = await UserProfile.findOne({ uid: req.user!.uid }).lean();
  const displayName = req.user?.admin === true
    ? "Nech Work Support"
    : [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
      req.user!.email?.split("@")[0] || "Customer";
  const sentAt = new Date();
  conversation.messages.push({
    senderUid: req.user!.uid,
    senderName: displayName,
    text: text.trim(),
    createdAt: sentAt,
  });
  if (conversation.messages.length > 500) conversation.messages.splice(0, conversation.messages.length - 500);
  conversation.lastMessageAt = sentAt;
  conversation.lastMessageText = text.trim();
  await conversation.save();
  res.status(201).json(conversation.messages[conversation.messages.length - 1]);
});

app.get("/api/articles", async (req, res) => {
  const articles = await Article.find();
  res.json(articles);
});

app.get("/api/articles/:name", async (req, res) => {
  const article = await Article.findOne({ name: req.params.name });
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }
  res.json(article);
});

app.get("/api/gallery", async (_req, res) => {
  const images = await GalleryImage.find().sort({ createdAt: -1 }).lean();
  res.json(images);
});

app.post("/api/gallery", verifyAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { caption, image } = req.body as { caption?: unknown; image?: unknown };
  if (typeof caption !== "string" || !caption.trim() || typeof image !== "string" || !/^https?:\/\/[^\s]+$/i.test(image.trim())) {
    return res.status(400).json({ error: "caption and a valid image URL are required" });
  }
  const galleryImage = await GalleryImage.create({ caption: caption.trim(), image: image.trim() });
  res.status(201).json(galleryImage);
});

app.delete("/api/gallery/:id", verifyAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const image = await GalleryImage.findByIdAndDelete(req.params.id);
  if (!image) return res.status(404).json({ error: "Gallery image not found" });
  res.json({ message: "Gallery image deleted" });
});

app.post(
  "/api/articles/:name/upvote",
  actionLimiter,
  verifyAuth,
  async (req, res) => {
    const article = await Article.findOne({ name: req.params.name });
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    article.upvotes += 1;
    await article.save();
    res.json(article);
  },
);

app.post(
  "/api/articles/:name/comments",
  actionLimiter,
  verifyAuth,
  async (req: AuthedRequest, res) => {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    const article = await Article.findOne({ name: req.params.name });
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    article.comments.push({
      postedBy: req.user?.email || "Anonymous",
      uid: req.user!.uid,
      text,
    } as any);
    await article.save();
    res.json(article);
  },
);

app.patch(
  "/api/articles/:name/comments/:commentId",
  actionLimiter,
  verifyAuth,
  async (req: AuthedRequest, res) => {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    const article = await Article.findOne({ name: req.params.name });
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    const comment = article.comments.id(req.params.commentId as string);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.uid !== req.user!.uid) {
      return res
        .status(403)
        .json({ error: "You can only edit your own comments" });
    }

    comment.text = text;
    await article.save();
    res.json(article);
  },
);

app.delete(
  "/api/articles/:name/comments/:commentId",
  actionLimiter,
  verifyAuth,
  async (req: AuthedRequest, res) => {
    const article = await Article.findOne({ name: req.params.name });
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    const comment = article.comments.id(req.params.commentId as string);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.uid !== req.user!.uid) {
      return res
        .status(403)
        .json({ error: "You can only delete your own comments" });
    }

    comment.deleteOne();
    await article.save();
    res.json(article);
  },
);

// Create a new article
app.post(
  "/api/articles",
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const { name, title, content, image } = req.body;

    if (!name || !title || !Array.isArray(content)) {
      return res
        .status(400)
        .json({ error: "name, title, and content (array) are required" });
    }

    const existing = await Article.findOne({ name });
    if (existing) {
      return res
        .status(409)
        .json({ error: "An article with this name already exists" });
    }

    const article = new Article({ name, title, content, ...(typeof image === "string" && image.trim() ? { image: image.trim() } : {}) });
    await article.save();
    res.status(201).json(article);
  },
);

// Update an existing article
app.put(
  "/api/articles/:name",
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const { title, content, image } = req.body;

    const article = await Article.findOne({ name: req.params.name });
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    if (title) article.title = title;
    if (Array.isArray(content)) article.content = content;
    if (typeof image === "string") article.image = image.trim();

    await article.save();
    res.json(article);
  },
);

// Delete an article
app.delete(
  "/api/articles/:name",
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const article = await Article.findOneAndDelete({ name: req.params.name });
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json({ message: "Article deleted" });
  },
);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    return Product.bulkWrite(
      defaultProducts.map((product) => ({
        updateOne: {
          filter: { id: product.id },
          update: { $setOnInsert: product },
          upsert: true,
        },
      })),
    );
  })
  .then(() => {
    return Category.bulkWrite(
      defaultCategories.map((name, index) => ({
        updateOne: {
          filter: { slug: categorySlug(name) },
          update: { $setOnInsert: { name, slug: categorySlug(name), sortOrder: index } },
          upsert: true,
        },
      })),
    );
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

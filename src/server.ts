import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Article from "./models/Article";
import Product from "./models/Product";
import Order, { ORDER_STATUSES, PAYMENT_METHODS } from "./models/Order";
import UserProfile from "./models/UserProfile";
import { verifyAuth, AuthedRequest } from "./middleware/verifyAuth";
import { actionLimiter } from "./middleware/rateLimiter";
import { requireAdmin } from "./middleware/requireAdmin";
import { defaultProducts } from "./catalog";
import Category from "./models/Category";
import { categorySlug, defaultCategories } from "./categories";
import GalleryImage from "./models/GalleryImage";
import crypto from "node:crypto";
import { adminAuth } from "./firebaseAdmin";
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

app.post("/api/auth/telegram", actionLimiter, async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return res.status(503).json({ error: "Telegram sign-in is not configured." });
  const data = req.body as Record<string, unknown>;
  const receivedHash = typeof data.hash === "string" ? data.hash : "";
  const authDate = typeof data.auth_date === "string" ? Number(data.auth_date) : 0;
  const userId = typeof data.id === "number" || typeof data.id === "string" ? String(data.id) : "";
  if (!receivedHash || !authDate || !userId || Math.abs(Date.now() / 1000 - authDate) > 86400) {
    return res.status(401).json({ error: "Telegram login data is missing or expired." });
  }
  const checkString = Object.entries(data)
    .filter(([key, value]) => key !== "hash" && value !== undefined && value !== null)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const expectedHash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  if (receivedHash.length !== expectedHash.length || !crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(receivedHash))) {
    return res.status(401).json({ error: "Telegram login could not be verified." });
  }
  const firstName = typeof data.first_name === "string" ? data.first_name : "Telegram";
  const lastName = typeof data.last_name === "string" ? data.last_name : "";
  const username = typeof data.username === "string" ? data.username : "";
  const uid = `telegram:${userId}`;
  const email = `${uid.replace(/[^a-zA-Z0-9]/g, "-")}@telegram.local`;
  const profile = await UserProfile.findOneAndUpdate(
    { uid },
    { uid, email, firstName, lastName, phoneNumber: "", telegramUserId: userId, telegramUsername: username, telegramVerified: true },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
  const customToken = await adminAuth.createCustomToken(uid, { telegram: true });
  res.json({ customToken, profile });
});

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
      phoneVerified: false,
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

app.patch(
  "/api/admin/profiles/:uid/phone-status",
  actionLimiter,
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const { verified } = req.body as { verified?: unknown };
    if (typeof verified !== "boolean") {
      return res.status(400).json({ error: "verified must be a boolean" });
    }
    const profile = await UserProfile.findOneAndUpdate(
      { uid: req.params.uid },
      { phoneVerified: verified },
      { new: true },
    );
    if (!profile) return res.status(404).json({ error: "Customer profile not found" });
    res.json(profile);
  },
);

app.get("/api/products", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const filter = category && category !== "All" ? { active: true, category } : { active: true };
  const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
  res.json(products);
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
  const product = await Product.findOne({ id: req.params.id, active: true }).lean();
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

app.post(
  "/api/products",
  actionLimiter,
  verifyAuth,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    const { id, name, category, description, price, image, badge } = req.body;
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
      !image.trim()
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
    const { name, category, description, price, image, badge } = req.body;
    if (
      typeof name !== "string" || !name.trim() ||
      typeof category !== "string" || !category.trim() ||
      typeof description !== "string" || !description.trim() ||
      typeof price !== "number" || !Number.isFinite(price) || price < 0 ||
      typeof image !== "string" || !image.trim()
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

app.post("/api/orders", actionLimiter, verifyAuth, async (req: AuthedRequest, res) => {
  const profile = await UserProfile.findOne({ uid: req.user!.uid }).lean();
  const emailVerified = req.user?.email_verified === true;
  const phoneVerified = profile?.phoneVerified === true;
  if (!emailVerified && !phoneVerified) {
    return res.status(403).json({
      error: "Verify your email or get your phone number approved before ordering",
    });
  }
  const { items, shipping, paymentMethod, transactionId, paymentProofUrl } = req.body as {
    items?: Array<{ productId?: unknown; quantity?: unknown }>;
    shipping?: Record<string, unknown>;
    paymentMethod?: unknown;
    transactionId?: unknown;
    paymentProofUrl?: unknown;
  };
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    !shipping ||
    typeof paymentMethod !== "string" ||
    !PAYMENT_METHODS.includes(paymentMethod.trim().toLowerCase() as (typeof PAYMENT_METHODS)[number]) ||
    typeof transactionId !== "string" ||
    !transactionId.trim() ||
    transactionId.length > 200 ||
    typeof paymentProofUrl !== "string" ||
    !/^https?:\/\/[^\s]+$/i.test(paymentProofUrl.trim())
  ) {
    return res.status(400).json({
      error: "items, shipping, payment method, transaction ID, and a valid payment proof URL are required",
    });
  }
  const normalizedPaymentMethod = paymentMethod.trim().toLowerCase() as (typeof PAYMENT_METHODS)[number];
  const validItems = items.every((item) =>
    typeof item.productId === "string" &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= 99,
  );
  const requiredShipping = ["firstName", "lastName", "phoneNumber", "address", "city", "postalCode"];
  if (!validItems || requiredShipping.some((field) => typeof shipping[field] !== "string" || !shipping[field])) {
    return res.status(400).json({ error: "Invalid order items or shipping details" });
  }

  const productIds = items.map((item) => item.productId as string);
  const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
  if (products.length !== new Set(productIds).size) {
    return res.status(400).json({ error: "One or more products are unavailable" });
  }

  const orderItems = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return { productId: product!.id, name: product!.name, price: product!.price, quantity: item.quantity as number };
  });
  const subtotal = orderItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const order = await Order.create({
    userId: req.user!.uid,
    email: req.user!.email,
    phoneNumber: profile?.phoneNumber || undefined,
    items: orderItems,
    shipping,
    subtotal: Math.round(subtotal * 100) / 100,
    paymentMethod: normalizedPaymentMethod,
    transactionId: transactionId.trim(),
    paymentProofUrl: paymentProofUrl.trim(),
  });
  res.status(201).json(order);
});

app.get("/api/orders", verifyAuth, async (req: AuthedRequest, res) => {
  const orders = await Order.find({ userId: req.user!.uid }).sort({ createdAt: -1 }).lean();
  res.json(orders);
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
    if (typeof image === "string" && image.trim()) article.image = image.trim();

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

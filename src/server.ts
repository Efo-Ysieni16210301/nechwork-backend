import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Article from "./models/Article";
import Product from "./models/Product";
import Order, { ORDER_STATUSES, PAYMENT_METHODS } from "./models/Order";
import { verifyAuth, AuthedRequest } from "./middleware/verifyAuth";
import { actionLimiter } from "./middleware/rateLimiter";
import { requireAdmin } from "./middleware/requireAdmin";
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

app.get("/api/products", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const filter = category && category !== "All" ? { active: true, category } : { active: true };
  const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
  res.json(products);
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
  const requiredShipping = ["firstName", "lastName", "address", "city", "postalCode"];
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
    const { name, title, content } = req.body;

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

    const article = new Article({ name, title, content });
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
    const { title, content } = req.body;

    const article = await Article.findOne({ name: req.params.name });
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    if (title) article.title = title;
    if (Array.isArray(content)) article.content = content;

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
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

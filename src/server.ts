import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Article from "./models/Article";
import { verifyAuth, AuthedRequest } from "./middleware/verifyAuth";
import { actionLimiter } from "./middleware/rateLimiter";

const app = express();
const PORT = 8000;
const MONGO_URI = process.env.MONGO_URI as string;
app.set("trust proxy", 1);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);
app.use(express.json());

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

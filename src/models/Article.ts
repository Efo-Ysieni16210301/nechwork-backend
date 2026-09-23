import mongoose, { Schema, Document } from "mongoose";

interface Comment {
  postedBy: string;
  text: string;
}

export interface IArticle extends Document {
  name: string;
  title: string;
  content: string[];
  upvotes: number;
  comments: Comment[];
}

const CommentSchema = new Schema<Comment>({
  postedBy: { type: String, required: true },
  text: { type: String, required: true },
});

const ArticleSchema = new Schema<IArticle>({
  name: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: [String], required: true },
  upvotes: { type: Number, default: 0 },
  comments: { type: [CommentSchema], default: [] },
});

export default mongoose.model<IArticle>("Article", ArticleSchema);

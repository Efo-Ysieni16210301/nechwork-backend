import mongoose, { Schema, Document, Types } from "mongoose";

interface Comment {
  _id: Types.ObjectId;
  postedBy: string;
  uid: string;
  text: string;
}

export interface IArticle extends Document {
  name: string;
  title: string;
  content: string[];
  image?: string;
  upvotes: number;
  comments: Types.DocumentArray<Comment>;
}

const CommentSchema = new Schema<Comment>({
  postedBy: { type: String, required: true },
  uid: { type: String, required: true },
  text: { type: String, required: true },
});

const ArticleSchema = new Schema<IArticle>({
  name: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: [String], required: true },
  image: { type: String, trim: true },
  upvotes: { type: Number, default: 0 },
  comments: { type: [CommentSchema], default: [] },
});

export default mongoose.model<IArticle>("Article", ArticleSchema);

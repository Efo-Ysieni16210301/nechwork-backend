import mongoose, { Document, Schema } from "mongoose";

export interface IProductReview extends Document {
  productId: string;
  uid: string;
  postedBy: string;
  rating: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductReviewSchema = new Schema<IProductReview>(
  {
    productId: { type: String, required: true, index: true },
    uid: { type: String, required: true },
    postedBy: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true, minlength: 2, maxlength: 1500 },
  },
  { timestamps: true },
);
ProductReviewSchema.index({ productId: 1, uid: 1 }, { unique: true });

export default mongoose.model<IProductReview>("ProductReview", ProductReviewSchema);

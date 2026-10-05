import mongoose, { Document, Schema } from "mongoose";

export interface IProductReaction extends Document {
  productId: string;
  uid: string;
}

const ProductReactionSchema = new Schema<IProductReaction>(
  {
    productId: { type: String, required: true },
    uid: { type: String, required: true },
  },
  { timestamps: true },
);
ProductReactionSchema.index({ productId: 1, uid: 1 }, { unique: true });

export default mongoose.model<IProductReaction>("ProductReaction", ProductReactionSchema);

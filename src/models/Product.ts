import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  badge?: string;
  active: boolean;
}

const ProductSchema = new Schema<IProduct>(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true, trim: true },
    badge: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<IProduct>("Product", ProductSchema);

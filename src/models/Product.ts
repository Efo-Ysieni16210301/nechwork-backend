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
  sellerId?: string;
  sellerListingStatus: "pending" | "approved" | "rejected";
  kind: "physical" | "digital";
  assets: { name: string; url: string }[];
  specifications: { name: string; value: string }[];
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
    sellerId: { type: String, index: true },
    sellerListingStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "approved", index: true },
    kind: { type: String, enum: ["physical", "digital"], default: "physical" },
    assets: {
      type: [{ name: { type: String, required: true, trim: true }, url: { type: String, required: true, trim: true } }],
      default: [],
    },
    specifications: {
      type: [{ name: { type: String, required: true, trim: true }, value: { type: String, required: true, trim: true } }],
      default: [],
    },
  },
  { timestamps: true },
);

export default mongoose.model<IProduct>("Product", ProductSchema);

import mongoose, { Document, Schema } from "mongoose";

export const SELLER_STATUSES = ["pending", "approved", "rejected"] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

export interface ISeller extends Document {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  shopName: string;
  logoUrl?: string;
  description: string;
  city: string;
  address: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  mobileMoneyNumber?: string;
  status: SellerStatus;
  commissionRate: number;
}

const SellerSchema = new Schema<ISeller>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    shopName: { type: String, required: true, trim: true, maxlength: 100 },
    logoUrl: { type: String, trim: true, default: "" },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    bankName: { type: String, required: true, trim: true, maxlength: 100 },
    accountHolderName: { type: String, required: true, trim: true, maxlength: 150 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 100 },
    mobileMoneyNumber: { type: String, trim: true, maxlength: 30 },
    status: { type: String, enum: SELLER_STATUSES, required: true, default: "pending" },
    commissionRate: { type: Number, required: true, default: 0.05, min: 0, max: 1 },
  },
  { timestamps: true },
);

export default mongoose.model<ISeller>("Seller", SellerSchema);

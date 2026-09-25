import { Document, Schema } from "mongoose";
import mongoose from "mongoose";

export interface IUserProfile extends Document {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramVerified: boolean;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    firstName: { type: String, required: true, trim: true, default: "Customer" },
    lastName: { type: String, required: true, trim: true, default: "" },
    phoneNumber: { type: String, trim: true, default: "" },
    phoneVerified: { type: Boolean, default: false },
    telegramUserId: { type: String, sparse: true, index: true },
    telegramUsername: { type: String, trim: true },
    telegramVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

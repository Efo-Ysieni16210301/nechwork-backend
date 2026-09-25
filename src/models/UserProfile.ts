import { Document, Schema } from "mongoose";
import mongoose from "mongoose";

export interface IUserProfile extends Document {
  uid: string;
  email: string;
  phoneNumber: string;
  phoneVerified: boolean;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phoneNumber: { type: String, required: true, trim: true },
    phoneVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

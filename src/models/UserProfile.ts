import { Document, Schema } from "mongoose";
import mongoose from "mongoose";

export interface IUserProfile extends Document {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    firstName: { type: String, required: true, trim: true, default: "Customer" },
    lastName: { type: String, required: true, trim: true, default: "" },
    phoneNumber: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export default mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

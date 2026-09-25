import mongoose, { Document, Schema } from "mongoose";

export interface IGalleryImage extends Document {
  caption: string;
  image: string;
}

const GalleryImageSchema = new Schema<IGalleryImage>(
  {
    caption: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export default mongoose.model<IGalleryImage>("GalleryImage", GalleryImageSchema);

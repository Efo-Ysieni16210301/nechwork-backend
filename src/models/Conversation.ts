import mongoose, { Document, Schema } from "mongoose";

export type ConversationKind = "seller" | "support";

export interface IMessage {
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: Date;
}

export interface IConversation extends Document {
  kind: ConversationKind;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string;
  sellerUid?: string;
  sellerName?: string;
  productId?: string;
  productName?: string;
  orderId?: string;
  messages: IMessage[];
  lastMessageAt: Date;
  lastMessageText: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    senderUid: { type: String, required: true },
    senderName: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);

const ConversationSchema = new Schema<IConversation>(
  {
    kind: { type: String, enum: ["seller", "support"], required: true, index: true },
    buyerUid: { type: String, required: true, index: true },
    buyerName: { type: String, required: true, trim: true },
    buyerEmail: { type: String, required: true, trim: true, lowercase: true },
    sellerUid: { type: String, index: true },
    sellerName: { type: String, trim: true },
    productId: { type: String },
    productName: { type: String, trim: true },
    orderId: { type: String },
    messages: { type: [MessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessageText: { type: String, default: "", maxlength: 4000 },
  },
  { timestamps: true },
);
ConversationSchema.index({ kind: 1, buyerUid: 1, sellerUid: 1, productId: 1 });
ConversationSchema.index({ kind: 1, buyerUid: 1, orderId: 1 });

export default mongoose.model<IConversation>("Conversation", ConversationSchema);

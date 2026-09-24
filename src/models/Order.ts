import mongoose, { Document, Schema, Types } from "mongoose";

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export const PAYMENT_METHODS = ["telebirr", "cbe", "abyssinia", "other", "manual"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUSES = [
  "pending",
  "under_review",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "rejected",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrder extends Document {
  userId: string;
  email: string;
  items: Types.DocumentArray<OrderItem>;
  shipping: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
  };
  subtotal: number;
  paymentMethod: PaymentMethod;
  transactionId: string;
  paymentProofUrl: string;
  status: OrderStatus;
}

const OrderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, trim: true },
    items: { type: [OrderItemSchema], required: true, validate: (value: OrderItem[]) => value.length > 0 },
    shipping: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
    },
    subtotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      lowercase: true,
      trim: true,
    },
    transactionId: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    paymentProofUrl: {
      type: String,
      required: true,
      trim: true,
      match: /^https?:\/\/[^\s]+$/i,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model<IOrder>("Order", OrderSchema);

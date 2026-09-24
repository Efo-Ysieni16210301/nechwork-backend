import mongoose, { Document, Schema, Types } from "mongoose";

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

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
  status: "pending" | "confirmed" | "shipped" | "cancelled";
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
    status: { type: String, enum: ["pending", "confirmed", "shipped", "cancelled"], default: "pending" },
  },
  { timestamps: true },
);

export default mongoose.model<IOrder>("Order", OrderSchema);

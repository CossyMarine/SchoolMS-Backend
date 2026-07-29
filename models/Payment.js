// models/Payment.js
import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice", required: true },
    lineItemId: { type: mongoose.Schema.Types.ObjectId }, // which line item within the invoice, if specific
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true, unique: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ["mpesa", "cash", "bank", "cheque", "other"], required: true },
    reference: String, // M-Pesa code, cheque number, etc.

    allocations: [allocationSchema], // how this payment was spread across invoices/line items

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    status: { type: String, enum: ["completed", "reversed"], default: "completed" },
    reversal: {
      reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reversedAt: Date,
      reason: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);

// models/FeeInvoice.js — one invoice per student per term
import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema(
  {
    feeTypeId: { type: mongoose.Schema.Types.ObjectId, required: true }, // ref into School.feeTypes
    name: { type: String, required: true }, // snapshot at invoice time — survives fee type renames
    amountExpected: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
  },
  { _id: true }
);

const feeInvoiceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    academicYear: { type: String, required: true },
    term: { type: String, required: true },
    lineItems: [lineItemSchema],

    totalExpected: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },

    status: { type: String, enum: ["open", "cleared"], default: "open" },
  },
  { timestamps: true }
);

feeInvoiceSchema.index({ student: 1, academicYear: 1, term: 1 }, { unique: true });

feeInvoiceSchema.methods.recalculate = function () {
  this.totalExpected = this.lineItems.reduce((sum, li) => sum + li.amountExpected, 0);
  this.totalPaid = this.lineItems.reduce((sum, li) => sum + li.amountPaid, 0);
  this.balance = this.totalExpected - this.totalPaid;
  this.status = this.balance <= 0 ? "cleared" : "open";
};

export default mongoose.model("FeeInvoice", feeInvoiceSchema);

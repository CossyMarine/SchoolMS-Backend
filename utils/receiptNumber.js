// utils/receiptNumber.js
import Counter from "../models/Counter.js";

export async function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const seq = await Counter.nextSequence(`receipt-${year}`);
  return `RCT-${year}-${String(seq).padStart(5, "0")}`;
}

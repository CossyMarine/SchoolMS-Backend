// models/Book.js
import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: String,
    isbn: { type: String, trim: true },
    bookNumber: { type: String, required: true, unique: true, trim: true }, // physical copy tag, e.g. "LIB-0042"
    category: String,
    totalCopies: { type: Number, default: 1 },
    availableCopies: { type: Number, default: 1 },
    status: { type: String, enum: ["active", "lost", "damaged", "retired"], default: "active" },
    coverImageUrl: String, // Cloudinary
  },
  { timestamps: true }
);

bookSchema.index({ title: "text", author: "text" });

export default mongoose.model("Book", bookSchema);

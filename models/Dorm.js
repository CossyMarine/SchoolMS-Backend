// models/Dorm.js
import mongoose from "mongoose";

const dormSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Kilimanjaro House"
    genderRestriction: { type: String, enum: ["male", "female", "any"], default: "any" },
    capacity: { type: Number, default: 0 }, // 0 = unlimited
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dormSchema.index({ isActive: 1 });

export default mongoose.model("Dorm", dormSchema);

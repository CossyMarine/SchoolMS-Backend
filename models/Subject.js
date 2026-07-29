// models/Subject.js
import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Mathematics"
    code: { type: String, trim: true, uppercase: true }, // "MAT"
    levels: [{ type: String, enum: ["primary", "jss", "secondary"] }], // which levels offer it
    isCore: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Subject", subjectSchema);

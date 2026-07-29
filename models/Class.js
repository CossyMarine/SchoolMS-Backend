// models/Class.js — schools define their own classes/streams, nothing hardcoded
import mongoose from "mongoose";

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Form 1", "Grade 7", "Class 4"
    level: { type: String, enum: ["primary", "jss", "secondary"], required: true },
    streams: [{ type: String, trim: true }], // ["East", "North"] — empty array = no streaming
    order: { type: Number, default: 0 }, // for sorting in UI (Form 1 before Form 2, etc)
  },
  { timestamps: true }
);

classSchema.index({ level: 1, order: 1 });

export default mongoose.model("Class", classSchema);

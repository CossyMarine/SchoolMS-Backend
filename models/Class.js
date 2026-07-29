// models/Class.js — schools define their own classes/streams, nothing hardcoded
import mongoose from "mongoose";

const streamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "East", "Blue"
    capacity: { type: Number, default: null }, // null = no cap enforced
  },
  { _id: true }
);

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Form 1", "Grade 7", "Class 4"
    level: { type: String, enum: ["primary", "jss", "secondary"], required: true },
    streams: [streamSchema], // [] = no streaming, whole class is one group
    capacity: { type: Number, default: null }, // used only when streams is empty

    // Class teachers live on Teacher.classTeacherOf (single source of truth) —
    // this model never stores a teacher reference directly.

    // Academic-year progression — never automatic by date. Admin triggers a
    // year rollover (see promotionController) which follows this mapping.
    promotesTo: { type: mongoose.Schema.Types.ObjectId, ref: "Class", default: null },
    isGraduating: { type: Boolean, default: false }, // terminal class — students graduate instead of promoting

    order: { type: Number, default: 0 }, // for sorting in UI (Form 1 before Form 2, etc)
  },
  { timestamps: true }
);

classSchema.index({ level: 1, order: 1 });

export default mongoose.model("Class", classSchema);

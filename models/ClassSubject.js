// models/ClassSubject.js — which subjects belong to a class, compulsory or optional
import mongoose from "mongoose";

const classSubjectSchema = new mongoose.Schema(
  {
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    isCompulsory: { type: Boolean, default: true },
  },
  { timestamps: true }
);

classSubjectSchema.index({ class: 1, subject: 1 }, { unique: true });

export default mongoose.model("ClassSubject", classSubjectSchema);

// models/Exam.js — defines an assessment cycle (e.g. "Term 2 Exams")
import mongoose from "mongoose";

const componentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "CAT 1", "End Term"
    weight: { type: Number, required: true }, // percentage of final score, e.g. 30
    maxScore: { type: Number, default: 100 },
  },
  { _id: true }
);

const examSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Term 2 Mid-Term Exams"
    academicYear: { type: String, required: true },
    term: { type: String, required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true }],
    components: [componentSchema], // must sum to 100
    status: { type: String, enum: ["draft", "open", "approved"], default: "draft" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Exam", examSchema);

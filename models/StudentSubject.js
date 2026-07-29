// models/StudentSubject.js
import mongoose from "mongoose";

const studentSubjectSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    academicYear: { type: String, required: true },
  },
  { timestamps: true }
);

studentSubjectSchema.index({ student: 1, subject: 1, academicYear: 1 }, { unique: true });

export default mongoose.model("StudentSubject", studentSubjectSchema);

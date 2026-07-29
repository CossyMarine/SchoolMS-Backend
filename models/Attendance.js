// models/Attendance.js — one document per class per day
import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    stream: String,
    date: { type: Date, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    records: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
        status: { type: String, enum: ["present", "absent", "late", "excused"], default: "present" },
      },
    ],
  },
  { timestamps: true }
);

attendanceSchema.index({ class: 1, stream: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);

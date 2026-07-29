// models/Teacher.js
import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    staffId: { type: String, required: true, unique: true, trim: true },

    // Which subjects this teacher is assigned to teach, and in which classes
    assignments: [
      {
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
        class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
        stream: String, // blank = all streams of that class
      },
    ],

    // Class-teacher responsibility (only one active at a time, typically)
    classTeacherOf: {
      class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
      stream: String,
    },

    additionalRoles: [{ type: String }], // "librarian", "sports master", etc — informational tags

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Teacher", teacherSchema);

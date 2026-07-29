// models/Result.js — one document per student per subject per exam
import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema(
  {
    componentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    componentName: String, // snapshot
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    scores: [scoreSchema],
    totalPercentage: { type: Number, default: 0 },
    grade: { type: String },
    teacherComment: String,

    classPosition: Number, // filled in on approval — rank within class for this subject
  },
  { timestamps: true }
);

resultSchema.index({ exam: 1, student: 1, subject: 1 }, { unique: true });
resultSchema.index({ exam: 1, class: 1, subject: 1 });

resultSchema.methods.recalculate = function (components) {
  let total = 0;
  for (const s of this.scores) {
    const comp = components.find((c) => String(c._id) === String(s.componentId));
    if (!comp) continue;
    total += (s.score / s.maxScore) * comp.weight;
  }
  this.totalPercentage = Math.round(total * 100) / 100;
};

export default mongoose.model("Result", resultSchema);

// models/BookIssue.js — tracks a single copy's journey out and back
import mongoose from "mongoose";

const bookIssueSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    borrowerType: { type: String, enum: ["student", "teacher"], required: true },
    borrower: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "borrowerModelName" },
    // class-wide issue support: if a whole class is issued copies, link them by a shared batch id
    batchId: String,

    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    issuedDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnedDate: Date,

    status: { type: String, enum: ["issued", "returned", "lost", "damaged"], default: "issued" },
    condition: { type: String, enum: ["good", "damaged", "lost"], default: "good" }, // condition at return
    fineAmount: { type: Number, default: 0 },
    notes: String,
  },
  { timestamps: true }
);

// virtual so refPath resolves to "Student" or "Teacher"
bookIssueSchema.virtual("borrowerModelName").get(function () {
  return this.borrowerType === "student" ? "Student" : "Teacher";
});

bookIssueSchema.index({ borrowerType: 1, borrower: 1, status: 1 });
bookIssueSchema.index({ status: 1, dueDate: 1 });

export default mongoose.model("BookIssue", bookIssueSchema);

// models/AuditLog.js — every important action gets recorded here
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorName: String, // denormalized so logs survive if the user is later deleted
    action: { type: String, required: true }, // "STUDENT_ADMITTED", "FEE_PAYMENT_RECORDED", "RESULT_APPROVED"
    targetType: String, // "Student", "Payment", "Result"
    targetId: mongoose.Schema.Types.ObjectId,
    details: mongoose.Schema.Types.Mixed, // free-form snapshot of what changed
    ipAddress: String,
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);

// Helper to call from any controller:
export async function logAction({ actor, action, targetType, targetId, details, req }) {
  try {
    await mongoose.model("AuditLog").create({
      actor: actor._id,
      actorName: actor.fullName,
      action,
      targetType,
      targetId,
      details,
      ipAddress: req?.ip,
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

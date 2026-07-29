// models/Notification.js — in-app notification, one per recipient
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    category: { type: String, enum: ["general", "fees", "exams", "attendance", "library", "emergency"], default: "general" },
    isRead: { type: Boolean, default: false },
    sourceMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);

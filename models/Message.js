// models/Message.js — log of every broadcast sent, with the filter that produced it
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: String,
    body: { type: String, required: true },
    channels: [{ type: String, enum: ["sms", "whatsapp", "email", "in-app"] }],

    // What criteria selected the recipients — kept for audit/reference
    filterCriteria: {
      audience: { type: String, enum: ["all", "students", "parents", "teachers", "class", "individual", "fee-balance"] },
      classId: mongoose.Schema.Types.ObjectId,
      stream: String,
      feeBalanceMin: Number,
      feeBalanceMax: Number,
      userIds: [mongoose.Schema.Types.ObjectId],
    },

    recipientCount: { type: Number, default: 0 },
    deliveryResults: {
      sms: { attempted: Number, sent: Number, failed: Number },
      whatsapp: { attempted: Number, sent: Number, failed: Number },
      email: { attempted: Number, sent: Number, failed: Number },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);

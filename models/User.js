// models/User.js — unified login for every role
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    password: { type: String, required: true, select: false }, // bcrypt hash

    role: {
      type: String,
      enum: ["admin", "teacher", "student", "parent", "librarian", "moderator"],
      required: true,
    },

    // Moderator = Deputy Principal / DOS / Secretary / Bursar / any custom staff role.
    // Title is free text; access is controlled entirely by `permissions`.
    moderatorTitle: { type: String, trim: true }, // only used when role === "moderator"
    permissions: {
      admissions: { type: Boolean, default: false },
      fees: { type: Boolean, default: false },
      remedialFees: { type: Boolean, default: false },
      messaging: { type: Boolean, default: false },
      attendance: { type: Boolean, default: false },
      results: { type: Boolean, default: false },
      library: { type: Boolean, default: false },
      staffManagement: { type: Boolean, default: false },
      settings: { type: Boolean, default: false },
    },

    isActive: { type: Boolean, default: true },

    // Password reset — numeric code flow (kept from the existing pattern)
    resetCode: { type: String, select: false },
    resetCodeExpires: { type: Date, select: false },
    resetCodeAttempts: { type: Number, default: 0, select: false },
    resetCodeChannel: { type: String, enum: ["email", "sms", "whatsapp"], select: false },
    resetCodeLastSentAt: { type: Date, select: false },
    resetToken: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },

    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

export default mongoose.model("User", userSchema);

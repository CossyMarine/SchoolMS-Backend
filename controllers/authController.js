// controllers/authController.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { logAction } from "../models/AuditLog.js";

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Updated cookie configuration to support cross-site setups (e.g., separate frontend/backend domains)
const cookieOptions = {
  httpOnly: true,
  secure: true, // Must be true when sameSite is "none"
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// POST /api/auth/login — single login for every role
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = email, phone, or admission/staff number
    if (!identifier || !password) {
      return res.status(400).json({ message: "Credentials required" });
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Account is disabled — contact the school" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user._id);
    res.cookie("token", token, cookieOptions);

    await logAction({
      actor: user,
      action: "USER_LOGIN",
      targetType: "User",
      targetId: user._id,
      req,
    });

    const { password: _pw, ...safeUser } = user.toObject();
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// POST /api/auth/logout
export const logout = async (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ message: "Logged out" });
};

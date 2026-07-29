// Middlewares/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Verifies the JWT cookie and attaches req.user
export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Account not found or disabled" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
};

// Restrict to specific roles: authorize("admin", "moderator")
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized for this action" });
    }
    next();
  };

// Moderator permission gate. Admin always passes.
// Usage: checkPermission("fees")
export const checkPermission = (permissionKey) => (req, res, next) => {
  if (req.user.role === "admin") return next();

  if (req.user.role === "moderator" && req.user.permissions?.[permissionKey]) {
    return next();
  }

  return res.status(403).json({ message: "You don't have access to this module" });
};

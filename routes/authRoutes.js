// routes/authRoutes.js
import express from "express";
import { login, getMe, logout } from "../controllers/authController.js";
import { protect } from "../Middlewares/auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;

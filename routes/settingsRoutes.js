// routes/settingsRoutes.js
import express from "express";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import { getSettings, updateSettings, getPublicSettings } from "../controllers/settingsController.js";

const router = express.Router();

router.get("/public", getPublicSettings);
router.get("/", protect, authorize("admin"), checkPermission("settings"), getSettings);
router.patch("/", protect, authorize("admin"), checkPermission("settings"), updateSettings);

export default router;

// routes/messageRoutes.js
import express from "express";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import {
  sendMessage, getMessageHistory,
  getMyNotifications, markNotificationRead, markAllNotificationsRead,
} from "../controllers/messageController.js";

const router = express.Router();
router.use(protect);

router.post("/send", authorize("admin", "teacher", "moderator"), checkPermission("messaging"), sendMessage);
router.get("/history", authorize("admin", "moderator"), checkPermission("messaging"), getMessageHistory);

router.get("/notifications", getMyNotifications);
router.patch("/notifications/:id/read", markNotificationRead);
router.patch("/notifications/read-all", markAllNotificationsRead);

export default router;

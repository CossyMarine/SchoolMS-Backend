// routes/attendanceRoutes.js
import express from "express";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import { recordAttendance, getAttendanceForDay, getStudentAttendanceSummary } from "../controllers/attendanceController.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("admin", "teacher", "moderator"), checkPermission("attendance"), recordAttendance);
router.get("/", getAttendanceForDay);
router.get("/student/:studentId/summary", getStudentAttendanceSummary);

export default router;

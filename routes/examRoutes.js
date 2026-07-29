// routes/examRoutes.js
import express from "express";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import { requireSubjectAssignment } from "../Middlewares/teacherScope.js";
import {
  createExam, listExams, getMyTeachingAssignments,
  enterResults, approveExam, getStudentReportCard, getClassResults,
} from "../controllers/examController.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("admin", "moderator"), checkPermission("results"), createExam);
router.get("/", listExams);
router.get("/my-assignments", authorize("teacher"), getMyTeachingAssignments);

router.post("/:examId/results", requireSubjectAssignment, enterResults);
router.post("/:examId/approve", authorize("admin", "moderator"), checkPermission("results"), approveExam);

router.get("/:examId/student/:studentId", getStudentReportCard);
router.get("/:examId/class/:classId", authorize("admin", "teacher", "moderator"), getClassResults);

export default router;

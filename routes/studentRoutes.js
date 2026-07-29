// routes/studentRoutes.js
import express from "express";
import multer from "multer";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import {
  admitStudent,
  listStudents,
  getStudent,
  updateStudent,
  updateGuardians,
  changeStudentClass,
  archiveStudent,
  getMyStudentRecords,
  previewNextAdmissionNumber,
} from "../controllers/studentController.js";
import { importStudents, importTeachers } from "../controllers/importController.js";
import { getStudentSubjects, addStudentElective, removeStudentElective } from "../controllers/subjectAssignmentController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get("/next-admission-number", checkPermission("admissions"), previewNextAdmissionNumber);
router.get("/me", getMyStudentRecords); // student/parent self-service — no admin permission required

router.get("/", checkPermission("admissions"), listStudents);
router.get("/:id", checkPermission("admissions"), getStudent);
router.post("/", checkPermission("admissions"), admitStudent);
router.patch("/:id", checkPermission("admissions"), updateStudent);
router.patch("/:id/guardians", checkPermission("admissions"), updateGuardians);
router.post("/:id/class-change", checkPermission("admissions"), changeStudentClass);
router.patch("/:id/archive", checkPermission("admissions"), archiveStudent);

router.get("/:id/subjects", checkPermission("admissions"), getStudentSubjects);
router.post("/:id/electives", checkPermission("admissions"), addStudentElective);
router.delete("/:id/electives/:subjectId", checkPermission("admissions"), removeStudentElective);
router.post(
  "/import",
  authorize("admin", "moderator"),
  checkPermission("admissions"),
  upload.single("file"),
  importStudents
);
router.post(
  "/import/teachers",
  authorize("admin"),
  upload.single("file"),
  importTeachers
);

export default router;

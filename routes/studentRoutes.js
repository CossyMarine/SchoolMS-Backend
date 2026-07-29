// routes/studentRoutes.js
import express from "express";
import multer from "multer";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import {
  admitStudent,
  listStudents,
  getStudent,
  updateStudent,
  changeStudentClass,
  archiveStudent,
} from "../controllers/studentController.js";
import { importStudents, importTeachers } from "../controllers/importController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get("/", checkPermission("admissions"), listStudents);
router.get("/:id", checkPermission("admissions"), getStudent);
router.post("/", checkPermission("admissions"), admitStudent);
router.patch("/:id", checkPermission("admissions"), updateStudent);
router.post("/:id/class-change", checkPermission("admissions"), changeStudentClass);
router.patch("/:id/archive", checkPermission("admissions"), archiveStudent);

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

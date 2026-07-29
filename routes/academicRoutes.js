// routes/academicRoutes.js
import express from "express";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import {
  createClass, listClasses, updateClass, deleteClass,
  getClassTeachers, setClassTeacher, rebalanceStreams,
  createSubject, listSubjects, updateSubject, deleteSubject,
  getSchoolConfig, updateSchoolConfig, addFeeType, addAcademicYear, setCurrentTerm,
} from "../controllers/academicController.js";
import {
  assignSubjectToClass, listClassSubjects, removeClassSubject,
} from "../controllers/subjectAssignmentController.js";

const router = express.Router();
router.use(protect);

router.get("/classes", listClasses);
router.post("/classes", authorize("admin"), createClass);
router.patch("/classes/:id", authorize("admin"), updateClass);
router.delete("/classes/:id", authorize("admin"), deleteClass);

router.get("/classes/:id/teachers", getClassTeachers);
router.patch("/classes/:id/class-teacher", authorize("admin"), setClassTeacher);
router.post("/classes/:id/rebalance-streams", authorize("admin"), rebalanceStreams);

router.get("/subjects", listSubjects);
router.post("/subjects", authorize("admin"), createSubject);
router.patch("/subjects/:id", authorize("admin"), updateSubject);
router.delete("/subjects/:id", authorize("admin"), deleteSubject);

router.get("/class-subjects", listClassSubjects);
router.post("/class-subjects", authorize("admin"), assignSubjectToClass);
router.delete("/class-subjects/:id", authorize("admin"), removeClassSubject);

router.get("/school-config", getSchoolConfig);
router.patch("/school-config", authorize("admin"), updateSchoolConfig);
router.post("/school-config/fee-types", authorize("admin"), checkPermission("fees"), addFeeType);
router.post("/school-config/academic-years", authorize("admin"), addAcademicYear);
router.patch("/school-config/academic-years/:yearId/set-current", authorize("admin"), setCurrentTerm);

export default router;

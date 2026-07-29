// routes/teacherRoutes.js
import express from "express";
import { protect } from "../Middlewares/auth.js";
import { listTeachers } from "../controllers/teacherController.js";

const router = express.Router();
router.use(protect);
router.get("/", listTeachers);

export default router;

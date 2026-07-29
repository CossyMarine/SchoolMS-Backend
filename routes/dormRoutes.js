// routes/dormRoutes.js
import express from "express";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import { createDorm, listDorms, updateDorm, deleteDorm } from "../controllers/dormController.js";

const router = express.Router();
router.use(protect);

router.get("/", checkPermission("admissions"), listDorms);
router.post("/", authorize("admin"), checkPermission("admissions"), createDorm);
router.patch("/:id", authorize("admin"), checkPermission("admissions"), updateDorm);
router.delete("/:id", authorize("admin"), checkPermission("admissions"), deleteDorm);

export default router;

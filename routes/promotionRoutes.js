// routes/promotionRoutes.js
import express from "express";
import { protect, authorize } from "../Middlewares/auth.js";
import { previewPromotion, runPromotion } from "../controllers/promotionController.js";

const router = express.Router();
router.use(protect);

router.get("/preview", authorize("admin"), previewPromotion);
router.post("/run", authorize("admin"), runPromotion);

export default router;

// routes/feeRoutes.js
import express from "express";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import { generateInvoicesForClass, getStudentStatement, recordPayment, reversePayment } from "../controllers/feeController.js";

const router = express.Router();
router.use(protect);

router.post("/generate-invoices", authorize("admin", "moderator"), checkPermission("fees"), generateInvoicesForClass);
router.get("/student/:studentId", checkPermission("fees"), getStudentStatement);
router.post("/payments", authorize("admin", "moderator"), checkPermission("fees"), recordPayment);
router.post("/payments/:id/reverse", authorize("admin"), reversePayment); // admin-only, deliberately not moderator-delegable

export default router;

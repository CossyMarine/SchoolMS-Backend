// routes/publicRoutes.js
import express from "express";
import { getPublicSchoolInfo } from "../controllers/academicController.js";

const router = express.Router();
router.get("/school-info", getPublicSchoolInfo);

export default router;

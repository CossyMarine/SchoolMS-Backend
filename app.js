// app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import academicRoutes from "./routes/academicRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import feeRoutes from "./routes/feeRoutes.js";
import dormRoutes from "./routes/dormRoutes.js";
import promotionRoutes from "./routes/promotionRoutes.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:3000",
];

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ status: `${process.env.SCHOOL_NAME || "School"} MS backend running` });
});

app.use("/api/auth", authRoutes);
app.use("/api", academicRoutes);        // /api/classes, /api/subjects, /api/school-config
app.use("/api/students", studentRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/dorms", dormRoutes);
app.use("/api/promotions", promotionRoutes);

export default app;

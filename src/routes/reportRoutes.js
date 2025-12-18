import express from "express";
import auth from "../middleware/auth.js";
import { generateReport, getLatestReport, getReportById, getReportHistory } from "../controllers/reportController.js";

const router = express.Router();

router.post("/generate", auth, generateReport);
router.get("/latest", auth, getLatestReport);
router.get("/history", auth, getReportHistory);
router.get("/:id", auth, getReportById);

export default router;
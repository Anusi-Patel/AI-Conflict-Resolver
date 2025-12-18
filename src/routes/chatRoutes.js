import express from "express";
import auth from "../middleware/auth.js";
import { sendMessage, getChatHistory } from "../controllers/chatController.js";

const router = express.Router();

// Send a message (POST /api/chat/message)
router.post("/message", auth, sendMessage);

// Get history for a specific report (GET /api/chat/:report_id)
router.get("/:report_id", auth, getChatHistory);

export default router;
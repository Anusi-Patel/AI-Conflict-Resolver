import express from "express";
import auth from "../middleware/auth.js";
import upload from "../utils/multerUpload.js";
import { uploadAudio, getAudio } from "../controllers/audioController.js";

const router = express.Router();

router.post("/upload", auth, upload.any(), uploadAudio);
router.get("/:audio_id", auth, getAudio);

export default router;

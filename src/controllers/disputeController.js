import Dispute from "../models/Dispute.js";
import AudioFile from "../models/AudioFile.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";
import fs from "fs";

// Helper: Generate Invite Code
const generateCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();

// Helper: AI Judge Logic
const runJudgeAI = async (dispute) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const creatorAudio = await AudioFile.findById(dispute.audio_creator);
  const joinerAudio = await AudioFile.findById(dispute.audio_joiner);

  const parts = [
    { inlineData: { mimeType: creatorAudio.mimetype, data: fs.readFileSync(creatorAudio.file_path).toString("base64") } },
    { inlineData: { mimeType: joinerAudio.mimetype, data: fs.readFileSync(joinerAudio.file_path).toString("base64") } },
    { text: `
      ROLE: You are an impartial Logical Judge.
      INPUT: Audio 1 = Creator. Audio 2 = Joiner.
      TASK: Compare them and output a JSON Verdict.
      JSON STRUCTURE:
      {
        "verdict": "The Creator is correct because...",
        "conclusion": "A neutral summary.",
        "logic_score": { "creator": 85, "joiner": 60 },
        "emotional_intelligence": { "creator": 40, "joiner": 90 },
        "fact_accuracy": { "creator": 80, "joiner": 50 }
      }
    `}
  ];

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  return JSON.parse(result.response.text());
};

// 1. CREATE ROOM
export const createDispute = async (req, res) => {
  try {
    const code = generateCode();
    const dispute = await Dispute.create({
      creator_id: req.user._id,
      invite_code: code,
      status: "OPEN"
    });
    res.status(201).json({ message: "Room created", invite_code: code, dispute_id: dispute._id });
  } catch (err) {
    res.status(500).json({ message: "Failed to create dispute" });
  }
};

// 2. JOIN ROOM
export const joinDispute = async (req, res) => {
  try {
    const { invite_code } = req.body;
    const dispute = await Dispute.findOne({ invite_code, status: "OPEN" });

    if (!dispute) return res.status(404).json({ message: "Invalid code" });
    if (dispute.creator_id.toString() === req.user._id.toString()) return res.status(400).json({ message: "Cannot join your own room" });

    dispute.joiner_id = req.user._id;
    await dispute.save();

    // Socket: Notify Creator that Joiner arrived
    if (req.io) req.io.to(dispute._id.toString()).emit("user_joined", { message: "Opponent has joined!" });

    res.json({ message: "Joined successfully", dispute_id: dispute._id });
  } catch (err) {
    res.status(500).json({ message: "Failed to join" });
  }
};

// 3. START RECORDING (Triggers Timer)
export const startDispute = async (req, res) => {
  try {
    const { dispute_id } = req.body;
    const dispute = await Dispute.findById(dispute_id);

    if (!dispute) return res.status(404).json({ message: "Dispute not found" });
    if (dispute.creator_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Only Creator can start" });
    if (!dispute.joiner_id) return res.status(400).json({ message: "Wait for opponent" });

    dispute.status = "RECORDING";
    await dispute.save();

    // Socket: Start 30s Timer on BOTH phones
    if (req.io) req.io.to(dispute_id).emit("timer_start", { duration: 30 });

    res.json({ message: "Session started", status: "RECORDING" });
  } catch (err) {
    res.status(500).json({ message: "Failed to start" });
  }
};

// 4. SUBMIT VOICE & JUDGE
export const submitVoice = async (req, res) => {
  try {
    const { dispute_id } = req.body;
    const file = req.file;

    const dispute = await Dispute.findById(dispute_id);
    if (!dispute) return res.status(404).json({ message: "Dispute not found" });

    // Save Audio
    const audioDoc = await AudioFile.create({
      user_id: req.user._id,
      file_path: file.path,
      original_name: "dispute_arg.mp3",
      mimetype: file.mimetype,
      size: file.size
    });

    // Assign Audio
    if (req.user._id.toString() === dispute.creator_id.toString()) dispute.audio_creator = audioDoc._id;
    else if (req.user._id.toString() === dispute.joiner_id.toString()) dispute.audio_joiner = audioDoc._id;

    await dispute.save();

    // Socket: Tell everyone someone finished
    if (req.io) req.io.to(dispute_id).emit("status_update", { message: "One user submitted." });

    // CHECK: Are both done?
    if (dispute.audio_creator && dispute.audio_joiner) {
      console.log("Both done. Judging...");
      if (req.io) req.io.to(dispute_id).emit("processing_start", { message: "Judge is analyzing..." });

      dispute.status = "PROCESSING";
      await dispute.save();

      const verdict = await runJudgeAI(dispute);
      dispute.result = verdict;
      dispute.status = "COMPLETED";
      await dispute.save();

      // Socket: VERDICT READY!
      if (req.io) req.io.to(dispute_id).emit("verdict_ready", { status: "COMPLETED", result: verdict });

      return res.json({ message: "Verdict broadcasted" });
    }

    return res.json({ message: "Waiting for opponent" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Submission failed" });
  }
};

// 5. GET DETAILS (For loading screen)
export const getDispute = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id).populate("creator_id joiner_id");
    if (!dispute) return res.status(404).json({ message: "Not found" });
    res.json(dispute);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
};
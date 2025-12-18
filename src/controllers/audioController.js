import AudioFile from "../models/AudioFile.js";
import fs from "fs";

// Upload Audio Handler
export const uploadAudio = async (req, res) => {
  try {
    // 1. Validation: Check if a file was actually sent
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No audio file uploaded" });
    }

    const file = req.files[0];
    console.log(`Processing Upload: ${file.originalname} (${file.mimetype})`);

    // 2. Save to Database (WITH CRITICAL METADATA)
    const audio = await AudioFile.create({
      user_id: req.user._id,
      file_path: file.path,
      original_name: file.originalname,
      
      // FIX: Saving these enables Gemini to read the file later
      mimetype: file.mimetype, 
      size: file.size
    });

    // 3. Respond to Client
    return res.status(201).json({
      message: "Audio uploaded successfully",
      audio: {
        id: audio._id,
        filename: audio.original_name,
        path: audio.file_path,
        mimetype: audio.mimetype,
        uploadedAt: audio.createdAt
      }
    });

  } catch (err) {
    console.error("Audio upload error:", err);
    res.status(500).json({ message: "Server error during file upload" });
  }
};

// Get Single Audio Details
export const getAudio = async (req, res) => {
  try {
    const { audio_id } = req.params;

    const audio = await AudioFile.findById(audio_id);

    if (!audio) {
      return res.status(404).json({ message: "Audio record not found" });
    }

    // Optional: Check if the actual file still exists on disk
    if (!fs.existsSync(audio.file_path)) {
      return res.status(404).json({ message: "File missing from server disk" });
    }

    return res.json({
      message: "Audio found",
      audio: {
        id: audio._id,
        filename: audio.original_name,
        path: audio.file_path,
        mimetype: audio.mimetype,
        size: audio.size,
        created_at: audio.createdAt
      }
    });

  } catch (err) {
    console.error("Get audio error:", err.message);
    res.status(500).json({ message: "Failed to retrieve audio details" });
  }
};

// Delete Audio Handler
export const deleteAudio = async (req, res) => {
  try {
    const { audio_id } = req.params;
    
    // Find the record
    const audio = await AudioFile.findOne({ _id: audio_id, user_id: req.user._id });
    if (!audio) {
      return res.status(404).json({ message: "Audio not found or unauthorized" });
    }

    // 1. Delete file from Disk
    if (fs.existsSync(audio.file_path)) {
      fs.unlinkSync(audio.file_path);
    }

    // 2. Delete record from DB
    await AudioFile.deleteOne({ _id: audio_id });

    res.json({ message: "Audio deleted successfully" });

  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Failed to delete audio" });
  }
};
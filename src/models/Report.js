import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    audio_id: { type: mongoose.Schema.Types.ObjectId, ref: "AudioFile", required: true },

    // 1. FOR HUMANS (Full UI Report - JSON)
    analysis_content: { type: String, required: true },

    // 2. FOR AI MEMORY (Compressed Context - Text)
    // THIS IS CRITICAL for your new Memory Management feature!
    chat_context: { type: String },

    version: { type: Number, default: 1 },
    parent_report_id: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
    model_used: { type: String, default: "gemini-2.5-flash" },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
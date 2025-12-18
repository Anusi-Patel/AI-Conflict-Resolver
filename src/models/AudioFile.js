import mongoose from "mongoose";

const audioSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    file_path: { type: String, required: true },
    original_name: { type: String, required: true },
    
    // ADDED: Critical for Gemini to handle the file correctly
    mimetype: { type: String, required: true, default: "audio/mpeg" }, 
    
    // ADDED: Good practice to track file size
    size: { type: Number }, 

    report_version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("AudioFile", audioSchema);
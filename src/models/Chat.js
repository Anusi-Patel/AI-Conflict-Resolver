import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  report_id: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true },

  phases: [
    {
      phase_number: { type: Number, required: true },
      summary: { type: String, required: true }, // The summary of those 10 turns
      created_at: { type: Date, default: Date.now }
    }
  ],

  messages: [
    {
      role: { type: String, enum: ["user", "model"], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ],

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Chat", chatSchema);
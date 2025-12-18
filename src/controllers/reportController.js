import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import AudioFile from "../models/AudioFile.js";
import Report from "../models/Report.js";
import path from "path";

// Helper: Convert file to Base64 for Gemini
function fileToGenerativePart(pathStr, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(pathStr)).toString("base64"),
      mimeType
    },
  };
}

// Helper: Clean JSON string (remove markdown wrappers)
function cleanJSON(text) {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// =====================================================
// 1. GENERATE REPORT (Dual Output + Memory)
// =====================================================
export const generateReport = async (req, res) => {
  try {
    const { audio_id, parent_report_id } = req.body;

    if (!audio_id) return res.status(400).json({ message: "audio_id required" });

    // Fetch audio
    const audio = await AudioFile.findOne({ _id: audio_id, user_id: req.user._id });
    if (!audio) return res.status(404).json({ message: "Audio not found or access denied" });
    if (!fs.existsSync(audio.file_path))
      return res.status(404).json({ message: "Audio file missing from disk" });

    // Recursive Context Logic
    let contextPrompt = "";
    let newVersion = 1;

    if (parent_report_id) {
      const previousReport = await Report.findOne({
        _id: parent_report_id,
        user_id: req.user._id
      });

      if (previousReport) {
        console.log(`🔗 Linking previous report v${previousReport.version}`);
        newVersion = previousReport.version + 1;

        // ⚡ MEMORY OPTIMIZATION: Use chat_context first
        const previousContextData =
          previousReport.chat_context || previousReport.analysis_content;

        contextPrompt = `
        === PREVIOUS CONTEXT SUMMARY ===
        ${previousContextData}
        ==========================================
        INSTRUCTIONS:
        The new audio file continues the same story.
        1. Compare new events with the context above.
        2. Identify escalation or improvement.
        3. Adjust psychological analysis.
        `;
      } else {
        console.warn(`Parent report ${parent_report_id} not found. Starting fresh chain.`);
      }
    }

    // ============================================================
    // FINAL PROMPT — Dual Output (JSON Report + Text Memory)
    // ============================================================
    const finalPrompt = `
      ${contextPrompt}

      ROLE: Expert Conflict Resolution Specialist.

      TASK: Analyze the audio in TWO OUTPUT PARTS.
      Separate them with this EXACT separator:
      "|||AI_MEMORY_SEPARATOR|||"

      ============================================================
      PART 1 — STRICT JSON REPORT (NO MARKDOWN)
      ============================================================
      RULES FOR SPEAKERS:
      - Identify speakers by NAME ONLY if clearly spoken.
      - Otherwise use "Speaker 1", "Speaker 2".
      - Don't guess names from context.

      Return JSON ONLY:
      {
        "executive_summary": "",
        "speaker_dynamics": {
          "identified_speakers": [
            {
              "label": "Name or Speaker #",
              "emotional_state": "",
              "psychology_analysis": ""
            }
          ]
        },
        "root_cause_analysis": "",
        "conflict_score": {
          "score": 0,
          "justification": ""
        },
        "strategic_resolution_plan": {
          "immediate_action": "",
          "psychological_techniques": "",
          "long_term_fix": ""
        },
        "version_reference": "${newVersion}",
        "has_previous_context": ${parent_report_id ? "true" : "false"}
      }

      |||AI_MEMORY_SEPARATOR|||

      ============================================================
      PART 2 — AI MEMORY (PLAIN TEXT, < 200 WORDS)
      ============================================================
      Include ONLY:
      - Speakers & roles
      - Current emotional state
      - The conflict summary
      - Key events
      - No JSON. No lists. Just plain concise text.
    `;

    console.log(`Sending ${audio.original_name} to Gemini...`);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.5-flash" },
      { timeout: 300000 }
    );

    const mimeType = audio.mimetype || "audio/mpeg";
    const audioPart = fileToGenerativePart(audio.file_path, mimeType);

    const result = await model.generateContent([finalPrompt, audioPart]);
    const response = await result.response;
    const fullText = response.text();

    console.log("Gemini Analysis Complete!");

    // ===============================
    // SPLIT OUTPUT
    // ===============================
    const parts = fullText.split("|||AI_MEMORY_SEPARATOR|||");

    let rawJson = cleanJSON(parts[0]?.trim() || "");
    let aiMemory = parts[1]?.trim() || rawJson.substring(0, 500);

    // ===============================
    // SAVE TO DATABASE
    // ===============================
    const newReport = await Report.create({
      user_id: req.user._id,
      audio_id: audio._id,
      analysis_content: rawJson, // The Big JSON
      chat_context: aiMemory,    // The Small Memory
      version: newVersion,
      parent_report_id: parent_report_id || null
    });

    // ===============================
    // SAVE JSON REPORT TO DISK (Optional but useful for you)
    // ===============================
    try {
      const reportsDir = path.join(process.cwd(), "reports");
      if (!fs.existsSync(reportsDir))
        fs.mkdirSync(reportsDir, { recursive: true });

      const jsonFilename = `report-${newReport._id}.json`;
      const jsonPath = path.join(reportsDir, jsonFilename);

      fs.writeFileSync(
        jsonPath,
        JSON.stringify(JSON.parse(rawJson), null, 2)
      );

      console.log(`✔ Report JSON saved at ${jsonPath}`);
    } catch (error) {
      console.error("⚠ Failed saving JSON report:", error.message);
    }

    return res.json({ message: "Report generated", report: newReport });

  } catch (err) {
    console.error("Generate Error:", err.message);
    return res
      .status(500)
      .json({ message: "Failed to generate report", error: err.message });
  }
};

// ======== GETTERS ========

export const getLatestReport = async (req, res) => {
  try {
    const report = await Report.findOne({ user_id: req.user._id })
      .sort({ createdAt: -1 })
      .populate("audio_id", "original_name");

    if (!report) return res.status(404).json({ message: "No reports found" });

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getReportById = async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      user_id: req.user._id
    }).populate("audio_id", "original_name");

    if (!report) return res.status(404).json({ message: "Report not found" });

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getReportHistory = async (req, res) => {
  try {
    const reports = await Report.find({ user_id: req.user._id })
      .sort({ createdAt: -1 })
      .select("version createdAt audio_id")
      .populate("audio_id", "original_name");

    res.json({ reports });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch history" });
  }
};
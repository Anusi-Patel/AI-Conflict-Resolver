import fs from "fs";
import genAI from "../utils/gemini.js";
import path from "path";

export const processAudioWithGemini = async (filePath) => {
  try {
    // 1. Load audio file as base64
    const audioBuffer = fs.readFileSync(filePath);
    const base64Audio = audioBuffer.toString("base64");

    // 2. Choose model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // 3. Construct prompt
    const prompt = `
You are an expert conflict analysis system.

Given this audio conversation, provide a detailed JSON response containing:

{
  "transcript": "...",
  "speakers": [
      { "start": "", "end": "", "speaker": "A or B", "text": "" }
  ],
  "issues": [
      { "title": "", "description": "", "severity": 1-10 }
  ],
  "emotions": {
      "person_a": { "dominant": "", "tone": "" },
      "person_b": { "dominant": "", "tone": "" }
  },
  "recommendations": {
      "for_person_a": [...],
      "for_person_b": [...],
      "general": [...]
  },
  "summary": ""
}

Follow this EXACT JSON structure with valid JSON only.
`;

    // 4. Send request to Gemini
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "audio/mp3",
                data: base64Audio,
              },
            },
          ],
        },
      ],
    });

    // 5. Parse JSON output
    const responseText = result.response.text();

    let jsonOutput;
    try {
      jsonOutput = JSON.parse(responseText);
    } catch (error) {
      console.error("Gemini JSON parse error:", error);
      jsonOutput = { error: "Invalid JSON returned by Gemini", raw: responseText };
    }

    return jsonOutput;

  } catch (err) {
    console.error("Gemini processing error:", err);
    return { error: "Gemini failed to process audio" };
  }
};
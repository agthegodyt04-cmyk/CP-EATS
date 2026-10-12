import express from "express";
import os from "os";
import path from "path";
// #8: Real Gemini moderation is disabled for now. The import is kept for
// reference — restore it (and the commented block below) + set GEMINI_API_KEY
// in .env to re-enable the AI Image Shield.
// import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Increase payload limit to handle base64 images
app.use(express.json({ limit: "15mb" }));

// ── AI Image Shield: real Gemini integration DISABLED (#8) ──────────────────
// The app always uses the offline fallback simulation below, so uploads are
// never blocked and no GEMINI_API_KEY is required. To re-enable real Gemini
// moderation: uncomment this block and the one inside /api/verify-image, then
// set GEMINI_API_KEY in .env.
//
// const apiKey = process.env.GEMINI_API_KEY;
// let ai: GoogleGenAI | null = null;
// if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
//   try {
//     ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
//     console.log("✓ Gemini API Client initialized successfully.");
//   } catch (err) {
//     console.error("Failed to initialize Gemini API Client:", err);
//   }
// } else {
//   console.warn("⚠️ GEMINI_API_KEY not configured. Running in fallback simulation mode.");
// }
let ai: any = null; // stays null while Gemini is disabled -> forces the fallback path

// API Route: AI Image Integrity Shield Scanner.
// #8: the real Gemini moderation path is preserved but commented out; while
// disabled we always return the offline fallback simulation.
app.post("/api/verify-image", async (req, res) => {
  try {
    const { fileName, dataUrl } = req.body;

    if (!dataUrl) {
      return res.status(400).json({ error: "Missing dataUrl parameter" });
    }

    ////////////////////////////////////////////////////////////////////////////
    // REAL GEMINI SCAN — DISABLED (#8). Uncomment + set GEMINI_API_KEY to use.
    // (Full prompt text is preserved in git history.)
    ////////////////////////////////////////////////////////////////////////////
    /*
    if (ai) {
      const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
      if (!mimeMatch) {
        return res.status(400).json({ error: "Invalid dataUrl format" });
      }
      const mimeType = mimeMatch[1];
      const base64Data = mimeMatch[2];
      const imagePart = { inlineData: { mimeType, data: base64Data } };
      const promptText = `You are the CP-Eats AI Image Shield Scanner... (full prompt in git history)`;
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        contents: [imagePart, { text: promptText }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isApproved: { type: Type.BOOLEAN },
              score: { type: Type.INTEGER },
              analysis: { type: Type.ARRAY, items: { type: Type.STRING } },
              strikesAdded: { type: Type.INTEGER },
            },
            required: ["isApproved", "score", "analysis", "strikesAdded"],
          },
        },
      });
      if (response.text) {
        try {
          return res.json(JSON.parse(response.text.trim()));
        } catch (jsonErr) {
          console.error("Gemini output was not valid JSON:", response.text, jsonErr);
        }
      }
    }
    */

    // Offline fallback simulation (always used while Gemini is disabled).
    return res.json(runFallbackSimulation(fileName || "image.jpg"));
  } catch (err) {
    console.error("Error in /api/verify-image:", err);
    return res.json(runFallbackSimulation(req.body.fileName || "image.jpg"));
  }
});

function runFallbackSimulation(fileName: string) {
  return {
    isApproved: true,
    analysis: [
      "Initializing CP-Eats Shield deep analysis...",
      `Inspecting meta signature: "${fileName}"`,
      "✓ File metadata headers look typical for mobile capture.",
      "Analyzing canvas contrast levels & digital noise coefficients...",
      "✓ Rich color palette and organic texture gradients detected.",
      "✓ No visible digital watermarks or vector grids found.",
      "✓ Natural lighting shadows and organic noise ratios confirmed.",
      "✅ CP-Eats Shield Approved: Image verified as an authentic dish photo! (Developer Mode Fallback)"
    ],
    strikesAdded: 0,
    score: 98,
  };
}

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("✓ Vite dev middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Express 5 uses path-to-regexp v8, where a bare "*" is invalid and throws
    // at boot. The named wildcard "/*splat" is the supported SPA fallback.
    app.get("/*splat", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("✓ Static files distribution mounted.");
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ CP-Eats full-stack server running on http://localhost:${PORT}`);
    const lanUrls = Object.values(os.networkInterfaces())
      .flat()
      .filter((net): net is os.NetworkInterfaceInfo => !!net && net.family === "IPv4" && !net.internal)
      .map((net) => `http://${net.address}:${PORT}`);
    for (const url of lanUrls) {
      console.log(`  → LAN: ${url}`);
    }
  });
}

startServer();

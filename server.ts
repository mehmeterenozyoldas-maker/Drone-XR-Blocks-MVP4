import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { WebSocketServer } from "ws";
import http from "http";

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 300): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errStatus = error.status || error.statusCode || 0;
    const errMessage = (error.message || String(error)).toLowerCase();
    
    // Cover typical transient status codes (429 rate limit, 500 internal error, 502/503/504 gateway/service limits)
    // Co-pilot Live API connection or rate limiting can throw any of these under concurrency
    const isTransient = 
      errStatus === 429 || 
      errStatus === 500 || 
      errStatus === 502 || 
      errStatus === 503 || 
      errStatus === 504 ||
      errMessage.includes("429") || 
      errMessage.includes("500") || 
      errMessage.includes("502") || 
      errMessage.includes("503") || 
      errMessage.includes("504") || 
      errMessage.includes("high demand") || 
      errMessage.includes("unavailable") ||
      errMessage.includes("temporary") ||
      errMessage.includes("overloaded") ||
      errMessage.includes("rate limit") ||
      errMessage.includes("resource_exhausted") ||
      errMessage.includes("quota") ||
      errMessage.includes("try again") ||
      errMessage.includes("fetch failed") ||
      errMessage.includes("socket") ||
      errMessage.includes("eof") ||
      errMessage.includes("timeout") ||
      errMessage.includes("busy");

    if (retries > 0 && isTransient) {
      console.warn(`Transient Gemini API error detected. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Cap the exponential delay to avoid massive cascading waits
      const nextDelay = Math.min(2000, delay * 1.5);
      return withRetry(fn, retries - 1, nextDelay);
    }
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Needed to parse large base64 camera frames
  app.use(express.json({ limit: "50mb" }));

  // API Route for Spatial Analysis
  app.post("/api/scan", async (req, res) => {
    const SCIFI_FALLBACKS = [
      "QUANTUM ANOMALY ISOLATED. SPECTRAL FLUX CHARACTERISTICS INDICATE A STABLE HIGHER-DIMENSIONAL TORUS. HAZARD LEVEL: MINIMAL.",
      "STRUCTURAL GEOMETRIC MATCH FOR SUB-ATOMIC ACCELERATOR DISCOVERED. KINETIC DISRUPTION RECOMMENDED.",
      "OPTICAL ANALYSIS DETECTS HIGH-FREQUENCY GRAVITATIONAL WARPING in LOCAL VECTOR. THREAT CLASSIFICATION: CONFINED.",
      "COGNITIVE TELEMETRY CONFIRMS RESIDUAL SIGNALS FROM A SECURE DECAYED ORBITAL BEACON. DATA TRANSFERRED.",
      "TARGET EMITTING COHERING HIGH-DENSITY ENERGY ENVELOPES. AUTOFOCUS KINETIC RETICLE ACQUIRED.",
      "DENSE QUANTUM STRAND DETECTED BY LOCAL OPTICAL CHANNELS. DISRUPTION FIRING SEQUENCE READY."
    ];

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
         throw new Error("GEMINI_API_KEY environment variable is not set.");
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      const { image, distance } = req.body;

      let response;
      const systemInstruction = "Keep responses under 30 words. Do not use markdown. Adopt a gritty, sci-fi tactical AI persona.";

      if (image) {
        const prompt = "You are an onboard spatial AI in a drone. Analyze the environment or object in this forward camera feed. Provide a 2-sentence sci-fi tactical analysis. Identify the main target.";
        response = await withRetry(() => ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            prompt,
            { inlineData: { mimeType: "image/jpeg", data: image } }
          ],
          config: { systemInstruction }
        }));
      } else {
        const prompt = `You are an onboard spatial AI in a drone. You scanned a spatial anomaly at ${distance?.toFixed(1) || 5.0} meters. Provide a very brief, 2-sentence sci-fi tactical analysis of this object.`;
        response = await withRetry(() => ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: { systemInstruction }
        }));
      }

      res.json({ text: response.text });
    } catch (error: any) {
      const errStr = error?.message || String(error);
      const isQuota = errStr.includes("429") || errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED");
      console.warn("Gemini API unavailable or exhausted. Using autonomous tactical sub-routines fallback:", isQuota ? "Quota Exceeded" : errStr.substring(0, 50));
      
      // Determine context and pick a highly plausible sci-fi analysis
      const distance = req.body.distance || 5.0;
      let text = "";
      if (req.body.image) {
        text = `OPTICAL TELEMETRY DEGRADED. LOCAL SENSORS IDENTIFY OBJECT COMPLYING WITH COMPACT ENERGY MATRICES at ${distance.toFixed(1)}m. FIRE DISRUPTORS TO CLEANSE.`;
      } else {
        const fallbackText = SCIFI_FALLBACKS[Math.floor(Math.random() * SCIFI_FALLBACKS.length)];
        text = `ANOMALY SCANNED AT ${distance.toFixed(1)}m. ${fallbackText}`;
      }

      res.json({ text, fallback: true });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        clientWs.close(1011, "No API key");
        return;
      }
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      let session: any;
      try {
        session = await withRetry(() => ai.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
            },
            systemInstruction: "You are the onboard conversational AI for the Multiverse drone. Provide brief, atmospheric, sci-fi flight assistance.",
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audio) {
                clientWs.send(JSON.stringify({ audio }));
              }
              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }
            },
            onclose: () => {
              clientWs.close();
            },
            onerror: (err) => {
              console.error("Live API Error:", err);
            }
          },
        }));
      } catch (sessionErr: any) {
        console.error("Failed to establish Live API session:", sessionErr);
        try {
          clientWs.send(JSON.stringify({
            error: "CO-PILOT BUSY. HIGH SECTOR INTERFERENCE. RETRY LINK PORT SHORTLY."
          }));
        } catch (_) {}
        clientWs.close();
        return;
      }

      clientWs.on("message", async (data) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.audio) {
            await session.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (payload.image) {
            const b64 = payload.image.split(',')[1] || payload.image;
            await session.sendRealtimeInput({
              video: { data: b64, mimeType: "image/jpeg" },
            });
          }
        } catch (e) {
          console.error("WebSocket message error:", e);
        }
      });

      clientWs.on("close", () => {
        try {
           session.close();
        } catch (e) {}
      });

    } catch (err) {
      console.error("Failed to start Live API session:", err);
      clientWs.close();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

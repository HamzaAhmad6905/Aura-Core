import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateAuraReply, getGeminiApiKey, parseChatPayload } from "./chat-core.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

function applyCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { messages, language } = parseChatPayload(req.body);
    const text = await generateAuraReply(messages, language);
    return res.status(200).json({ text });
  } catch (err) {
    console.warn("Chat handler error:", err instanceof Error ? err.message : err);
    if (!getGeminiApiKey()) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured. Add it to the Vercel project's environment variables and redeploy.",
      });
    }
    return res.status(502).json({
      error: err instanceof Error
        ? `Gemini request failed: ${err.message.slice(0, 400)}`
        : "Gemini request failed. Check the Vercel function logs.",
    });
  }
}

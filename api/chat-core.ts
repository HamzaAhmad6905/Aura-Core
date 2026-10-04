import { GoogleGenAI } from "@google/genai";

export type ChatTurn = { role: string; text: string };

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

export function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  );
}

function systemInstruction(lang: string) {
  return `You are Aura Core, an ultra-intelligent, calm, warm voice-first multimodal assistant. Reply concisely in 1 to 2 clear, natural spoken sentences. Respond in ${lang}. Do not use markdown bullet lists, asterisks, or formatting because your answer will be spoken aloud to the user.`;
}

function toContents(messages: ChatTurn[]) {
  const mapped = messages
    .filter(m => m?.text?.trim())
    .map(m => ({
      role: m.role === "model" || m.role === "assistant" || m.role === "aura" ? "model" : "user",
      parts: [{ text: m.text }],
    }));
  return mapped.length ? mapped : [{ role: "user", parts: [{ text: "Hello Aura Core" }] }];
}

async function generateWithGenAi(apiKey: string, messages: ChatTurn[], lang: string): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: toContents(messages),
        config: {
          systemInstruction: systemInstruction(lang),
        },
      });
      const text = result.text?.trim();
      if (text) return text;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini generation failed");
}

export async function generateAuraReply(messages: ChatTurn[], language: string): Promise<string> {
  const lang = language || "en-US";
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Set it in the server environment and redeploy.");
  }
  return generateWithGenAi(apiKey, messages, lang);
}

export function parseChatPayload(raw: unknown): { messages: ChatTurn[]; language: string } {
  let body = raw;
  if (typeof raw === "string") {
    try {
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const messages = Array.isArray(record.messages) ? (record.messages as ChatTurn[]) : [];
  const language = typeof record.language === "string" ? record.language : "en-US";
  return { messages, language };
}

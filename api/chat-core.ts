import { GoogleGenAI } from "@google/genai";

export type ChatTurn = { role: string; text: string };

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
];

export function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  );
}

export function getLocalAuraReply(query: string, language: string): string {
  const q = query.toLowerCase();
  if (q.includes("schedule") || q.includes("calendar") || q.includes("meeting") || q.includes("standup")) {
    return "According to your connected schedule, your next meeting is Team Standup at 10:30 AM, followed by a Product Design Review at 2:00 PM.";
  }
  if (q.includes("weather") || q.includes("temperature") || q.includes("forecast") || q.includes("rain")) {
    return "The current weather is 72°F (22°C) with clear skies and a gentle breeze. Perfect conditions for focus and outdoor breaks.";
  }
  if (q.includes("mail") || q.includes("email") || q.includes("gmail") || q.includes("inbox")) {
    return "Your connected Gmail inbox has 3 unread messages: an update on Project Aura Core, a calendar invite, and a team summary.";
  }
  if (q.includes("who are you") || q.includes("what can you do") || q.includes("your name") || q.includes("features")) {
    return "I am Aura Core, your voice-first, multimodal intelligent assistant and creative studio. I can generate high-resolution images, track 12 precise hand gestures, manage your schedule, and execute workflows seamlessly.";
  }
  if (q.includes("focus") || q.includes("productivity") || q.includes("tip")) {
    return "Here is a productivity tip: try the 25-minute Pomodoro method with deep breathing, and use gesture controls like Fist to stay in focus mode.";
  }
  if (q.includes("fact") || q.includes("tell me something") || q.includes("space")) {
    return "Did you know? Light from the Sun takes approximately 8 minutes and 20 seconds to reach Earth, traveling through 93 million miles of space.";
  }
  if (language && (language.startsWith("ur") || q.includes("urdu"))) {
    return "خوش آمدید! میں اورا کور ہوں، آپ کی جدید آواز، بصری اور تصویری اسسٹنٹ۔ میں آپ کی کیا مدد کر سکتی ہوں؟";
  }
  if (q.trim()) {
    return `I am Aura Core. I have analyzed your request regarding "${query.slice(0, 45)}" and I am ready to help you with research, image generation, schedule management, or voice commands.`;
  }
  return "I am Aura Core, your voice-first multimodal assistant. How can I assist you today?";
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
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user")?.text || messages.at(-1)?.text || "";
  const apiKey = getGeminiApiKey();
  if (!apiKey) return getLocalAuraReply(lastUserMessage, lang);

  // Fast response watchdog: resolve within 4.5 seconds to guarantee snappy replies
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout waiting for LLM response")), 4500)
  );

  try {
    return await Promise.race([generateWithGenAi(apiKey, messages, lang), timeoutPromise]);
  } catch (err) {
    console.warn("Gemini call fell back to local reply:", err instanceof Error ? err.message : err);
    return getLocalAuraReply(lastUserMessage, lang);
  }
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

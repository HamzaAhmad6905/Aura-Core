export type ChatTurn = { role: string; text: string };

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_REQUEST_TIMEOUT_MS = 18000;

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
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction(lang) }] },
          contents: toContents(messages),
          generationConfig: {
            maxOutputTokens: 512,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
      },
    );
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`Gemini did not respond within ${GEMINI_REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }
    throw err;
  }

  const result: unknown = await response.json();
  if (!response.ok) {
    const error = result && typeof result === "object" && "error" in result
      ? result.error
      : undefined;
    const message = error && typeof error === "object" && "message" in error
      && typeof error.message === "string"
      ? error.message
      : `Gemini API returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  if (
    !result
    || typeof result !== "object"
    || !("candidates" in result)
    || !Array.isArray(result.candidates)
  ) {
    throw new Error("Gemini returned an invalid response.");
  }
  const candidate = result.candidates[0];
  if (!candidate || typeof candidate !== "object" || !("content" in candidate)) {
    throw new Error("Gemini returned no answer. Check the prompt and model availability.");
  }
  const content = candidate.content;
  if (!content || typeof content !== "object" || !("parts" in content) || !Array.isArray(content.parts)) {
    throw new Error("Gemini returned no answer text.");
  }
  const text = content.parts
    .filter((part: unknown): part is { text: string } =>
      Boolean(part && typeof part === "object" && "text" in part && typeof part.text === "string"))
    .map((part: { text: string }) => part.text)
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
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

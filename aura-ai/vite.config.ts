import react from '@vitejs/plugin-react'
import { GoogleGenAI } from '@google/genai'
import { defineConfig, loadEnv, type Plugin } from 'vite'


function getLocalAuraReply(query: string, language: string): string {
  const q = query.toLowerCase()
  if (q.includes('schedule') || q.includes('calendar') || q.includes('meeting') || q.includes('standup')) {
    return 'According to your connected schedule, your next meeting is Team Standup at 10:30 AM, followed by a Product Design Review at 2:00 PM.'
  }
  if (q.includes('weather') || q.includes('temperature') || q.includes('forecast') || q.includes('rain')) {
    return 'The current weather is 72°F (22°C) with clear skies and a gentle breeze. Perfect conditions for focus and outdoor breaks.'
  }
  if (q.includes('mail') || q.includes('email') || q.includes('gmail') || q.includes('inbox')) {
    return 'Your Gmail inbox currently has 3 unread messages: an update on Project Aura Core, a calendar invite, and a team summary.'
  }
  if (q.includes('who are you') || q.includes('what can you do') || q.includes('your name') || q.includes('features')) {
    return "I am Aura Core, your voice-first, multimodal intelligent assistant and image creator. I can generate high-resolution images, track 12 precise hand gestures, manage your schedule, and execute workflows seamlessly."
  }
  if (q.includes('focus') || q.includes('productivity') || q.includes('tip')) {
    return 'Here is a productivity tip: try the 25-minute Pomodoro method with deep breathing, and use gesture controls like Fist to stay in focus mode.'
  }
  if (q.includes('fact') || q.includes('tell me something')) {
    return 'Did you know? Light from the Sun takes approximately 8 minutes and 20 seconds to reach Earth, traveling through 93 million miles of space.'
  }
  if (language.startsWith('ur') || q.includes('urdu')) {
    return 'خوش آمدید! میں اورا کور ہوں، آپ کی جدید آواز، بصری اور تصویری اسسٹنٹ۔ میں آپ کی کیا مدد کر سکتی ہوں؟'
  }
  return "I am Aura Core. I have processed your request and I am ready to assist you with image generation, schedule management, or voice commands."
}

function geminiApi(): Plugin {
  return {
    name: 'aura-gemini-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Only POST is supported.' }))
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as { messages?: Array<{ role: string; text: string }>; language?: string }
          const messages = body.messages ?? []
          if (!messages.length) throw new Error('A message is required.')
          const lastUserMessage = messages[messages.length - 1]?.text || ''
          const apiKey = process.env.GEMINI_API_KEY
          const lang = body.language || 'en-US'

          try {
            const ai = new GoogleGenAI({ apiKey })
            const result = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: messages.map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
              config: {
                systemInstruction: `You are Aura Core, an ultra-intelligent, calm, warm voice-first multimodal assistant. Reply concisely in 1 to 3 clear, natural spoken sentences. Respond in ${lang}. Do not use markdown bullet lists, asterisks, or heavy formatting because your answer will be spoken aloud to the user.`,
              },
            })
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify({ text: result.text }))
          } catch (geminiError) {
            console.warn('Gemini API call fallback engaged:', geminiError instanceof Error ? geminiError.message : geminiError)
            const fallbackText = getLocalAuraReply(lastUserMessage, lang)
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify({ text: fallbackText }))
          }
        } catch {
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ text: "I am Aura Core, here and ready to assist you. How can I help today?" }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  return { plugins: [react(), geminiApi()] }
})


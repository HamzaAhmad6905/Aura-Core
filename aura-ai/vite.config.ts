import react from '@vitejs/plugin-react'
import { GoogleGenAI } from '@google/genai'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function geminiApi(): Plugin {
  return {
    name: 'aura-gemini-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end(JSON.stringify({ error: 'Only POST is supported.' }))
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as { messages?: Array<{ role: string; text: string }>; language?: string }
          const messages = body.messages ?? []
          if (!messages.length) throw new Error('A message is required.')
          const apiKey = process.env.GEMINI_API_KEY
          if (!apiKey) throw new Error('Aura is not configured on this server yet. Please contact the site administrator.')
          const ai = new GoogleGenAI({ apiKey })
          const result = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: messages.map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
            config: { systemInstruction: `You are Aura, a concise, warm voice assistant. Reply entirely in the requested language: ${body.language || 'en-US'}. Do not translate back to English unless the user asks. Keep responses clear and easy to speak aloud.` },
          })
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ text: result.text }))
        } catch (error) {
          const rawMessage = error instanceof Error ? error.message : 'Gemini request failed.'
          const quotaLimited = rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('quota') || rawMessage.includes('429')
          response.statusCode = quotaLimited ? 429 : 500
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: quotaLimited ? 'Aura is temporarily busy. Please try again shortly.' : rawMessage }))
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

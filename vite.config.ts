import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { generateAuraReply, getGeminiApiKey, parseChatPayload } from './api/chat-core.js'

function geminiApi(): Plugin {
  const handleChat = async (request: import('http').IncomingMessage, response: import('http').ServerResponse) => {
    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      response.end()
      return
    }
    if (request.method !== 'POST') {
      response.statusCode = 405
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ error: 'Only POST is supported.' }))
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    try {
      const { messages, language } = parseChatPayload(JSON.parse(Buffer.concat(chunks).toString() || '{}'))
      const text = await generateAuraReply(messages, language)
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/json')
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.end(JSON.stringify({ text }))
    } catch (err) {
      console.warn('Local /api/chat request failed:', err)
      response.statusCode = getGeminiApiKey() ? 502 : 503
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({
        error: getGeminiApiKey()
          ? 'Aura could not get a reply from Gemini. Check the server logs and verify the API key and model access.'
          : 'GEMINI_API_KEY is not configured. Add it to your local server environment and restart the server.',
      }))
    }
  }

  return {
    name: 'aura-gemini-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', handleChat)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/chat', handleChat)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY
  process.env.GOOGLE_API_KEY = env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY
  return {
    plugins: [react(), geminiApi()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: true,
    },
  }
})

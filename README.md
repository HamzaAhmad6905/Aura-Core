# Aura AI

Aura is a voice-first, multimodal assistant built with React, TypeScript, and Vite. The current prototype combines Gemini chat, browser speech input/output, local MediaPipe hand tracking, animated UI, and provider connection controls.

## Run locally

```bash
npm install
```

Create `aura-ai/.env` from `.env.example` and set the **server-only** Gemini key:

```env
GEMINI_API_KEY=YOUR_PRIVATE_GEMINI_KEY
```

Do **not** add this key to React code, `VITE_*` variables, screenshots, or Git. `.gitignore` already excludes local environment files.

Start Aura:

```bash
npm run dev
```

Open the local Vite URL shown in the terminal.

## Important: users never enter the Gemini API key

Aura sends chat requests to `/api/chat`. The Gemini SDK is initialized in `vite.config.ts` on the server side using `process.env.GEMINI_API_KEY`. The browser does not receive the private key and the UI does not contain a key-entry form.

For a public deployment, configure `GEMINI_API_KEY` as a **secret/environment variable in the hosting provider**. Do not hard-code the key into the repository. The current `/api/chat` implementation is a Vite development-server middleware, so a production deployment must use a host/runtime that runs this server-side endpoint or move the same handler to the platform's server/API function.

## Welcome audio and browser autoplay

Aura attempts to play `public/welcome-to-aura.mp3` as soon as the welcome dialog is shown and then plays `public/futuristic-intro.wav`. Modern browsers can block audible autoplay until the user interacts with the page. When that happens, clicking **Enter Aura** starts the welcome sequence from the user gesture.

## Voice controls

- The microphone button starts/stops browser speech recognition.
- The assistant automatically speaks model replies when voice output is enabled.
- **Stop** immediately cancels the current spoken response.
- The Voice Mode quick control toggles speech output mute.
- Language and installed system voices can be selected from the conversation panel.

## Build and lint

```bash
npm run build
npm run lint
```

## Security notes

- Never commit `.env` or private provider credentials.
- OAuth client IDs may be public, but OAuth secrets and user refresh/access tokens must stay server-side.
- Camera and microphone access are explicit browser permissions.
- Production external actions should use server-side authorization, typed tool schemas, confirmation gates, and audit logging.

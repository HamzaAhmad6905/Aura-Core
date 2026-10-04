# Product Requirements Document (PRD)

## Aura AI — Voice, Vision, Creative Studio, and Agentic Assistant

**Document status:** Updated prototype baseline and prototype-to-production roadmap  
**Version:** 1.1  
**Date:** September 13, 2026  
**Product:** Aura AI  
**Repository:** `HamzaAhmad6905/Aura-Core`  
**Primary audience:** Product, engineering, design, security, QA, and deployment teams

---

## 1. Product Summary

Aura AI is a browser-based, voice-first multimodal assistant that combines natural-language conversation, speech input/output, webcam hand-gesture control, creative image generation workflows, and service-connection surfaces in one futuristic workspace.

The current prototype is implemented with React 19, TypeScript, and Vite. The UI provides an animated welcome experience, time-aware greeting, voice interaction, multilingual controls, local hand-landmark processing with MediaPipe Tasks Vision, a conversation workspace, an image-creation studio, activity/automation views, notification controls, and a Connections surface for productivity and media providers.

Gemini requests are routed through the server-side `/api/chat` development middleware. The Gemini credential is supplied through the server environment (`GEMINI_API_KEY`) and is not intended to be exposed in browser code or committed to the repository. When the model request fails, the prototype can return a deterministic local Aura response so the interface remains usable.

The product goal is to evolve Aura from a polished multimodal prototype into a secure, reliable assistant that can understand user intent, respond naturally by text or voice, interpret selected gestures, create useful visual content, and execute approved actions across connected services.

---

## 2. Current Prototype Capabilities

The current implementation now includes the following user-facing capabilities:

- Futuristic animated welcome screen with a prominent **Enter Aura** interaction.
- Unified cinematic dark/cyan visual language across the main application.
- Time-aware greeting and welcome messaging.
- Welcome speech attempt when the experience opens, with browser autoplay limitations handled by retrying after user interaction.
- Browser speech recognition for voice input.
- Browser speech synthesis with language/voice selection.
- A visible **Stop Speaking** control while Aura is speaking.
- Improved microphone control with a clearer SVG microphone icon and listening state.
- Text conversation with suggestions, send controls, timestamps, and persisted session data.
- Local browser settings for voice output, persisted chat, gesture automation, and sound effects.
- Camera enable/disable controls and local MediaPipe hand-landmark processing.
- Twelve-gesture prototype recognition, including directional swipe behavior and common hand poses.
- Visible gesture/action status and gesture activity logging.
- Creative image-generation workspace with selectable visual styles, prompts, aspect-ratio metadata, and stored generated-image history.
- Activity and automation views for presenting assistant state/workflows.
- Notification and settings interactions.
- Google sign-in/connection state UI and provider connection surfaces.
- Connection cards for Google Calendar, Gmail, Spotify, Microsoft 365, and WhatsApp Business.
- Server-side Gemini configuration with no permanent API key embedded in source code.
- Graceful local response fallback when Gemini is unavailable or fails.

These capabilities are the prototype baseline for this PRD; they do not imply that every provider integration is production-ready.

---

## 3. Problem Statement

Users often switch between chat assistants, calendars, email, media applications, image tools, and browser controls to complete simple tasks. This creates context switching and makes hands-free interaction difficult.

Aura addresses this by providing one assistant workspace where users can:

1. Ask questions using text or voice.
2. Hear responses in a selected language and compatible system voice.
3. Stop speech immediately when desired.
4. Use selected webcam gestures for low-risk interface controls.
5. Generate and organize visual content from natural-language prompts.
6. Maintain conversation and preference state during and across browser sessions where enabled.
7. Discover connected productivity/media services.
8. Move from conversational intent to an explicit, confirmed external action.

---

## 4. Product Vision

**Aura should feel like a calm, intelligent, multimodal control layer for everyday digital work and creativity: conversational when possible, visual when useful, hands-free when helpful, and action-oriented only when the user has clearly authorized the action.**

The long-term experience should let a user speak, type, gesture, or request an image; understand what Aura plans to do; confirm sensitive actions; and receive a clear result.

---

## 5. Goals and Success Criteria

### 5.1 Product goals

1. Deliver a polished voice-first assistant in the browser.
2. Support typed and spoken interaction in multiple languages.
3. Make speaking state, listening state, and stopping speech obvious.
4. Provide graceful voice fallback when a requested system voice is unavailable.
5. Provide local hand-gesture recognition for selected UI actions.
6. Provide an integrated image-creation experience.
7. Persist user-approved prototype settings, conversation history, and generated-image metadata locally.
8. Keep model credentials and provider secrets out of client source code and Git history.
9. Introduce secure, permission-aware service integrations.
10. Make externally visible or destructive actions explicit and confirmation-based.

### 5.2 Success metrics

Initial production targets:

- **Assistant response success:** >= 99% of non-rate-limited requests return a user-visible result.
- **Voice interaction completion:** >= 95% of supported voice interactions produce a transcript or a clear recoverable error.
- **Speech cancellation:** 100% of active speech sessions can be stopped by the user through the UI.
- **Gesture reliability:** >= 90% correct recognition for supported gestures in controlled test conditions.
- **Image workflow completion:** >= 95% of valid image requests produce either an image result or a clear recoverable error.
- **Action confirmation safety:** 100% of destructive or externally visible actions require explicit confirmation.
- **Accessibility:** all core functions remain usable without camera or voice input.
- **Security:** 0 API keys or OAuth client secrets committed to the repository.

---

## 6. Target Users

### Primary user — productivity-focused individual

A user who wants one assistant for questions, planning, communication, reminders, creative prompts, and media controls.

### Secondary user — multimodal/accessible-computing user

A user who benefits from voice interaction or hands-free controls and wants alternatives to mouse-and-keyboard workflows.

### Future user — power user

A user who wants Aura to orchestrate multiple connected services while retaining explicit control over permissions and externally visible actions.

---

## 7. Core User Journeys

### Journey A — Enter Aura

1. User opens the application.
2. Aura presents a cinematic welcome experience with animated branding.
3. Aura attempts to play the welcome greeting using browser speech/audio capabilities.
4. If autoplay is blocked, the next explicit interaction retries the welcome experience.
5. User enters the main Aura workspace.

**Success condition:** the user immediately understands that Aura is active, interactive, and ready without being forced to configure an API key.

### Journey B — Ask Aura by text or voice

1. User types a prompt or activates the microphone.
2. Aura visibly enters listening state for voice input.
3. The browser captures speech where supported.
4. Aura sends recent conversation context and language preference to `/api/chat`.
5. The server calls Gemini using the server environment credential.
6. Aura renders the answer.
7. If voice output is enabled, Aura speaks the response using a compatible system voice.
8. The user can stop speaking immediately.

**Success condition:** the user receives a clear answer through text, voice, or both and can interrupt speech when needed.

### Journey C — Generate an image

1. User opens the image/creative workspace.
2. User enters or selects a prompt.
3. User selects a visual style and desired aspect ratio.
4. Aura creates or displays the resulting image workflow state.
5. Image metadata is retained in the local prototype gallery when enabled.

**Success condition:** the user can move from a natural-language idea to a visually organized image result without leaving Aura.

### Journey D — Use a gesture

1. User enables the camera.
2. Aura displays camera and vision state.
3. MediaPipe detects hand landmarks locally.
4. Aura classifies one of the supported gestures.
5. The UI shows the recognized gesture and mapped action.
6. Low-risk actions execute only when gesture automation is enabled and debounce/confidence conditions are satisfied.
7. User can disable camera or gesture automation independently.

**Success condition:** supported gestures cause predictable UI behavior without requiring mouse or keyboard input.

### Journey E — Connect a service

1. User opens Connections.
2. Aura shows supported providers and connection status.
3. User selects a provider.
4. The prototype presents the provider connection flow/configuration state.
5. Production implementations will complete authorization server-side and store tokens securely.

**Success condition:** users can understand which service is connected and which capabilities are available without exposing secrets.

### Journey F — Execute an external action

1. User requests a supported external action.
2. Aura maps intent to a typed action schema.
3. Aura displays confirmation for sensitive or externally visible actions.
4. User confirms or cancels.
5. The server executes the provider action.
6. Aura reports the provider-confirmed result.
7. An audit event records the action outcome.

---

## 8. Functional Requirements

### FR-01 — Text conversation

Aura must support non-empty text messages, chronological assistant responses, timestamps, suggestions, and recoverable errors.

### FR-02 — Server-side model gateway

Aura must route model requests through a server-side endpoint.

**Acceptance criteria:**
- `GEMINI_API_KEY` is read from the server environment.
- No permanent API key is embedded in `App.tsx`, `vite.config.ts`, or other committed source.
- Missing/failed model configuration does not crash the UI.
- The prototype may provide a deterministic local response fallback.

### FR-03 — Voice input

Aura must support browser speech recognition where available.

**Acceptance criteria:**
- Start/stop listening is available.
- Listening state is visible.
- Recognized speech can populate/submit the chat input.
- Unsupported browsers receive a recoverable message.

### FR-04 — Voice output and interruption

Aura must support browser speech synthesis and immediate user interruption.

**Acceptance criteria:**
- Available voices are discovered.
- Language selection influences synthesis.
- Muting prevents output while preserving text responses.
- A visible stop control appears while Aura is speaking.
- Stop cancels the active utterance and clears speaking state.

### FR-05 — Welcome experience

Aura must provide an animated welcome experience that establishes product identity and readiness.

**Acceptance criteria:**
- Enter Aura is visually prominent and animated.
- Main application styling is consistent with the welcome experience.
- Welcome audio/speech is attempted on entry.
- Browser autoplay restrictions do not prevent the user from continuing.

### FR-06 — Multilingual interaction

The prototype exposes English, English UK, Spanish, French, German, Hindi, Urdu, Japanese, and Portuguese choices.

**Acceptance criteria:**
- Selected language is sent to the model service.
- Model instruction requests a response in the selected language.
- Speech synthesis prefers a compatible installed voice.

### FR-07 — Camera and vision

Aura must provide explicit camera controls and visible vision state.

**Acceptance criteria:**
- Camera activation follows explicit user interaction.
- Camera can be disabled.
- Tracks stop when the feature is disabled/unmounted.
- Vision processing occurs locally where feasible.

### FR-08 — Gesture recognition

The prototype must recognize the defined 12-gesture interaction set, including pinch/spread variants, peace, pointing index, thumbs up/down, rock horns, three-finger claw, open palm, and horizontal/vertical swipe behavior.

**Acceptance criteria:**
- Recognition is deterministic for fixtures.
- Debounce/confidence rules reduce accidental repeats.
- Recognized gesture and mapped action are visible.
- Gesture automation can be disabled independently.

### FR-09 — Image creation studio

Aura must provide a creative workflow for image requests.

**Acceptance criteria:**
- User can enter a natural-language image prompt.
- User can select among curated visual styles.
- User can select or record aspect-ratio metadata.
- Generated-image entries can be retained in local prototype storage.
- Image results remain associated with their prompt/style metadata.

### FR-10 — Local persistence

The prototype may persist user-approved state in browser local storage.

Current state categories include:
- Conversation history.
- Voice/output and gesture settings.
- Generated-image metadata.
- Prototype Google connection state.

**Acceptance criteria:**
- Storage failures do not crash the application.
- Users can disable relevant persistence settings where exposed.
- Sensitive provider tokens are not stored in local storage.

### FR-11 — Connections

The UI provides connection surfaces for Google Calendar, Gmail, Spotify, Microsoft 365, and WhatsApp Business.

**Acceptance criteria:**
- Provider state is visible.
- Missing configuration is described without revealing secrets.
- Production authorization and token management remain server-side.

### FR-12 — OAuth and token security

Production integrations must use secure server-side OAuth callbacks and encrypted refresh-token storage.

**Acceptance criteria:**
- Provider secrets never reach the browser.
- Authorization codes are exchanged server-side.
- PKCE is used where supported and appropriate.
- Refresh tokens are encrypted at rest.
- Tokens are never logged.

### FR-13 — Agent tool execution

External actions must be exposed through typed, allowlisted tools rather than arbitrary model-generated HTTP requests.

### FR-14 — Confirmation and safety controls

Destructive, irreversible, financial, privacy-sensitive, or externally visible actions require explicit confirmation.

### FR-15 — Error recovery

Aura must provide understandable recovery for model failures, quota limits, network failures, microphone/camera permissions, speech failures, OAuth failures, and provider errors.

---

## 9. Non-Functional Requirements

### NFR-01 — Security

- Never commit API keys or OAuth secrets.
- Keep `GEMINI_API_KEY` server-side.
- Use HTTPS in production.
- Encrypt sensitive tokens at rest.
- Apply least-privilege provider scopes.
- Add rate limiting and controlled retries to production APIs.
- Rotate/revoke any credential that has accidentally appeared in Git history.

### NFR-02 — Privacy

- Camera and microphone are opt-in capabilities.
- Hand-landmark processing should remain local whenever feasible.
- Raw camera frames should not be uploaded to the model by default.
- Minimize persisted conversation/provider data.
- Never use browser local storage for provider access tokens.

### NFR-03 — Performance

- Target < 3 seconds initial load after caching on modern broadband.
- Show visible request progress quickly.
- Keep gesture processing responsive and avoid blocking the main UI thread.
- Introduce streaming model responses in a production iteration.

### NFR-04 — Reliability

- Model/provider APIs use timeouts and controlled retries.
- Failed external actions are never reported as successful.
- Speech state is reset cleanly after stop, cancel, end, or error.
- Camera/microphone permission changes are handled without requiring a page crash/reload.

### NFR-05 — Accessibility

- Every core action has a non-voice/non-gesture path.
- Interactive controls have accessible labels.
- Keyboard navigation is supported.
- State changes are communicated without relying only on color or motion.
- Stop-speaking is available as a conventional button, not only as a gesture.

### NFR-06 — Browser support

Initial target: current Chrome and Edge, with graceful degradation when browser speech or vision APIs are unavailable.

---

## 10. UX Requirements

### Welcome experience

The welcome experience should feel premium and futuristic without blocking access to the application. Animation should communicate readiness rather than delay it. Audio should enhance the experience but never be required for basic operation.

### Main workspace

The primary workspace should expose:

1. **Aura identity/status** — greeting, availability, and current system state.
2. **Conversation panel** — messages, timestamps, suggestions, input, microphone, send, mute, and stop-speaking controls.
3. **Creative studio** — image prompt, style, aspect ratio, and generated-image history.
4. **Vision Sensor** — camera state, gesture state, and action feedback.
5. **Connections** — provider state and permission management.
6. **Activity/Automations** — visible assistant workflow/state information.
7. **Global status** — model availability, listening/speaking state, camera state, and errors.

### Interaction principles

- Make the next action obvious.
- Show when Aura is listening, thinking, speaking, or executing.
- Let users stop speech immediately.
- Never require users to supply a secret API key through the UI.
- Never make an external action appear complete until the provider confirms success.
- Always provide conventional controls alongside voice and gesture controls.
- Keep technical configuration details out of the primary experience.

---

## 11. Technical Architecture

### Current prototype

```text
Browser / React 19 UI
   |
   +--> Browser Speech Recognition
   |
   +--> Browser Speech Synthesis
   |       +--> language/voice selection
   |       +--> stop/cancel active speech
   |
   +--> MediaPipe Hand Landmarker (local)
   |
   +--> Local Storage
   |       +--> chat history
   |       +--> settings
   |       +--> image metadata
   |
   +--> POST /api/chat
            |
            +--> Vite development middleware
                    |
                    +--> GEMINI_API_KEY from server environment
                    |
                    +--> Gemini client
                    |
                    +--> deterministic local fallback
```

### Target production direction

```text
Browser
  |
  +--> Web UI / Accessibility Layer
  +--> Voice + Local Vision
  +--> Creative Image Workflow
  +--> Authenticated API
          |
          +--> Conversation Service
          +--> LLM Gateway
          +--> Tool / Action Orchestrator
          |       +--> Google Calendar
          |       +--> Gmail
          |       +--> Spotify
          |       +--> Microsoft 365
          |       +--> WhatsApp Business
          +--> Secure Token Store
          +--> Conversation / Preference Store
          +--> Image Asset Store
          +--> Audit + Observability
```

The model should interpret intent within constrained schemas. The application and server—not the model—must own authorization, confirmation, validation, provider calls, secrets, and auditability.

---

## 12. Security Decision: No User-Facing API Key

Aura must not ask end users to paste or configure the developer's Gemini API key.

The intended architecture is:

1. The owner/deployment environment stores `GEMINI_API_KEY` as a server-side secret.
2. The browser calls `/api/chat` rather than Gemini directly.
3. The server creates the Gemini client from the environment variable.
4. The key is never rendered into browser JavaScript, local storage, or Git-tracked source.
5. Production deployments must replace the Vite development middleware with a proper server/serverless endpoint and protected environment configuration.

If a credential is ever committed accidentally, the credential must be revoked/rotated and the secret-bearing history removed before publishing the repository.

Multiple API keys should not be treated as a way to bypass project-level quotas. Production reliability should instead use controlled retry/backoff, appropriate quota planning, and—where needed—a deliberate fallback model/provider architecture.

---

## 13. Scope and Roadmap

### Current prototype baseline

- Premium animated welcome experience.
- Unified visual theme.
- Welcome speech/audio attempt.
- Text chat.
- Browser voice input/output.
- Stop-speaking control.
- Multilingual voice/model selection.
- Local gesture recognition.
- Camera controls.
- Creative image workflow.
- Local prototype persistence.
- Activity/automation and notification UI.
- Provider connection UI.
- Server-side Gemini environment configuration.
- Local response fallback.

### MVP production scope

- Authenticated accounts.
- Secure server/serverless `/api/chat` deployment.
- Production Google Calendar and Gmail connectors.
- Confirmation-based calendar/email actions.
- Secure OAuth callback handling and encrypted token storage.
- Persistent conversation/session history with user controls.
- Production image-generation backend and asset storage.
- Error telemetry, audit events, automated tests, and deployment pipeline.
- Accessibility and browser compatibility testing.

### Later scope

- Spotify playback actions.
- Microsoft 365 actions.
- WhatsApp Business workflows.
- Wake-word support.
- Streaming responses.
- Long-term memory with user controls.
- Broader browser/computer automation.
- More advanced computer vision.

### Explicitly out of scope for MVP

- Autonomous high-impact actions without confirmation.
- Default storage of raw camera recordings.
- Browser exposure of provider access tokens.
- Arbitrary model-generated HTTP requests.
- Using API-key rotation to evade provider quota policies.

---

## 14. QA and Acceptance Checklist

### UI and interaction

- [ ] Welcome screen renders correctly on supported browsers.
- [ ] Enter Aura animation is responsive and does not block access.
- [ ] Welcome speech/audio is attempted and gracefully handles autoplay restrictions.
- [ ] Main theme is visually consistent with the welcome experience.
- [ ] Microphone control clearly shows listening state.
- [ ] Stop Speaking appears during speech and immediately cancels output.
- [ ] Mute prevents speech while retaining text responses.

### Chat and model

- [ ] Text prompts submit successfully.
- [ ] Selected language reaches `/api/chat`.
- [ ] Gemini credentials are server-side only.
- [ ] No API key appears in browser source or local storage.
- [ ] Model failure produces a recoverable result/fallback.

### Vision

- [ ] Camera activation is explicit.
- [ ] Camera can be disabled.
- [ ] Supported gestures are recognized with debounce/confidence safeguards.
- [ ] Gesture automation can be disabled separately.
- [ ] Vision processing does not upload raw frames by default.

### Creative studio

- [ ] Image prompt input works.
- [ ] Style selection works.
- [ ] Aspect-ratio metadata is preserved.
- [ ] Image history survives refresh when persistence is enabled.

### Security and deployment

- [ ] Secret scanning passes.
- [ ] Previously exposed credentials are revoked/rotated.
- [ ] Production API endpoint uses protected environment secrets.
- [ ] OAuth secrets and refresh tokens remain server-side.
- [ ] Logs contain no provider access tokens or API keys.

---

## 15. Known Prototype Limitations

1. Browser autoplay policies may prevent welcome audio from starting until the user interacts.
2. `/api/chat` is currently implemented as Vite development middleware and is not by itself a production deployment architecture.
3. Provider connection UI is not equivalent to complete production OAuth/action integration.
4. Local storage is suitable for prototype preferences/history but is not a secure persistent store for sensitive account data.
5. Browser speech recognition and synthesis depend on browser/device capabilities and installed voices.
6. Image-generation production infrastructure, storage, moderation, and cost controls still need to be defined.
7. Automated test coverage and production observability remain roadmap work.

---

## 16. Release Principle

Aura should prioritize **secure defaults, visible state, user control, graceful failure, and a polished multimodal experience**. The prototype may feel futuristic, but production behavior must remain explicit, testable, permission-aware, and auditable.

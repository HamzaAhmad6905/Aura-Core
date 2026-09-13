import { useEffect, useRef, useState, type ReactNode } from "react";
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import "./App.css";

type Message = { role: "user" | "aura"; text: string; time: string };
type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; onstart: () => void; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: (event: { error: string }) => void; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type VoiceOption = { name: string; lang: string; voice: SpeechSynthesisVoice };
type Provider = "google-calendar" | "gmail" | "spotify" | "microsoft" | "whatsapp";

declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor } }

const suggestions = [
  "What can you do?",
  "Set a reminder",
  "Tell me a fact",
  "Summarize my day",
  "Translate this to Urdu",
  "What is the weather?",
  "Start focus mode",
  "Give me a productivity tip",
];
const getTime = () =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
const getDate = () =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
    .format(new Date())
    .toUpperCase();
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
};
const CHAT_STORAGE_KEY = "aura-chat-history";
const SETTINGS_STORAGE_KEY = "aura-settings";
type Settings = {
  voiceOutputEnabled: boolean;
  persistChatEnabled: boolean;
  gestureAutomationEnabled: boolean;
};
const defaultSettings: Settings = {
  voiceOutputEnabled: true,
  persistChatEnabled: true,
  gestureAutomationEnabled: true,
};
const loadSettings = (): Settings => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaultSettings;
  }
};
type GestureLogEntry = { name: string; action: string; time: string };
type Tab = "assistant" | "activity" | "automations";
const defaultMessages: Message[] = [
  {
    role: "aura",
    text: "Good morning. I’m Aura, your voice-first assistant. How can I help?",
    time: getTime(),
  },
];
const loadStoredMessages = (): Message[] => {
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return defaultMessages;
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) && parsed.length ? parsed : defaultMessages;
  } catch {
    return defaultMessages;
  }
};
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const wasmUrl =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const suggestions = ["What can you do?", "Set a reminder", "Tell me a fact", "Summarize my day", "Translate this to Urdu", "What is the weather?", "Start focus mode", "Give me a productivity tip"];
const modelUrl = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const wasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const getTime = () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
const getDate = () => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase();
const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : h < 22 ? "Good evening" : "Good night"; };

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<string, ReactNode> = {
    mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    music: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    activity: <path d="M3 12h4l3-8 4 16 3-8h4"/>,
    automation: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.5-1H6v-2h.9a1.7 1.7 0 0 0 1.5-1A1.7 1.7 0 0 0 8.1 9L8 8.9l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V6h2.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v2h-.2a1.7 1.7 0 0 0-1.5 1Z"/></>,
    camera: <><path d="m9 7 1.5-2h3L15 7h3a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h3"/><circle cx="12" cy="13" r="4"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    arrow: <><path d="M5 12h13M13 6l6 6-6 6"/></>,
    spark: <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z"/>
  };
  return <svg {...common}>{paths[name] ?? paths.spark}</svg>;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y); }
function fingerIsUp(hand: { x: number; y: number }[], tip: number, pip: number) { return hand[tip].y < hand[pip].y - 0.035; }
function classifyGesture(hand: { x: number; y: number }[], previous: { x: number; y: number } | null) {
  const index = fingerIsUp(hand, 8, 6), middle = fingerIsUp(hand, 12, 10), ring = fingerIsUp(hand, 16, 14), pinky = fingerIsUp(hand, 20, 18), pinch = distance(hand[4], hand[8]);
  const thumbUp = hand[4].y < hand[3].y - 0.08 && !index && !middle && !ring && !pinky;
  const thumbDown = hand[4].y > hand[3].y + 0.08 && !index && !middle && !ring && !pinky;
  if (pinch < 0.07) return { name: "Pinch In", action: "Zoom in UI" };
  if (pinch > 0.42) return { name: "Pinch & Spread", action: "Zoom out UI" };
  if (index && middle && !ring && !pinky) return { name: "Victory / Peace", action: "Inspect gesture" };
  if (index && !middle && !ring && !pinky) return { name: "Pointing Index", action: "Cursor control" };
  if (thumbUp) return { name: "Thumbs Up", action: "Approve / confirm" };
  if (thumbDown) return { name: "Thumbs Down", action: "Reject / cancel" };
  if (index && pinky && !middle && !ring) return { name: "Rock On / Horns", action: "Developer mode" };
  if (index && middle && ring && pinky) return { name: "Open Palm", action: "Privacy / mute mode" };
  if (previous && Math.abs(hand[8].x - previous.x) > 0.12) return { name: hand[8].x > previous.x ? "Swipe Right" : "Swipe Left", action: hand[8].x > previous.x ? "Next / forward" : "Previous / back" };
  if (previous && previous.y - hand[8].y > 0.1) return { name: "Swipe Up", action: "Scroll down" };
  return { name: "Tracking", action: "Hand detected" };
}

function App() {
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(
    "Tap the microphone and speak",
  );
  const [language, setLanguage] = useState("en-US");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [motion, setMotion] = useState(0);
  const [gesture, setGesture] = useState("Waiting");
  const [gestureAction, setGestureAction] = useState(
    "Turn on the camera to begin",
  );
  const [zoom, setZoom] = useState(1);
  const [muted, setMuted] = useState(false);
  const [input, setInput] = useState("");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [oauthStatus, setOauthStatus] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [isThinking, setIsThinking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("assistant");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [gestureLog, setGestureLog] = useState<GestureLogEntry[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [clock, setClock] = useState(getTime);
  const [devTerminalOpen, setDevTerminalOpen] = useState(false);
  const voicesRef = useRef<VoiceOption[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const previousIndexRef = useRef<{ x: number; y: number } | null>(null);
  const lastActionRef = useRef("");
  const welcomeStartedRef = useRef(false);
export default function App() {
  const [listening, setListening] = useState(false), [speaking, setSpeaking] = useState(false), [voiceStatus, setVoiceStatus] = useState("Ready for your voice"), [language, setLanguage] = useState("en-US"), [voices, setVoices] = useState<VoiceOption[]>([]), [voiceName, setVoiceName] = useState(""), [cameraOn, setCameraOn] = useState(false), [motion, setMotion] = useState(0), [gesture, setGesture] = useState("Waiting"), [gestureAction, setGestureAction] = useState("Turn on the camera to begin"), [zoom, setZoom] = useState(1), [muted, setMuted] = useState(false), [input, setInput] = useState(""), [connectionsOpen, setConnectionsOpen] = useState(false), [activeView, setActiveView] = useState<"assistant" | "activity" | "automations">("assistant"), [notificationOpen, setNotificationOpen] = useState(false), [welcomeOpen, setWelcomeOpen] = useState(true), [oauthStatus, setOauthStatus] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "aura", text: "Welcome. I’m Aura, your voice-first assistant. How can I help?", time: getTime() }]);
  const voicesRef = useRef<VoiceOption[]>([]), videoRef = useRef<HTMLVideoElement>(null), microphoneRef = useRef<MediaStream | null>(null), canvasRef = useRef<HTMLCanvasElement>(null), streamRef = useRef<MediaStream | null>(null), recognitionRef = useRef<SpeechRecognitionLike | null>(null), landmarkerRef = useRef<HandLandmarker | null>(null), frameRef = useRef<number | null>(null), previousIndexRef = useRef<{ x: number; y: number } | null>(null), lastActionRef = useRef(""), welcomeStartedRef = useRef(false), welcomeLockRef = useRef(false), welcomeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadVoices = () => { const available = window.speechSynthesis?.getVoices().map(voice => ({ name: voice.name, lang: voice.lang, voice })) ?? []; setVoices(available); voicesRef.current = available; setVoiceName(current => current || available[0]?.name || ""); };
    loadVoices(); window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => { window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices); window.speechSynthesis?.cancel(); streamRef.current?.getTracks().forEach(t => t.stop()); microphoneRef.current?.getTracks().forEach(t => t.stop()); if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, []);
  useEffect(() => {
    try {
      if (settings.persistChatEnabled) {
        window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } else {
        window.localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch {
      // Storage can fail in private browsing or when full; chat still works in-memory.
    }
  }, [messages, settings.persistChatEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Settings just won't persist across reloads; the app still works.
    }
  }, [settings]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(getTime()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const toggleSetting = (key: keyof Settings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  };
  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setVoiceStatus("Tap the microphone and speak");
  };
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);
  const clearChat = () => {
    setMessages(defaultMessages);
    window.speechSynthesis?.cancel();
    setVoiceStatus("Tap the microphone and speak");
    try {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Ignore storage errors; the in-memory chat is already cleared.
    }
  };
  const copyMessage = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
    } catch {
      setVoiceStatus("Could not copy to clipboard");
    }
  };
  const speak = (text: string) => {
    if (muted || !settings.voiceOutputEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const matching = voices.filter((option) =>
      option.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()),
    );
    const selected =
      voices.find(
        (option) =>
          option.name === voiceName &&
          option.lang
            .toLowerCase()
            .startsWith(language.slice(0, 2).toLowerCase()),
      ) ?? matching[0];
    const utterance = new SpeechSynthesisUtterance(text);
    if (selected) utterance.voice = selected.voice;
    utterance.lang = selected?.lang ?? language;
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setVoiceStatus(`Speaking in ${language}`);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setVoiceStatus("Tap the microphone and speak");
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setVoiceStatus("Tap the microphone and speak");
    };
    window.speechSynthesis.speak(utterance);
    if (!selected)
      setVoiceStatus(
        `No ${language} voice is installed; using the system voice`,
      );
  };
  const playWelcomeSound = () => {
    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    void context.resume();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.35);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 4.2);
    master.connect(context.destination);
    [174.61, 261.63, 392].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 1 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, context.currentTime + 4.2);
      oscillator.connect(master);
      oscillator.start();
      oscillator.stop(context.currentTime + 4.25);
    });
    window.setTimeout(() => void context.close(), 4600);
  };
  const playPostWelcomeSound = () => {
    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    void context.resume();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 2.5);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 5.8);
    master.connect(context.destination);

  const stopSpeaking = () => { window.speechSynthesis?.cancel(); welcomeAudioRef.current?.pause(); welcomeAudioRef.current = null; setSpeaking(false); setVoiceStatus("Speech stopped"); };
  const pickVoice = (available: SpeechSynthesisVoice[]) => available.slice().sort((a, b) => { const score = (v: SpeechSynthesisVoice) => (/aria|jenny|samantha|ava|sonia|serena|neural|natural|zira|hazel|karen|emma/i.test(v.name) ? 10 : 0) + (v.lang.toLowerCase().startsWith(language.slice(0, 2)) ? 5 : 0) - (/male|david|mark|guy|ryan/i.test(v.name) ? 8 : 0); return score(b) - score(a); })[0];
  const speak = (text: string) => { if (muted || !("speechSynthesis" in window)) return; stopSpeaking(); const selected = voices.find(v => v.name === voiceName && v.lang.toLowerCase().startsWith(language.slice(0, 2)))?.voice ?? voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2)))?.voice ?? pickVoice(window.speechSynthesis.getVoices()); const u = new SpeechSynthesisUtterance(text); if (selected) u.voice = selected; u.lang = selected?.lang ?? language; u.rate = 0.94; u.pitch = 1; u.onstart = () => { setSpeaking(true); setVoiceStatus(`Aura is speaking · ${language}`); }; u.onend = () => { setSpeaking(false); setVoiceStatus("Ready for your voice"); }; u.onerror = () => { setSpeaking(false); setVoiceStatus("Speech could not be played"); }; window.speechSynthesis.speak(u); };

  const playClip = async (src: string, volume = 1) => { welcomeAudioRef.current?.pause(); const audio = new Audio(src); audio.volume = volume; welcomeAudioRef.current = audio; audio.onplay = () => { setSpeaking(true); setVoiceStatus("Aura is welcoming you"); }; audio.onended = () => { setSpeaking(false); setVoiceStatus("Ready for your voice"); }; await audio.play(); };
  const startWelcomeSequence = async () => { if (welcomeStartedRef.current || welcomeLockRef.current) return; welcomeLockRef.current = true; try { await playClip("/welcome-to-aura.mp3", 1); welcomeStartedRef.current = true; await new Promise(r => window.setTimeout(r, 220)); try { await playClip("/futuristic-intro.wav", .68); } catch { /* secondary audio is optional */ } } catch { try { speak("Welcome to Aura."); welcomeStartedRef.current = true; } catch { welcomeLockRef.current = false; } } };
  useEffect(() => { const timer = window.setTimeout(() => void startWelcomeSequence(), 120); return () => window.clearTimeout(timer); }, []);

  const addAuraMessage = (text: string) => { setMessages(current => [...current, { role: "aura", text, time: getTime() }]); speak(text); };
  const answer = async (question: string) => {
    if (!question.trim() || isThinking) return;
    const userMessage = {
      role: "user" as const,
      text: question,
      time: getTime(),
    };
    const history = [...messages, userMessage]
      .slice(-12)
      .map(({ role, text }) => ({
        role: role === "aura" ? "model" : "user",
        text,
      }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setVoiceStatus("Thinking...");
    setIsThinking(true);
    try {
      const result = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, language }),
      });
      const data = (await result.json()) as { text?: string; error?: string };
      if (!result.ok || !data.text)
        throw new Error(data.error || "Gemini did not return a response.");
      addAuraMessage(data.text);
      setVoiceStatus("Tap the microphone and speak");
    } catch (error) {
      addAuraMessage(
        error instanceof Error ? error.message : "Unable to reach Gemini.",
      );
      setVoiceStatus("Tap the microphone and speak");
    } finally {
      setIsThinking(false);
    }
  };
  const toggleListening = async () => {
    const SpeechRecognitionApi =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      setVoiceStatus("Use Chrome or Edge for voice commands");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      setListening(false);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Microphone access requires localhost or HTTPS.");
      microphoneRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      setVoiceStatus(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone permission denied. Allow it in the address-bar settings."
          : "Microphone is busy or unavailable. Close other recording apps and try again.",
      );
      return;
    }
    const recognition = new SpeechRecognitionApi();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () =>
      setVoiceStatus("Listening... ask Aura anything");
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) void answer(transcript);
      else setVoiceStatus("I did not hear anything");
    };
    recognition.onend = () => {
      setListening(false);
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
    };
    recognition.onerror = (event) => {
      setListening(false);
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      setVoiceStatus(
        event.error === "not-allowed"
          ? "Microphone permission was denied. Allow it in the address-bar settings."
          : event.error === "audio-capture"
            ? "Microphone capture failed. Select a working microphone and close other recording apps."
          : `Voice error: ${event.error}`,
      );
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      setVoiceStatus("Could not start the microphone");
    }
  };
  const performGestureAction = (name: string, action: string) => {
    if (name === lastActionRef.current || name === "Tracking") return;
    lastActionRef.current = name;
    setGesture(name);
    setGestureAction(action);
    setGestureLog((current) => [{ name, action, time: getTime() }, ...current].slice(0, 30));
    if (!settings.gestureAutomationEnabled) return;
    if (name === "Pinch In") setZoom((value) => Math.min(1.35, value + 0.05));
    if (name === "Pinch & Spread")
      setZoom((value) => Math.max(0.8, value - 0.05));
    if (name === "Open Palm") {
      setMuted((value) => {
        const next = !value;
        if (next) window.speechSynthesis?.cancel();
        return next;
      });
    }
    if (name === "Thumbs Up")
      addAuraMessage("Approved. I’m ready for the next action.");
    if (name === "Thumbs Down")
      addAuraMessage("Cancelled. No action was taken.");
    if (name === "Victory / Peace")
      addAuraMessage(
        "Vision audit ready. I captured the peace gesture for inspection.",
      );
    if (name === "Rock On / Horns") setDevTerminalOpen((value) => !value);
    if (name === "Three-Finger Claw") {
      const log = new Blob(
        [`Aura gesture log: ${new Date().toISOString()} - ${name}`],
        { type: "text/plain" },
      );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(log);
      link.download = "aura-gesture-log.txt";
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };
  const drawHand = (result: HandLandmarkerResult) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const hand = result.landmarks[0];
    if (!hand) {
      setMotion(0);
      setGesture("Waiting");
      setGestureAction("Show a hand to Aura");
      previousIndexRef.current = null;
      return;
    }
    const points = hand.map((point) => ({
      x: point.x * canvas.width,
      y: point.y * canvas.height,
    }));
    const links = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [5, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [9, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [13, 17],
      [17, 18],
      [18, 19],
      [19, 20],
      [0, 17],
    ];
    context.strokeStyle = "#37d8ff";
    context.lineWidth = 3;
    links.forEach(([a, b]) => {
      context.beginPath();
      context.moveTo(points[a].x, points[a].y);
      context.lineTo(points[b].x, points[b].y);
      context.stroke();
    });
    context.fillStyle = "#fff";
    points.forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 5, 0, Math.PI * 2);
      context.fill();
    });
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.max(8, Math.min(...xs) - 18);
    const top = Math.max(8, Math.min(...ys) - 18);
    const right = Math.min(canvas.width - 8, Math.max(...xs) + 18);
    const bottom = Math.min(canvas.height - 8, Math.max(...ys) + 18);
    context.strokeStyle = "#9dffdc";
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(left, top, right - left, bottom - top, 18);
    context.stroke();
    context.font = "bold 18px sans-serif";
    context.fillStyle = "#9dffdc";
    context.fillText("AURA TRACKING", left + 8, Math.max(24, top - 8));
    setMotion(Math.min(100, Math.round((points.length / 21) * 100)));
    const detected = classifyGesture(hand, previousIndexRef.current);
    previousIndexRef.current = hand[8];
    performGestureAction(detected.name, detected.action);
  };
  const trackFrame = () => {
    const video = videoRef.current;
    if (video && landmarkerRef.current && video.readyState >= 2)
      drawHand(landmarkerRef.current.detectForVideo(video, performance.now()));
    frameRef.current = requestAnimationFrame(trackFrame);
  };
  const toggleCamera = async () => {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraOn(false);
      setMotion(0);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera API is unavailable. Open Aura through localhost or HTTPS.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setGestureAction("Loading hand tracking...");
      try {
        const vision = await FilesetResolver.forVisionTasks(wasmUrl);
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrl, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
        setGestureAction("Show a hand to Aura");
        frameRef.current = requestAnimationFrame(trackFrame);
      } catch (trackingError) {
        setGestureAction(
          `Camera active; hand tracking unavailable: ${trackingError instanceof Error ? trackingError.message : "model load failed"}`,
        );
      }
    } catch (error) {
      addAuraMessage(
        error instanceof Error
          ? error.message
          : "Camera access failed. Check browser permissions and try again.",
      );
    }
  };

  return (
    <main className="app-shell">
      {welcomeOpen && (
        <div className="welcome-backdrop" role="dialog" aria-modal="true" aria-label="Welcome to Aura">
          <div className="welcome-dialog">
            <div className="welcome-orbit"><img src="/aura-face.gif.gif" alt="Aura" /></div>
            <p className="eyebrow">YOUR VOICE-FIRST ASSISTANT</p>
            <h2>Welcome to Aura</h2>
            <p>Voice, vision, and intelligent action in one calm workspace.</p>
            <button onClick={() => { startWelcomeSequence(); setWelcomeOpen(false); }}>Enter Aura <span>↗</span></button>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <img className="brand-face" src="/aura-face.gif.gif" alt="Aura" />
          <span>
            AURA<span className="brand-dot">.</span>
          </span>
          <small>AI ASSISTANT</small>
          <span className="pro-badge">PRO</span>
        </div>
        <div className="status">
          <span className="status-dot" /> SYSTEM ONLINE{" "}
          <span className="divider" /> {clock}
        </div>
      </header>
      <section className="dashboard">
        <aside className="sidebar">
          <p className="eyebrow">WORKSPACE</p>
          <nav>
            <button
              className={`nav-item ${activeTab === "assistant" ? "active" : ""}`}
              onClick={() => setActiveTab("assistant")}
            >
              <span>◈</span> Assistant <b>1</b>
            </button>
            <button
              className={`nav-item ${activeTab === "activity" ? "active" : ""}`}
              onClick={() => setActiveTab("activity")}
            >
              <span>◷</span> Activity
            </button>
            <button
              className={`nav-item ${activeTab === "automations" ? "active" : ""}`}
              onClick={() => setActiveTab("automations")}
            >
              <span>⌁</span> Automations
            </button>
          </nav>
          <div className="side-divider" />
          <p className="eyebrow">CONNECTED</p>
          <button className="connection" onClick={() => setConnectionsOpen(true)}>
            <span className="connection-icon">▣</span>
            <span>
              <strong>Calendar</strong>
              <small>Synced just now</small>
            </span>
            <i className="connected" />
          </button>
          <button className="connection" onClick={() => setConnectionsOpen(true)}>
            <span className="connection-icon">◉</span>
            <span>
              <strong>Music</strong>
              <small>Ready to play</small>
            </span>
            <i className="connected" />
          </button>
          <button className="side-footer" onClick={() => setConnectionsOpen(true)}>
            ⚙ Connect apps <span>›</span>
          </button>
        </aside>
        <section className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">{getDate()}</p>
              <h1>
                {getGreeting()} <span>✦</span>
              </h1>
              <p className="subtitle">Your day, in focus.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Open notifications"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              ♢<em />
              {notificationsOpen && (
                <div className="notif-dropdown" role="menu">
                  <p className="notif-title">What's new</p>
                  <ul>
                    <li>Chat auto-scrolls and remembers history</li>
                    <li>Typing indicator while Aura thinks</li>
                    <li>Stop button for long spoken replies</li>
                    <li>Activity log + Automations panel added</li>
                  </ul>
                </div>
              )}
            </button>
          </div>
          {activeTab === "assistant" && (
            <>
          <div className="feature-grid">
            <section className="chat-panel panel">
              <div className="panel-head">
                <div>
                  <span className="live-dot" /> <strong>CONVERSATION</strong>
                </div>
                <div className="panel-head-actions">
                  <button
                    type="button"
                    className="clear-chat"
                    onClick={clearChat}
                    aria-label="Clear conversation"
                  >
                    ⟲ Clear
                  </button>
                  <select
                    className="language-select"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  aria-label="Voice language"
                >
                  <option value="en-US">English</option>
                  <option value="en-GB">English UK</option>
                  <option value="es-ES">Español</option>
                  <option value="fr-FR">Français</option>
                  <option value="de-DE">Deutsch</option>
                  <option value="hi-IN">हिन्दी</option>
                  <option value="ur-PK">اردو</option>
                  <option value="ja-JP">日本語</option>
                    <option value="pt-BR">Português</option>
                  </select>
                </div>
              </div>
              <div className="voice-controls">
                <span className={listening ? "voice-live" : ""}>
                  ● {voiceStatus}
                </span>
                {isSpeaking && (
                  <button
                    type="button"
                    className="stop-speaking"
                    onClick={stopSpeaking}
                    aria-label="Stop reading reply aloud"
                  >
                    ■ Stop audio
                  </button>
                )}
                <select
                  value={voiceName}
                  onChange={(event) => setVoiceName(event.target.value)}
                  aria-label="Assistant voice"
                >
                  <option value="">System voice</option>
                  {voices
                    .filter((voice) =>
                      voice.lang
                        .toLowerCase()
                        .startsWith(language.slice(0, 2).toLowerCase()),
                    )
                    .map((voice) => (
                      <option
                        key={`${voice.name}-${voice.lang}`}
                        value={voice.name}
                      >
                        {voice.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="messages">
                {messages.map((message, index) => (
                  <div
                    className={`message ${message.role}`}
                    key={`${message.time}-${index}`}
                  >
                    <div className="message-avatar">
                      {message.role === "aura" ? (
                        <img src="/aura-face.gif.gif" alt="Aura" />
                      ) : (
                        "YOU"
                      )}
                    </div>
                    <div>
                      <p>{message.text}</p>
                      <div className="message-footer">
                        <time>{message.time}</time>
                        {message.role === "aura" && (
                          <button
                            type="button"
                            className="copy-message"
                            onClick={() => void copyMessage(message.text, index)}
                            aria-label="Copy message"
                          >
                            {copiedIndex === index ? "Copied ✓" : "Copy"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="message aura" aria-live="polite">
                    <div className="message-avatar">
                      <img src="/aura-face.gif.gif" alt="Aura" />
                    </div>
                    <div>
                      <p className="typing-indicator">
                        <span /><span /><span />
                      </p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => void answer(suggestion)}
                    disabled={isThinking}
                  >
                    {suggestion} <span>↗</span>
                  </button>
                ))}
              </div>
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (input.trim()) void answer(input.trim());
                }}
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask Aura anything..."
                  disabled={isThinking}
                />
                <button
                  type="button"
                  className={`mic ${listening ? "listening" : ""}`}
                  onClick={toggleListening}
                  aria-label="Toggle voice input"
                  disabled={isThinking}
                >
                  ♩
                </button>
                <button
                  className="send"
                  aria-label="Send message"
                  disabled={isThinking || !input.trim()}
                >
                  ↑
                </button>
              </form>
            </section>
            <section className="vision-panel panel">
              <div className="panel-head">
                <div>
                  <strong>VISION SENSOR</strong>
                  <span className="pill">
                    {cameraOn ? "ACTIVE" : "STANDBY"}
                  </span>
                </div>
                <div className="panel-head-actions">
                  <button
                    type="button"
                    className="clear-chat"
                    onClick={() => setDevTerminalOpen((value) => !value)}
                    aria-label="Toggle developer terminal"
                  >
                    {"</>"} Terminal
                  </button>
                  <button
                    className="toggle"
                    onClick={toggleCamera}
                    aria-label="Toggle camera"
                  >
                    <span className={cameraOn ? "on" : ""} />
                  </button>
                </div>
              </div>
              <div className={`camera-view ${cameraOn ? "camera-active" : ""}`}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ transform: `scaleX(-1) scale(${zoom})` }}
                />
                <canvas ref={canvasRef} className="hand-overlay" />
                <div className="scan-lines" />
                {!cameraOn && (
                  <div className="camera-placeholder">
                    <div className="crosshair">⌖</div>
                    <p>Camera is off</p>
                    <small>Enable to let Aura see gestures</small>
                  </div>
                )}
                {cameraOn && (
                  <span className="tracking-label">TRACKING MOTION</span>
                )}
              </div>
              <div className="gesture-readout">
                <span className="gesture-icon">✋</span>
                <span>
                  <small>CAPTURED GESTURE</small>
                  <strong>{gesture}</strong>
                  <em>{gestureAction}</em>
                </span>
              </div>
              <div className="sensor-stats">
                <div>
                  <span className="stat-icon">⌁</span>
                  <span>
                    <small>MOTION</small>
                    <strong>{cameraOn ? `${motion}% active` : "Paused"}</strong>
                  </span>
                </div>
                <div>
                  <span className="stat-icon hand">♧</span>
                  <span>
                    <small>MODE</small>
                    <strong>{muted ? "Privacy mute" : "Listening"}</strong>
                  </span>
                </div>
              </div>
              <div className="sensitivity">
                <div>
                  <span>Detection sensitivity</span>
                  <b>{motion}%</b>
                </div>
                <div className="meter">
                  <span style={{ width: `${motion}%` }} />
                </div>
              </div>
            </section>
          </div>
            </>
          )}
          {activeTab === "activity" && (
            <section className="panel activity-panel">
              <div className="panel-head">
                <div>
                  <strong>ACTIVITY LOG</strong>
                  <span className="pill">{gestureLog.length} events</span>
                </div>
                {gestureLog.length > 0 && (
                  <button type="button" className="clear-chat" onClick={() => setGestureLog([])}>
                    ⟲ Clear
                  </button>
                )}
              </div>
              <div className="activity-body">
                <div className="activity-summary">
                  <div>
                    <small>MESSAGES THIS SESSION</small>
                    <strong>{messages.length}</strong>
                  </div>
                  <div>
                    <small>GESTURES CAPTURED</small>
                    <strong>{gestureLog.length}</strong>
                  </div>
                  <div>
                    <small>CAMERA</small>
                    <strong>{cameraOn ? "Active" : "Standby"}</strong>
                  </div>
                </div>
                {gestureLog.length === 0 ? (
                  <p className="activity-empty">
                    No gestures captured yet. Turn on the camera from the Assistant tab and show Aura a hand
                    sign — activity will appear here.
                  </p>
                ) : (
                  <ul className="activity-list">
                    {gestureLog.map((entry, index) => (
                      <li key={`${entry.time}-${index}`}>
                        <span className="activity-dot" />
                        <div>
                          <strong>{entry.name}</strong>
                          <span>{entry.action}</span>
                        </div>
                        <time>{entry.time}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
          {activeTab === "automations" && (
            <section className="panel automations-panel">
              <div className="panel-head">
                <div>
                  <strong>AUTOMATIONS</strong>
                  <span className="pill">Frontend controls</span>
                </div>
              </div>
              <div className="automation-row">
                <span>
                  <strong>Read replies aloud</strong>
                  <small>Speak every Aura response using text-to-speech</small>
                </span>
                <button
                  className="toggle"
                  onClick={() => toggleSetting("voiceOutputEnabled")}
                  aria-pressed={settings.voiceOutputEnabled}
                  aria-label="Toggle read replies aloud"
                >
                  <span className={settings.voiceOutputEnabled ? "on" : ""} />
                </button>
              </div>
              <div className="automation-row">
                <span>
                  <strong>Save chat history</strong>
                  <small>Keep your conversation saved on this device between visits</small>
                </span>
                <button
                  className="toggle"
                  onClick={() => toggleSetting("persistChatEnabled")}
                  aria-pressed={settings.persistChatEnabled}
                  aria-label="Toggle save chat history"
                >
                  <span className={settings.persistChatEnabled ? "on" : ""} />
                </button>
              </div>
              <div className="automation-row">
                <span>
                  <strong>Gesture automations</strong>
                  <small>Let hand gestures trigger actions (zoom, mute, approve, etc.)</small>
                </span>
                <button
                  className="toggle"
                  onClick={() => toggleSetting("gestureAutomationEnabled")}
                  aria-pressed={settings.gestureAutomationEnabled}
                  aria-label="Toggle gesture automations"
                >
                  <span className={settings.gestureAutomationEnabled ? "on" : ""} />
                </button>
              </div>
              <p className="automations-note">
                Gestures are still detected and logged in Activity even when automations are off — only the
                resulting action (zoom, mute, message, download) is skipped.
              </p>
            </section>
          )}
          {activeTab === "assistant" && (
          <div className="quick-row">
            <button
              type="button"
              onClick={() => void answer("What's on my schedule today?")}
              disabled={isThinking}
            >
              <span className="quick-icon">◷</span>
              <span>
                <small>NEXT UP</small>
                <strong>
                  Team standup <b>in 24 min</b>
                </strong>
              </span>
            </button>
            <button
              type="button"
              onClick={() => void answer("What is the weather like today?")}
              disabled={isThinking}
            >
              <span className="quick-icon weather">☼</span>
              <span>
                <small>LOCAL WEATHER</small>
                <strong>
                  Live lookup <b>Ask Aura</b>
                </strong>
              </span>
            </button>
            <button
              type="button"
              className={muted ? "focus-active" : ""}
              onClick={() => {
                setMuted((value) => !value);
                if (muted) setVoiceStatus("Tap the microphone and speak");
                else window.speechSynthesis?.cancel();
              }}
            >
              <span className="quick-icon focus">⌾</span>
              <span>
                <small>FOCUS MODE</small>
                <strong>
                  {muted ? "Privacy mute" : "Ready"}{" "}
                  <b>{muted ? "Tap to unmute" : "Tap to mute"}</b>
                </strong>
              </span>
            </button>
          </div>
          )}
          {connectionsOpen && (
            <div className="oauth-backdrop" role="dialog" aria-modal="true" aria-labelledby="oauth-title">
              <div className="oauth-dialog">
                <button className="oauth-close" onClick={() => setConnectionsOpen(false)} aria-label="Close connections">×</button>
                <p className="eyebrow">AURA ECOSYSTEM</p>
                <h2 id="oauth-title">Connect your apps</h2>
                <p className="oauth-copy">Aura opens each provider's official permission screen. Client IDs are public; secrets and access tokens stay server-side.</p>
                <div className="oauth-grid">
                  <button onClick={() => openOAuth("google-calendar")}><strong>▣ Google Calendar</strong><small>Events and reminders</small></button>
                  <button onClick={() => openOAuth("gmail")}><strong>✉ Gmail</strong><small>Read mail with permission</small></button>
                  <button onClick={() => openOAuth("spotify")}><strong>◉ Spotify</strong><small>Playback controls</small></button>
                  <button onClick={() => openOAuth("microsoft")}><strong>▦ Microsoft 365</strong><small>Outlook calendar</small></button>
                  <button onClick={() => openOAuth("whatsapp")}><strong>◌ WhatsApp Business</strong><small>Requires Meta Business setup</small></button>
                </div>
                {oauthStatus && <p className="oauth-status">{oauthStatus}</p>}
                <small className="oauth-note">Configure credentials in <b>.env</b>, then restart the dev server.</small>
              </div>
            </div>
          )}
          {devTerminalOpen && (
            <div className="dev-terminal" role="log" aria-label="Developer terminal">
              <div className="dev-terminal-head">
                <span>
                  <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
                  aura://terminal
                </span>
                <button type="button" onClick={() => setDevTerminalOpen(false)} aria-label="Close terminal">×</button>
              </div>
              <div className="dev-terminal-body">
                <p>&gt; aura --status</p>
                <p className="dim">camera: {cameraOn ? "on" : "off"} · voice-output: {settings.voiceOutputEnabled ? "on" : "off"} · muted: {String(muted)} · messages: {messages.length}</p>
                <p>&gt; aura --activity --tail</p>
                {gestureLog.slice(0, 8).map((entry, index) => (
                  <p key={`${entry.time}-${index}`} className="dim">
                    [{entry.time}] {entry.name} → {entry.action}
                  </p>
                ))}
                {gestureLog.length === 0 && <p className="dim">[idle] no gesture events yet</p>}
                <p className="cursor-line">&gt; <span className="blink">▌</span></p>
              </div>
            </div>
          )}
          <footer>
            <span>● Aura is ready</span>
            <span>Voice + vision online</span>
            <span>Gesture outline active</span>
          </footer>
        </section>
      </section>
    </main>
  );
}
    const userMessage: Message = { role: "user", text: question, time: getTime() }, history = [...messages, userMessage].slice(-12) as Message[];
    setMessages(current => [...current, userMessage]); setInput(""); setVoiceStatus("Aura is thinking…");
    try { const result = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.map(m => ({ role: m.role === "aura" ? "model" : "user", text: m.text })), language }) }); const data = await result.json() as { text?: string; error?: string }; if (!result.ok || !data.text) throw new Error(data.error || "Aura is temporarily unavailable. Please try again."); addAuraMessage(data.text); } catch (error) { const message = error instanceof Error ? error.message : "Aura is temporarily unavailable. Please try again."; addAuraMessage(message); } finally { if (!speaking) setVoiceStatus("Ready for your voice"); }
  };
  const toggleListening = async () => {
    const Api = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Api) { setVoiceStatus("Voice input needs Chrome or Edge"); return; }
    if (listening) { recognitionRef.current?.stop(); microphoneRef.current?.getTracks().forEach(t => t.stop()); microphoneRef.current = null; setListening(false); setVoiceStatus("Ready for your voice"); return; }
    try { microphoneRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); } catch (error) { setVoiceStatus(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied" : "Microphone is unavailable"); return; }
    const recognition = new Api(); recognition.lang = language; recognition.interimResults = false; recognition.continuous = false; recognition.onstart = () => setVoiceStatus("Listening… ask Aura anything"); recognition.onresult = e => { const transcript = e.results[0][0].transcript.trim(); if (transcript) void answer(transcript); else setVoiceStatus("I did not hear anything"); }; recognition.onend = () => { setListening(false); microphoneRef.current?.getTracks().forEach(t => t.stop()); microphoneRef.current = null; }; recognition.onerror = e => { setListening(false); microphoneRef.current?.getTracks().forEach(t => t.stop()); microphoneRef.current = null; setVoiceStatus(e.error === "not-allowed" ? "Microphone permission was denied" : `Voice error: ${e.error}`); }; recognitionRef.current = recognition; try { recognition.start(); setListening(true); } catch { setListening(false); setVoiceStatus("Could not start the microphone"); }
  };

  const performGestureAction = (name: string, action: string) => { if (name === lastActionRef.current || name === "Tracking") return; lastActionRef.current = name; setGesture(name); setGestureAction(action); if (name === "Pinch In") setZoom(v => Math.min(1.35, v + .05)); if (name === "Pinch & Spread") setZoom(v => Math.max(.8, v - .05)); if (name === "Open Palm") { setMuted(true); stopSpeaking(); } if (name === "Thumbs Up") addAuraMessage("Approved. I’m ready for the next action."); if (name === "Thumbs Down") addAuraMessage("Cancelled. No action was taken."); };
  const drawHand = (result: HandLandmarkerResult) => { const canvas = canvasRef.current, video = videoRef.current; if (!canvas || !video) return; const ctx = canvas.getContext("2d"); if (!ctx) return; canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480; ctx.clearRect(0, 0, canvas.width, canvas.height); const hand = result.landmarks[0]; if (!hand) { setMotion(0); setGesture("Waiting"); setGestureAction("Show a hand to Aura"); previousIndexRef.current = null; return; } const points = hand.map(p => ({ x: p.x * canvas.width, y: p.y * canvas.height })); const links = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]]; ctx.strokeStyle = "#8ff5ff"; ctx.lineWidth = 3; links.forEach(([a,b]) => { ctx.beginPath(); ctx.moveTo(points[a].x, points[a].y); ctx.lineTo(points[b].x, points[b].y); ctx.stroke(); }); ctx.fillStyle = "#ffffff"; points.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill(); }); setMotion(Math.min(100, Math.round(points.length / 21 * 100))); const detected = classifyGesture(hand, previousIndexRef.current); previousIndexRef.current = hand[8]; performGestureAction(detected.name, detected.action); };
  const trackFrame = () => { const video = videoRef.current; if (video && landmarkerRef.current && video.readyState >= 2) drawHand(landmarkerRef.current.detectForVideo(video, performance.now())); frameRef.current = requestAnimationFrame(trackFrame); };
  const toggleCamera = async () => { if (cameraOn) { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraOn(false); setMotion(0); if (frameRef.current) cancelAnimationFrame(frameRef.current); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false }); streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); } setCameraOn(true); setGestureAction("Loading hand tracking…"); const vision = await FilesetResolver.forVisionTasks(wasmUrl); landmarkerRef.current = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: modelUrl, delegate: "CPU" }, runningMode: "VIDEO", numHands: 1 }); setGestureAction("Show a hand to Aura"); frameRef.current = requestAnimationFrame(trackFrame); } catch (error) { setCameraOn(false); streamRef.current?.getTracks().forEach(t => t.stop()); setGestureAction(error instanceof Error ? error.message : "Camera access failed"); } };

  const openOAuth = (provider: Provider) => { const redirectUri = `${window.location.origin}/oauth/callback`; const clients: Record<Provider, string | undefined> = { "google-calendar": import.meta.env.VITE_GOOGLE_CLIENT_ID, gmail: import.meta.env.VITE_GOOGLE_CLIENT_ID, spotify: import.meta.env.VITE_SPOTIFY_CLIENT_ID, microsoft: import.meta.env.VITE_MICROSOFT_CLIENT_ID, whatsapp: import.meta.env.VITE_WHATSAPP_APP_ID }; const clientId = clients[provider]; if (!clientId || clientId.startsWith("replace_with_")) { setOauthStatus("This connection is not configured yet. Aura never asks users for its private API keys."); return; } const urls: Record<Provider,string> = { "google-calendar": `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("https://www.googleapis.com/auth/calendar.events")}`, gmail: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly")}`, spotify: `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("user-read-playback-state user-modify-playback-state")}`, microsoft: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("openid profile User.Read Calendars.Read")}`, whatsapp: `https://www.facebook.com/v23.0/dialog/oauth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("business_management whatsapp_business_management")}` }; window.open(urls[provider], "aura-oauth", "popup,width=520,height=720"); setOauthStatus("Permission window opened. Finish the provider consent flow and return to Aura."); };

  const navLabel = activeView === "assistant" ? "Assistant" : activeView === "activity" ? "Activity" : "Automations";
  return <main className="app-shell">
    {welcomeOpen && <div className="welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div className="welcome-dialog"><div className="welcome-orbit"><img src="/aura-face.gif.gif" alt="Aura" /></div><div className="welcome-glow"/><p className="eyebrow">YOUR VOICE-FIRST ASSISTANT</p><h2 id="welcome-title">Welcome to Aura</h2><p>Voice, vision, and intelligent action in one calm workspace.</p><button className="enter-aura" onClick={() => { setWelcomeOpen(false); if (!welcomeStartedRef.current) void startWelcomeSequence(); }}><span>Enter Aura</span><Icon name="arrow" size={18}/></button><small className="welcome-hint">Aura is ready when you are</small></div></div>}
    <header className="topbar"><button className="brand" onClick={() => { setWelcomeOpen(true); void startWelcomeSequence(); }} aria-label="Open Aura welcome"><img className="brand-face" src="/aura-face.gif.gif" alt=""/><span>AURA<span className="brand-dot">.</span></span><small>AI ASSISTANT</small></button><div className="status"><span className="status-dot"/> SYSTEM ONLINE <span className="divider"/> {navLabel.toUpperCase()}</div></header>
    <section className="dashboard"><aside className="sidebar"><p className="eyebrow">WORKSPACE</p><nav><button className={`nav-item ${activeView === "assistant" ? "active" : ""}`} onClick={() => setActiveView("assistant")}><span>◈</span> Assistant <b>1</b></button><button className={`nav-item ${activeView === "activity" ? "active" : ""}`} onClick={() => setActiveView("activity")}><Icon name="activity" size={17}/> Activity</button><button className={`nav-item ${activeView === "automations" ? "active" : ""}`} onClick={() => setActiveView("automations")}><Icon name="automation" size={17}/> Automations</button></nav><div className="side-divider"/><p className="eyebrow">CONNECTED</p><button className="connection" onClick={() => setConnectionsOpen(true)}><span className="connection-icon"><Icon name="calendar" size={16}/></span><span><strong>Calendar</strong><small>Manage connection</small></span><i/></button><button className="connection" onClick={() => setConnectionsOpen(true)}><span className="connection-icon"><Icon name="music" size={16}/></span><span><strong>Music</strong><small>Manage connection</small></span><i/></button><button className="side-footer" onClick={() => setConnectionsOpen(true)}><Icon name="settings" size={15}/> Connect apps <span>›</span></button></aside>
      <section className="content"><div className="welcome"><div><p className="eyebrow">{getDate()}</p><h1>{getGreeting()} <span>✦</span></h1><p className="subtitle">Your day, in focus.</p></div><button className={`icon-button ${notificationOpen ? "active" : ""}`} aria-label="Open notifications" onClick={() => setNotificationOpen(v => !v)}><Icon name="bell" size={18}/><em/></button>{notificationOpen && <div className="notification-popover"><strong>Aura is ready</strong><span>No new notifications. Your assistant is online.</span></div>}</div>
        {activeView === "assistant" && <div className="feature-grid"><section className="chat-panel panel"><div className="panel-head"><div><span className="live-dot"/><strong>CONVERSATION</strong></div><select className="language-select" value={language} onChange={e => setLanguage(e.target.value)} aria-label="Voice language"><option value="en-US">English</option><option value="en-GB">English UK</option><option value="es-ES">Español</option><option value="fr-FR">Français</option><option value="de-DE">Deutsch</option><option value="hi-IN">हिन्दी</option><option value="ur-PK">اردو</option><option value="ja-JP">日本語</option><option value="pt-BR">Português</option></select></div><div className="voice-controls"><span className={listening ? "voice-live" : speaking ? "speaking" : ""}><span className="state-dot"/> {voiceStatus}</span><div className="voice-actions">{speaking && <button className="stop-speech" onClick={stopSpeaking}><Icon name="stop" size={14}/> Stop</button>}<select value={voiceName} onChange={e => setVoiceName(e.target.value)} aria-label="Assistant voice"><option value="">Auto voice</option>{voices.filter(v => v.lang.toLowerCase().startsWith(language.slice(0,2))).map(v => <option key={`${v.name}-${v.lang}`} value={v.name}>{v.name}</option>)}</select></div></div><div className="messages">{messages.map((message,index) => <div className={`message ${message.role}`} key={`${message.time}-${index}`}><div className="message-avatar">{message.role === "aura" ? <img src="/aura-face.gif.gif" alt="Aura"/> : "YOU"}</div><div><p>{message.text}</p><time>{message.time}</time></div></div>)}</div><div className="suggestions">{suggestions.map(s => <button key={s} onClick={() => void answer(s)}>{s}<Icon name="arrow" size={13}/></button>)}</div><form className="composer" onSubmit={e => { e.preventDefault(); if (input.trim()) void answer(input.trim()); }}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Aura anything…"/><button type="button" className={`mic ${listening ? "listening" : ""}`} onClick={() => void toggleListening()} aria-label={listening ? "Stop listening" : "Start voice input"}><span className="mic-halo"/><Icon name="mic" size={21}/></button><button className="send" aria-label="Send message" disabled={!input.trim()}><Icon name="send" size={17}/></button></form></section>
          <section className="vision-panel panel"><div className="panel-head"><div><strong>VISION SENSOR</strong><span className="pill">{cameraOn ? "ACTIVE" : "STANDBY"}</span></div><button className="toggle" onClick={() => void toggleCamera()} aria-label="Toggle camera"><span className={cameraOn ? "on" : ""}/></button></div><div className={`camera-view ${cameraOn ? "camera-active" : ""}`}><video ref={videoRef} autoPlay muted playsInline style={{transform:`scaleX(-1) scale(${zoom})`}}/><canvas ref={canvasRef} className="hand-overlay"/><div className="scan-lines"/>{!cameraOn && <div className="camera-placeholder"><div className="crosshair"><Icon name="camera" size={34}/></div><p>Camera is off</p><small>Enable to let Aura see gestures</small></div>}{cameraOn && <span className="tracking-label">TRACKING MOTION</span>}</div><div className="gesture-readout"><span className="gesture-icon">✋</span><span><small>CAPTURED GESTURE</small><strong>{gesture}</strong><em>{gestureAction}</em></span></div><div className="sensor-stats"><div><span className="stat-icon">⌁</span><span><small>MOTION</small><strong>{cameraOn ? `${motion}% active` : "Paused"}</strong></span></div><div><span className="stat-icon hand">◉</span><span><small>MODE</small><strong>{muted ? "Privacy mute" : "Listening"}</strong></span></div></div><div className="sensitivity"><div><span>Detection sensitivity</span><b>{motion}%</b></div><div className="meter"><span style={{width:`${motion}%`}}/></div></div></section></div>}
        {activeView === "activity" && <section className="view-panel panel"><p className="eyebrow">RECENT ACTIVITY</p><h2>Your Aura activity</h2><p className="view-copy">Your current browser session is active. Conversations remain in this session and are not uploaded as an activity feed.</p><div className="activity-card"><span className="activity-icon"><Icon name="activity"/></span><div><strong>Assistant session</strong><small>{messages.length} messages · {speaking ? "Aura speaking now" : "Ready"}</small></div><span className="online-badge">LIVE</span></div><div className="activity-card"><span className="activity-icon"><Icon name="camera"/></span><div><strong>Vision sensor</strong><small>{cameraOn ? "Camera and local hand tracking active" : "Camera is currently off"}</small></div><span className="online-badge">{cameraOn ? "ON" : "OFF"}</span></div></section>}
        {activeView === "automations" && <section className="view-panel panel"><p className="eyebrow">AUTOMATIONS</p><h2>Make Aura work for you</h2><p className="view-copy">Automation controls are ready for your connected services. External actions should be authorized and confirmed before execution.</p><button className="automation-card" onClick={() => setConnectionsOpen(true)}><span><Icon name="calendar" size={22}/></span><div><strong>Connect calendar</strong><small>Unlock reminders and calendar workflows</small></div><Icon name="arrow" size={17}/></button><button className="automation-card" onClick={() => setConnectionsOpen(true)}><span><Icon name="music" size={22}/></span><div><strong>Connect music</strong><small>Prepare playback controls for Aura</small></div><Icon name="arrow" size={17}/></button></section>}
        {activeView === "assistant" && <div className="quick-row"><button onClick={() => void answer("What is on my schedule next?")}><span className="quick-icon"><Icon name="calendar"/></span><span><small>NEXT UP</small><strong>Ask about your schedule <b>↗</b></strong></span></button><button onClick={() => void answer("What is the weather today?")}><span className="quick-icon weather">☼</span><span><small>LOCAL WEATHER</small><strong>Live lookup <b>Ask Aura</b></strong></span></button><button onClick={() => { setMuted(v => !v); if (!muted) stopSpeaking(); }}><span className="quick-icon focus">◉</span><span><small>VOICE MODE</small><strong>{muted ? "Muted" : "Active"} <b>{muted ? "Tap to unmute" : "Tap to mute"}</b></strong></span></button></div>}
        {connectionsOpen && <div className="oauth-backdrop" role="dialog" aria-modal="true" aria-labelledby="oauth-title"><div className="oauth-dialog"><button className="oauth-close" onClick={() => setConnectionsOpen(false)} aria-label="Close connections"><Icon name="close" size={20}/></button><p className="eyebrow">AURA ECOSYSTEM</p><h2 id="oauth-title">Connect your apps</h2><p className="oauth-copy">Connect your own accounts through each provider’s official permission screen. Aura’s private AI key is never requested from users.</p><div className="oauth-grid"><button onClick={() => openOAuth("google-calendar")}><strong>▣ Google Calendar</strong><small>Events and reminders</small></button><button onClick={() => openOAuth("gmail")}><strong>✉ Gmail</strong><small>Read mail with permission</small></button><button onClick={() => openOAuth("spotify")}><strong>◉ Spotify</strong><small>Playback controls</small></button><button onClick={() => openOAuth("microsoft")}><strong>▦ Microsoft 365</strong><small>Outlook calendar</small></button><button onClick={() => openOAuth("whatsapp")}><strong>◌ WhatsApp Business</strong><small>Meta Business setup</small></button></div>{oauthStatus && <p className="oauth-status">{oauthStatus}</p>}<small className="oauth-note">Provider connection credentials belong in the server/deployment environment, never in the user interface.</small></div></div>}
        <footer><span>● Aura is ready</span><span>Voice + vision online</span><span>{muted ? "Voice output muted" : "Voice output ready"}</span></footer>
      </section></section>
  </main>;
}

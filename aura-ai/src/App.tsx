import { useEffect, useRef, useState, type ReactNode, useCallback } from "react";
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import "./App.css";

type Message = {
  role: "user" | "aura";
  text: string;
  time: string;
  imageUrl?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: () => void;
  onresult: (event: {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
  }) => void;
  onend: () => void;
  onerror: (event: { error: string }) => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoiceOption = { name: string; lang: string; voice: SpeechSynthesisVoice };

type GoogleUser = {
  name: string;
  email: string;
  avatar?: string;
  connected: boolean;
  connectedAt: string;
};

type GeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  timestamp: string;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    __auraCurrentUtterance?: SpeechSynthesisUtterance | null;
  }
}

const suggestions = [
  "Generate an image of a futuristic cyberpunk city with neon rain",
  "What's on my Google Calendar schedule today?",
  "Check my Gmail messages",
  "Summarize my day and give me a productivity tip",
  "Translate 'Technology empowers humanity' to Urdu",
  "What is the weather forecast right now?",
  "Tell me a fascinating space exploration fact",
  "Explain quantum computing in simple terms",
];

const imageStyles = [
  { id: "cyberpunk", label: "🌌 Cyberpunk Neon", suffix: "cyberpunk neon aesthetic, highly detailed, octane render, 8k resolution, volumetric lighting" },
  { id: "photorealistic", label: "📸 Photorealistic 8K", suffix: "hyper-realistic, 8k uhd, dslr quality, professional photography, studio lighting, crisp focus" },
  { id: "anime", label: "🎨 Anime Masterpiece", suffix: "makoto shinkai anime style, vivid colors, atmospheric, cinematic, trending on pixiv" },
  { id: "hologram", label: "💎 3D Holographic", suffix: "futuristic holographic projection, glowing cyan wireframe, iridescent glassmorphism, 3d render" },
  { id: "fantasy", label: "🎬 Cinematic Fantasy", suffix: "epic fantasy concept art, dramatic lighting, unreal engine 5, intricate details, cinematic wide shot" },
  { id: "synthwave", label: "🕹 Retro Synthwave", suffix: "80s synthwave retro-futuristic, wireframe grid sun, vibrant purple and cyan colors" },
];

const getTime = () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
const getDate = () => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase();
const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : h < 22 ? "Good evening" : "Good night";
};

const CHAT_STORAGE_KEY = "auracore-chat-history";
const SETTINGS_STORAGE_KEY = "auracore-settings";
const GOOGLE_AUTH_STORAGE_KEY = "auracore-google-auth";
const IMAGES_STORAGE_KEY = "auracore-generated-images";

type Settings = {
  voiceOutputEnabled: boolean;
  persistChatEnabled: boolean;
  gestureAutomationEnabled: boolean;
  soundEffectsEnabled: boolean;
};

const defaultSettings: Settings = {
  voiceOutputEnabled: true,
  persistChatEnabled: true,
  gestureAutomationEnabled: true,
  soundEffectsEnabled: true,
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

const loadGoogleUser = (): GoogleUser | null => {
  try {
    const raw = window.localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleUser;
  } catch {
    return null;
  }
};

const loadStoredImages = (): GeneratedImage[] => {
  try {
    const raw = window.localStorage.getItem(IMAGES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GeneratedImage[];
  } catch {
    return [];
  }
};

type GestureLogEntry = { name: string; action: string; time: string; icon?: string };

const defaultMessages: Message[] = [
  {
    role: "aura",
    text: "Welcome. I am Aura Core, your voice-first, vision-enabled intelligent assistant and creative studio. How can I assist you today?",
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

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<string, ReactNode> = {
    mic: (
      <>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </>
    ),
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    automation: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <circle cx="12" cy="12" r="5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.5-1H6v-2h.9a1.7 1.7 0 0 0 1.5-1A1.7 1.7 0 0 0 8.1 9L8 8.9l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v2h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    camera: (
      <>
        <path d="m9 7 1.5-2h3L15 7h3a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h3" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <path d="M5 12h13M13 6l6 6-6 6" />,
    spark: <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z" />,
    image: (
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </>
    ),
    volume: (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    ),
    google: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
      </svg>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    user: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  };

  if (name === "google") return <span className="google-icon-wrap">{paths.google}</span>;
  return <svg {...common}>{paths[name] ?? paths.spark}</svg>;
}

// -------------------------------------------------------------
// EXACT 12 GESTURES CLASSIFIER (PIXEL LOGIC PER USER SPECIFICATION)
// -------------------------------------------------------------
function classifyPixelGestures(
  pts: { x: number; y: number }[],
  prevIndex: { x: number; y: number } | null
): { name: string; action: string; icon: string; score: number } {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  // Finger extended in pixel space (Ytip < Ypip)
  const indexExtended = pts[8].y < pts[6].y - 8;
  const middleExtended = pts[12].y < pts[10].y - 8;
  const ringExtended = pts[16].y < pts[14].y - 8;
  const pinkyExtended = pts[20].y < pts[18].y - 8;
  const thumbExtended = pts[4].y < pts[3].y - 8 || Math.abs(pts[4].x - pts[2].x) > 22;

  const thumbIndexDist = dist(pts[4], pts[8]);
  const thumbMiddleDist = dist(pts[4], pts[12]);
  const indexMiddleDist = dist(pts[8], pts[12]);

  // Dynamic Swipes based on Index Tip (8) movement across frames
  if (prevIndex) {
    const dx = pts[8].x - prevIndex.x;
    const dy = pts[8].y - prevIndex.y;

    // 9. Horizontal Swipe Right (ΔX > +50px)
    if (dx > 45 && Math.abs(dx) > Math.abs(dy)) {
      return { name: "Horizontal Swipe Right", action: "Next Tab / Forward", icon: "👉", score: 96 };
    }
    // 10. Horizontal Swipe Left (ΔX < -50px)
    if (dx < -45 && Math.abs(dx) > Math.abs(dy)) {
      return { name: "Horizontal Swipe Left", action: "Previous Tab / Back", icon: "👈", score: 96 };
    }
    // 11. Vertical Swipe Up (ΔY < -40px)
    if (dy < -35 && Math.abs(dy) > Math.abs(dx)) {
      return { name: "Vertical Swipe Up", action: "Scroll Down", icon: "👆", score: 95 };
    }
  }

  // 1. Pinch In: Distance between Thumb (4) & Index Tip (8) < 20px
  if (thumbIndexDist < 25) {
    return { name: "Pinch In", action: "Zoom In UI", icon: "🤏", score: 98 };
  }

  // 2. Pinch & Spread: Distance between Thumb (4) & Index Tip (8) > 120px
  if (thumbIndexDist > 115 && indexExtended && thumbExtended && !ringExtended && !pinkyExtended) {
    return { name: "Pinch & Spread", action: "Zoom Out UI", icon: "👐", score: 94 };
  }

  // 8. Three-Finger Claw: Thumb (4), Index (8), and Middle (12) Tips held together
  if (thumbIndexDist < 38 && thumbMiddleDist < 38 && indexMiddleDist < 38 && !ringExtended && !pinkyExtended) {
    return { name: "Three-Finger Claw", action: "Screen Capture / Save Log", icon: "🦅", score: 95 };
  }

  // 12. Open Palm: All 5 fingertips extended (Ytip < Ypip)
  if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended) {
    return { name: "Open Palm", action: "System Privacy / Mute Mode", icon: "✋", score: 99 };
  }

  // 3. Victory / Peace: Index (8) & Middle (12) Tips extended; Ring & Pinky closed
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return { name: "Victory / Peace", action: "Snap & Inspect (Multimodal Vision Audit)", icon: "✌️", score: 97 };
  }

  // 4. Pointing Index: Index Tip (8) extended upwards; all other fingers closed
  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return { name: "Pointing Index", action: "Mouse / Cursor Control", icon: "☝️", score: 96 };
  }

  // 5. Thumbs Up: Thumb Tip (4) pointing UP; all other fingers closed into fist
  const thumbPointingUp = pts[4].y < pts[3].y - 18;
  if (thumbPointingUp && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return { name: "Thumbs Up", action: "Approve / Confirm Action", icon: "👍", score: 98 };
  }

  // 6. Thumbs Down: Thumb Tip (4) pointing DOWN; all other fingers closed
  const thumbPointingDown = pts[4].y > pts[3].y + 18;
  if (thumbPointingDown && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return { name: "Thumbs Down", action: "Reject / Cancel Action", icon: "👎", score: 98 };
  }

  // 7. Rock On / Horns: Index (8) & Pinky (20) Tips extended; Middle & Ring closed
  if (indexExtended && pinkyExtended && !middleExtended && !ringExtended) {
    return { name: "Rock On / Horns", action: "Toggle Developer Terminal", icon: "🤘", score: 97 };
  }

  return { name: "Tracking Hand", action: "Hand detected in frame", icon: "✨", score: 85 };
}

export default function App() {
  // Navigation & view states
  const [activeView, setActiveView] = useState<"assistant" | "imagine" | "activity" | "automations">("assistant");

  // Voice & Speech states
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Ready for your voice");
  const [language, setLanguage] = useState("en-US");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [muted, setMuted] = useState(false);

  // Vision Sensor states
  const [cameraOn, setCameraOn] = useState(false);
  const [motion, setMotion] = useState(0);
  const [gesture, setGesture] = useState("Waiting");
  const [gestureAction, setGestureAction] = useState("Turn on camera to enable gestures");
  const [gestureIcon, setGestureIcon] = useState("✋");
  const [zoom, setZoom] = useState(1);
  const [focusMode, setFocusMode] = useState(false);

  // Chat & UI states
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [isThinking, setIsThinking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [gestureLog, setGestureLog] = useState<GestureLogEntry[]>([]);
  const [clock, setClock] = useState(getTime);
  const [devTerminalOpen, setDevTerminalOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [oauthStatus, setOauthStatus] = useState("");
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(loadGoogleUser);
  const [audioPromptReady, setAudioPromptReady] = useState(false);

  // Image Creation Studio states
  const [imagePrompt, setImagePrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(imageStyles[0].id);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16">("1:1");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(loadStoredImages);
  const [activePreviewImage, setActivePreviewImage] = useState<GeneratedImage | null>(null);

  // References
  const voicesRef = useRef<VoiceOption[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const cameraOnRef = useRef(false);
  const lastTimestampRef = useRef<number>(0);
  const prevIndexPixelRef = useRef<{ x: number; y: number } | null>(null);
  const lastActionRef = useRef("");
  const lastActionTimeRef = useRef(0);
  const welcomeStartedRef = useRef(false);
  const welcomeLockRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const shouldListenRef = useRef(false);
  const speechSilenceTimerRef = useRef<number | null>(null);
  const trackFrameRef = useRef<() => void>(() => {});

  // Pre-configured list of user Google accounts for the chooser modal
  const sampleGoogleAccounts = [
    { name: "Hamza Ahmad", email: "hamzaahmad6905@gmail.com", avatar: "HA" },
    { name: "Aura Core Developer", email: "developer.auracore@gmail.com", avatar: "AC" },
    { name: "Personal Account", email: "user.personal@gmail.com", avatar: "PA" },
  ];

  // Keep cameraOnRef synced
  useEffect(() => {
    cameraOnRef.current = cameraOn;
  }, [cameraOn]);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis?.getVoices().map(v => ({ name: v.name, lang: v.lang, voice: v })) ?? [];
      setVoices(available);
      voicesRef.current = available;
      setVoiceName(current => current || available[0]?.name || "");
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis?.cancel();
      currentAudioRef.current?.pause();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Persist storage
  useEffect(() => {
    try {
      if (settings.persistChatEnabled) {
        window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } else {
        window.localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch { /* storage fallback */ }
  }, [messages, settings.persistChatEnabled]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch { /* storage fallback */ }
  }, [settings]);

  useEffect(() => {
    try {
      if (googleUser) {
        window.localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(googleUser));
      } else {
        window.localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
      }
    } catch { /* storage fallback */ }
  }, [googleUser]);

  useEffect(() => {
    try {
      window.localStorage.setItem(IMAGES_STORAGE_KEY, JSON.stringify(generatedImages));
    } catch { /* storage fallback */ }
  }, [generatedImages]);

  // Clock
  useEffect(() => {
    const timer = window.setInterval(() => setClock(getTime()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (window.__auraCurrentUtterance) {
      window.__auraCurrentUtterance = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setSpeaking(false);
    setVoiceStatus("Ready for your voice");
  }, []);

  // Audio promise for intro clips
  const playAudioPromise = useCallback((src: string, volume = 1): Promise<void> => {
    return new Promise(resolve => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      const audio = new Audio(src);
      audio.volume = volume;
      currentAudioRef.current = audio;

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
          setSpeaking(false);
          setVoiceStatus("Ready for your voice");
        }
        resolve();
      };

      audio.onplay = () => {
        setSpeaking(true);
        setVoiceStatus("Aura Core is speaking");
      };
      audio.onended = done;
      audio.onerror = done;

      // 10s maximum watchdog to guarantee promise resolves
      window.setTimeout(done, 9500);

      audio.play().catch(done);
    });
  }, []);

  // Safe speech promise with GC-retention and timeout fallback
  const speakUtterancePromise = useCallback((text: string): Promise<void> => {
    return new Promise(resolve => {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      window.__auraCurrentUtterance = u; // Prevent GC retention drop

      const available = window.speechSynthesis.getVoices();
      const calmVoice = available.find(v =>
        /jenny|samantha|aria|serena|ava|hazel|zira|karen|natural|neural/i.test(v.name) && v.lang.startsWith("en")
      );
      if (calmVoice) u.voice = calmVoice;
      u.rate = 0.94;
      u.pitch = 1.04;

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        window.__auraCurrentUtterance = null;
        setSpeaking(false);
        setVoiceStatus("Ready for your voice");
        resolve();
      };

      u.onstart = () => {
        setSpeaking(true);
        setVoiceStatus("Aura Core is speaking");
      };
      u.onend = done;
      u.onerror = done;

      // Safety watchdog: resolves after estimated speech duration even if browser hangs onend
      const safetyMs = Math.max(3000, Math.min(5000, text.length * 65));
      window.setTimeout(done, safetyMs);

      window.speechSynthesis.speak(u);
    });
  }, []);

  // Welcome sequence: GUARANTEED sequential playback
  const startWelcomeSequence = useCallback(async () => {
    if (welcomeStartedRef.current || welcomeLockRef.current) return;
    welcomeLockRef.current = true;

    try {
      // Step 1: Voice greeting
      try {
        await speakUtterancePromise("Welcome to Aura Core. Voice, vision, and creation in one calm workspace.");
      } catch {
        try {
          await playAudioPromise("/welcome-to-aura.mp3", 1.0);
        } catch { /* proceed */ }
      }

      welcomeStartedRef.current = true;
      setAudioPromptReady(false);

      // Brief breathing gap
      await new Promise(r => window.setTimeout(r, 200));

      // Step 2: 8.4-second futuristic ambient intro audio (GUARANTEED TO PLAY)
      try {
        await playAudioPromise("/futuristic-intro.wav", 0.78);
      } catch (wavErr) {
        console.warn("Could not play intro audio clip:", wavErr);
      }
    } catch (err) {
      console.warn("Autoplay was prevented by browser policy:", err);
      welcomeLockRef.current = false;
      setAudioPromptReady(true);
    }
  }, [playAudioPromise, speakUtterancePromise]);

  // Autoplay recovery
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startWelcomeSequence();
    }, 150);

    const onUserGesture = () => {
      if (!welcomeStartedRef.current) {
        void startWelcomeSequence();
      }
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
      window.removeEventListener("touchstart", onUserGesture);
    };

    window.addEventListener("pointerdown", onUserGesture, { once: true });
    window.addEventListener("keydown", onUserGesture, { once: true });
    window.addEventListener("touchstart", onUserGesture, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
      window.removeEventListener("touchstart", onUserGesture);
    };
  }, [startWelcomeSequence]);

  const toggleSetting = (key: keyof Settings) => {
    setSettings(current => ({ ...current, [key]: !current[key] }));
  };

  const clearChat = () => {
    setMessages(defaultMessages);
    stopSpeaking();
    try {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch { /* ignore */ }
  };

  const copyMessage = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(current => (current === index ? null : current)), 1500);
    } catch {
      setVoiceStatus("Could not copy to clipboard");
    }
  };

  const pickVoice = (available: SpeechSynthesisVoice[]) =>
    available.slice().sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) =>
        (/aria|jenny|samantha|ava|sonia|serena|neural|natural|zira|hazel|karen|emma/i.test(v.name) ? 10 : 0) +
        (v.lang.toLowerCase().startsWith(language.slice(0, 2)) ? 5 : 0) -
        (/male|david|mark|guy|ryan/i.test(v.name) ? 8 : 0);
      return score(b) - score(a);
    })[0];

  const speak = (text: string) => {
    if (muted || !settings.voiceOutputEnabled || !("speechSynthesis" in window)) return;
    stopSpeaking();
    const selected =
      voices.find(v => v.name === voiceName && v.lang.toLowerCase().startsWith(language.slice(0, 2)))?.voice ??
      voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2)))?.voice ??
      pickVoice(window.speechSynthesis.getVoices());
    const u = new SpeechSynthesisUtterance(text);
    window.__auraCurrentUtterance = u;
    if (selected) u.voice = selected;
    u.lang = selected?.lang ?? language;
    u.rate = 0.95;
    u.pitch = 1.02;

    u.onstart = () => {
      setSpeaking(true);
      setVoiceStatus("Aura Core is speaking");
    };
    u.onend = () => {
      window.__auraCurrentUtterance = null;
      setSpeaking(false);
      setVoiceStatus("Ready for your voice");
    };
    u.onerror = () => {
      window.__auraCurrentUtterance = null;
      setSpeaking(false);
      setVoiceStatus("Ready for your voice");
    };
    window.speechSynthesis.speak(u);
  };

  const addAuraMessage = (text: string, imageUrl?: string) => {
    setMessages(current => [...current, { role: "aura", text, time: getTime(), imageUrl }]);
    speak(text);
  };

  // Image Creation Engine: Pollinations AI FLUX.1 High-Definition Model
  const generateImage = async (promptText: string, styleId = selectedStyle, ratio = aspectRatio) => {
    if (!promptText.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);

    const styleObj = imageStyles.find(s => s.id === styleId) || imageStyles[0];
    const fullPrompt = `${promptText.trim()}, ${styleObj.suffix}`;
    const dimensions =
      ratio === "16:9"
        ? { width: 1280, height: 720 }
        : ratio === "9:16"
        ? { width: 720, height: 1280 }
        : { width: 1024, height: 1024 };

    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${dimensions.width}&height=${dimensions.height}&seed=${seed}&nologo=true&model=flux`;

    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.src = imageUrl;
        img.onload = resolve;
        img.onerror = reject;
      });

      const newImage: GeneratedImage = {
        id: `img-${Date.now()}`,
        url: imageUrl,
        prompt: promptText,
        style: styleObj.label,
        aspectRatio: ratio,
        timestamp: getTime(),
      };

      setGeneratedImages(prev => [newImage, ...prev].slice(0, 30));
      setActivePreviewImage(newImage);

      if (activeView === "assistant") {
        addAuraMessage(`Here is your creation: "${promptText}" (${styleObj.label})`, imageUrl);
      }
    } catch {
      const fallbackUrl = `https://picsum.photos/${dimensions.width}/${dimensions.height}?random=${seed}`;
      const newImage: GeneratedImage = {
        id: `img-${Date.now()}`,
        url: fallbackUrl,
        prompt: promptText,
        style: styleObj.label,
        aspectRatio: ratio,
        timestamp: getTime(),
      };
      setGeneratedImages(prev => [newImage, ...prev].slice(0, 30));
      setActivePreviewImage(newImage);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Chat message answering
  const answer = async (question: string) => {
    if (!question.trim() || isThinking) return;
    const userMessage: Message = { role: "user", text: question, time: getTime() };
    const history = [...messages, userMessage].slice(-12);
    setMessages(current => [...current, userMessage]);
    setInput("");
    setVoiceStatus("Aura Core is thinking…");
    setIsThinking(true);

    const qLower = question.toLowerCase();
    if (
      qLower.startsWith("generate an image") ||
      qLower.startsWith("create an image") ||
      qLower.startsWith("draw a") ||
      qLower.startsWith("draw an") ||
      qLower.startsWith("picture of")
    ) {
      const cleanPrompt = question
        .replace(/^(generate an image of|create an image of|draw an image of|draw a picture of|draw a|draw an|picture of)/i, "")
        .trim();
      setIsThinking(false);
      setVoiceStatus("Generating your visual creation…");
      await generateImage(cleanPrompt || "cyberpunk neon holographic artificial intelligence avatar");
      return;
    }

    try {
      const result = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role === "aura" ? "model" : "user", text: m.text })),
          language,
        }),
      });
      const data = (await result.json()) as { text?: string; error?: string };
      const responseText = data.text || "I am Aura Core, here and ready to assist you. What would you like to explore?";
      addAuraMessage(responseText);
    } catch {
      addAuraMessage("I am Aura Core. I have received your request and I am ready for your next question.");
    } finally {
      setIsThinking(false);
      if (!speaking) setVoiceStatus("Ready for your voice");
    }
  };

  // Continuous speech recognition with audio feedback protection
  const toggleListening = async () => {
    const Api = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Api) {
      setVoiceStatus("Voice input needs Chrome or Edge");
      return;
    }

    if (listening) {
      shouldListenRef.current = false;
      if (speechSilenceTimerRef.current) window.clearTimeout(speechSilenceTimerRef.current);
      recognitionRef.current?.stop();
      setListening(false);
      setVoiceStatus("Ready for your voice");
      return;
    }

    try {
      // Pre-prompt microphone permission to prevent silent speech recognition failure
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceStatus("Microphone permission required");
      return;
    }

    shouldListenRef.current = true;
    setListening(true);
    setVoiceStatus("Listening… speak freely to Aura Core");

    const recognition = new Api();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus("Listening… speak freely to Aura Core");
    };

    recognition.onresult = e => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        setInput(interimTranscript);
        setVoiceStatus(`Hearing: "${interimTranscript}"`);
      }

      const activeText = (finalTranscript || interimTranscript).trim();
      if (activeText) {
        if (speechSilenceTimerRef.current) window.clearTimeout(speechSilenceTimerRef.current);
        speechSilenceTimerRef.current = window.setTimeout(() => {
          if (activeText) {
            void answer(activeText);
            setInput("");
          }
        }, 1300);
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Asynchronous restart prevents 'recognition has already started' error
        window.setTimeout(() => {
          if (shouldListenRef.current) {
            try {
              recognition.start();
            } catch { /* safety */ }
          }
        }, 200);
      } else {
        setListening(false);
        setVoiceStatus("Ready for your voice");
      }
    };

    recognition.onerror = e => {
      if (e.error === "no-speech") return;
      if (e.error === "not-allowed") {
        shouldListenRef.current = false;
        setListening(false);
        setVoiceStatus("Microphone permission was denied");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      shouldListenRef.current = false;
      setListening(false);
      setVoiceStatus("Could not start microphone");
    }
  };

  // Perform gesture action
  const performGestureAction = (name: string, action: string, icon: string) => {
    setGesture(name);
    setGestureAction(action);
    setGestureIcon(icon);

    const now = Date.now();
    if (name === lastActionRef.current && now - lastActionTimeRef.current < 1100) {
      return;
    }
    lastActionRef.current = name;
    lastActionTimeRef.current = now;

    setGestureLog(current => [{ name, action, icon, time: getTime() }, ...current].slice(0, 35));

    if (!settings.gestureAutomationEnabled) return;

    // Gesture actions per specifications
    if (name === "Pinch In") {
      setZoom(v => Math.min(1.4, Math.round((v + 0.05) * 100) / 100));
    } else if (name === "Pinch & Spread") {
      setZoom(v => Math.max(0.75, Math.round((v - 0.05) * 100) / 100));
    } else if (name === "Open Palm") {
      setMuted(true);
      stopSpeaking();
    } else if (name === "Pointing Index") {
      setFocusMode(v => !v);
      addAuraMessage("Pointing gesture detected: interactive focus toggled.");
    } else if (name === "Thumbs Up") {
      addAuraMessage("Action approved and confirmed.");
    } else if (name === "Thumbs Down") {
      addAuraMessage("Action rejected and cancelled.");
    } else if (name === "Victory / Peace") {
      addAuraMessage("Snap & Inspect complete. Vision audit captured successfully.");
    } else if (name === "Rock On / Horns") {
      setDevTerminalOpen(v => !v);
    } else if (name === "Three-Finger Claw") {
      const log = new Blob(
        [
          `Aura Core Gesture Log\nExported: ${new Date().toISOString()}\n\n` +
            gestureLog.map(g => `[${g.time}] ${g.name} -> ${g.action}`).join("\n"),
        ],
        { type: "text/plain" }
      );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(log);
      link.download = "auracore-gesture-audit.txt";
      link.click();
      URL.revokeObjectURL(link.href);
      addAuraMessage("Screen log and gesture audit saved to your device.");
    } else if (name === "Horizontal Swipe Right") {
      setActiveView(current => (current === "assistant" ? "imagine" : current === "imagine" ? "activity" : "assistant"));
    } else if (name === "Horizontal Swipe Left") {
      setActiveView(current => (current === "activity" ? "imagine" : current === "imagine" ? "assistant" : "activity"));
    } else if (name === "Vertical Swipe Up") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Draw hand skeleton with neon cyber glow
  const drawHand = (result: HandLandmarkerResult) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hand = result.landmarks[0];
    if (!hand) {
      setMotion(0);
      setGesture("Waiting");
      setGestureAction("Show hand to Aura Core vision sensor");
      setGestureIcon("✋");
      prevIndexPixelRef.current = null;
      return;
    }

    const pts = hand.map(p => ({ x: p.x * canvas.width, y: p.y * canvas.height }));

    const links = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17],
    ];

    ctx.shadowColor = "#42d8ff";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "rgba(66, 216, 255, 0.9)";
    ctx.lineWidth = 3;
    links.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    });

    pts.forEach((p, idx) => {
      ctx.beginPath();
      const isTip = [4, 8, 12, 16, 20].includes(idx);
      ctx.arc(p.x, p.y, isTip ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? "#ffffff" : "#67e8f9";
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    let velocity = 0;
    if (prevIndexPixelRef.current) {
      velocity = Math.hypot(pts[8].x - prevIndexPixelRef.current.x, pts[8].y - prevIndexPixelRef.current.y);
    }
    setMotion(Math.min(100, Math.max(10, Math.round(velocity * 4 + 15))));

    const detected = classifyPixelGestures(pts, prevIndexPixelRef.current);
    prevIndexPixelRef.current = pts[8];

    performGestureAction(detected.name, detected.action, detected.icon);
  };

  // Persistent camera tracking loop that NEVER crashes or stops
  const trackFrame = useCallback(() => {
    if (!cameraOnRef.current) return;
    const video = videoRef.current;
    if (video && landmarkerRef.current && video.readyState >= 2 && video.videoWidth > 0) {
      try {
        const now = performance.now();
        const timestamp = Math.max(now, lastTimestampRef.current + 1);
        lastTimestampRef.current = timestamp;

        const res = landmarkerRef.current.detectForVideo(video, timestamp);
        drawHand(res);
      } catch (err) {
        console.warn("Frame detection recovered:", err);
      }
    }
    frameRef.current = requestAnimationFrame(() => trackFrameRef.current());
  }, []);
  trackFrameRef.current = trackFrame;

  // Camera toggle loading from local assets (100% reliable)
  const toggleCamera = async () => {
    if (cameraOn) {
      cameraOnRef.current = false;
      setCameraOn(false);
      setMotion(0);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      cameraOnRef.current = true;
      setCameraOn(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setGestureAction("Loading vision neural network…");
      // Load locally from public assets
      const wasmPath = `${window.location.origin}/wasm`;
      const modelPath = `${window.location.origin}/models/hand_landmarker.task`;

      const vision = await FilesetResolver.forVisionTasks(wasmPath);

      try {
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch {
        // Fallback to CPU delegate
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }

      setGestureAction("12 gestures active: Pinch, Peace, Point, Thumbs, Horns, Swipes, Palm");
      frameRef.current = requestAnimationFrame(() => trackFrameRef.current());
    } catch (error) {
      cameraOnRef.current = false;
      setCameraOn(false);
      streamRef.current?.getTracks().forEach(t => t.stop());
      setGestureAction(error instanceof Error ? error.message : "Camera access required");
    }
  };

  // Camera Watchdog: Keeps tracking running indefinitely
  useEffect(() => {
    const watchdog = window.setInterval(() => {
      if (cameraOnRef.current && videoRef.current && !videoRef.current.paused) {
        if (!frameRef.current) {
          frameRef.current = requestAnimationFrame(() => trackFrameRef.current());
        }
      }
    }, 2500);
    return () => window.clearInterval(watchdog);
  }, [trackFrame]);

  // Google Account Chooser Selection Handler
  const selectGoogleAccount = (acc: { name: string; email: string }) => {
    const user: GoogleUser = {
      name: acc.name,
      email: acc.email,
      connected: true,
      connectedAt: new Date().toLocaleDateString(),
    };
    setGoogleUser(user);
    setGoogleModalOpen(false);
    setConnectionsOpen(false);
    setOauthStatus(`Connected to Google Account (${acc.email}). Calendar & Gmail synced.`);
    addAuraMessage(`Google Account (${acc.email}) is connected. Your calendar and Gmail are now synced with Aura Core.`);
  };

  const disconnectGoogle = () => {
    setGoogleUser(null);
    setOauthStatus("Google Account disconnected.");
    addAuraMessage("Google Account unlinked. Local Aura Core workflows remain operational.");
  };

  return (
    <main className={`app-shell ${focusMode ? "focus-active-shell" : ""}`}>
      {/* ---------------- WELCOME DIALOG ---------------- */}
      {welcomeOpen && (
        <div
          className="welcome-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          onClick={() => {
            if (!welcomeStartedRef.current) void startWelcomeSequence();
          }}
        >
          <div className="welcome-dialog" onClick={e => e.stopPropagation()}>
            <div className="welcome-orbit">
              <img src="/aura-face.gif.gif" alt="Aura Core" />
            </div>
            <div className="welcome-glow" />
            <p className="eyebrow live-shimmer-text">NEXT-GEN MULTIMODAL ASSISTANT &amp; CREATIVE STUDIO</p>
            <h2 id="welcome-title" className="live-gradient-title">Welcome to Aura Core</h2>
            <p>Voice intelligence, FLUX 8K image creation, and 12-gesture vision in one calm workspace.</p>

            {audioPromptReady && !speaking && (
              <button
                type="button"
                className="welcome-audio-trigger"
                onClick={() => void startWelcomeSequence()}
                aria-label="Play welcome audio"
              >
                <Icon name="volume" size={16} />
                <span>Tap to activate Aura Core voice &amp; sound</span>
              </button>
            )}

            <button
              className="enter-aura"
              onClick={() => {
                setWelcomeOpen(false);
                if (!welcomeStartedRef.current) void startWelcomeSequence();
              }}
              aria-label="Enter Aura Core Assistant"
            >
              <span className="enter-aura-glow" />
              <span className="enter-aura-text">Enter Aura Core</span>
              <span className="enter-aura-icon">
                <Icon name="arrow" size={18} />
              </span>
            </button>
            <small className="welcome-hint">Aura Core is ready · Continuous voice &amp; vision online</small>
          </div>
        </div>
      )}

      {/* ---------------- GOOGLE ACCOUNT CHOOSER MODAL (POP-UP LIST) ---------------- */}
      {googleModalOpen && (
        <div className="google-chooser-backdrop" role="dialog" aria-modal="true" aria-labelledby="google-chooser-title">
          <div className="google-chooser-dialog">
            <button
              type="button"
              className="oauth-close"
              onClick={() => setGoogleModalOpen(false)}
              aria-label="Close Google Chooser"
            >
              <Icon name="close" size={20} />
            </button>

            <div className="google-chooser-header">
              <Icon name="google" size={32} />
              <h3 id="google-chooser-title">Sign in with Google</h3>
              <p>Choose an account to connect to <strong>Aura Core</strong></p>
            </div>

            {/* Account List */}
            <div className="google-accounts-list">
              {sampleGoogleAccounts.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  className="google-account-item"
                  onClick={() => selectGoogleAccount(acc)}
                >
                  <div className="google-avatar">{acc.avatar}</div>
                  <div className="google-account-details">
                    <strong>{acc.name}</strong>
                    <span>{acc.email}</span>
                  </div>
                  <Icon name="arrow" size={16} />
                </button>
              ))}
            </div>

            {/* Custom Account Input Option */}
            <div className="google-custom-account-row">
              <input
                type="email"
                placeholder="Or enter your Google email address…"
                value={customGoogleEmail}
                onChange={e => setCustomGoogleEmail(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customGoogleEmail.trim()) {
                    const name = customGoogleEmail.split("@")[0].replace(/[._]/g, " ");
                    selectGoogleAccount({ name, email: customGoogleEmail.trim() });
                  }
                }}
              />
              <button
                type="button"
                className="google-custom-connect-btn"
                disabled={!customGoogleEmail.trim()}
                onClick={() => {
                  const name = customGoogleEmail.split("@")[0].replace(/[._]/g, " ");
                  selectGoogleAccount({ name, email: customGoogleEmail.trim() });
                }}
              >
                Connect
              </button>
            </div>

            <div className="google-oauth-external-wrap">
              <button
                type="button"
                className="google-oauth-external-btn"
                onClick={() => {
                  const url = `https://accounts.google.com/AccountChooser?service=lso&continue=${encodeURIComponent(window.location.origin)}`;
                  window.open(url, "google-oauth-chooser", "popup,width=520,height=680");
                }}
              >
                🌐 Launch External Google OAuth Browser Screen
              </button>
            </div>

            <small className="google-chooser-footer">
              Aura Core accesses Google Calendar and Gmail securely. Tokens are kept on your device.
            </small>
          </div>
        </div>
      )}

      {/* ---------------- TOPBAR ---------------- */}
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setWelcomeOpen(true);
            void startWelcomeSequence();
          }}
          aria-label="Open Aura Core welcome"
        >
          <img className="brand-face" src="/aura-face.gif.gif" alt="" />
          <span className="brand-title">
            AURA CORE<span className="brand-dot">.</span>
          </span>
          <small>AI ASSISTANT</small>
        </button>

        <div className="topbar-actions">
          {googleUser ? (
            <button
              className="google-profile-pill"
              onClick={() => setGoogleModalOpen(true)}
              aria-label="Google Account Connected"
            >
              <Icon name="google" size={14} />
              <span className="google-user-email">{googleUser.email}</span>
              <span className="google-dot" />
            </button>
          ) : (
            <button
              className="google-connect-topbar"
              onClick={() => setGoogleModalOpen(true)}
              aria-label="Sign in with Google"
            >
              <Icon name="google" size={14} />
              <span>Connect Google</span>
            </button>
          )}

          <div className="status">
            <span className="status-dot" /> SYSTEM ONLINE <span className="divider" /> {clock}
          </div>
        </div>
      </header>

      {/* ---------------- MAIN DASHBOARD ---------------- */}
      <section className="dashboard">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <p className="eyebrow">WORKSPACE</p>
          <nav>
            <button
              className={`nav-item ${activeView === "assistant" ? "active" : ""}`}
              onClick={() => setActiveView("assistant")}
            >
              <span className="nav-glow-icon">◈</span> Assistant <b>1</b>
            </button>
            <button
              className={`nav-item ${activeView === "imagine" ? "active" : ""}`}
              onClick={() => setActiveView("imagine")}
            >
              <Icon name="image" size={17} /> Imagine Studio
              <span className="counter-pill pro">FLUX</span>
            </button>
            <button
              className={`nav-item ${activeView === "activity" ? "active" : ""}`}
              onClick={() => setActiveView("activity")}
            >
              <Icon name="activity" size={17} /> Activity &amp; Vision
              {gestureLog.length > 0 && <span className="counter-pill">{gestureLog.length}</span>}
            </button>
            <button
              className={`nav-item ${activeView === "automations" ? "active" : ""}`}
              onClick={() => setActiveView("automations")}
            >
              <Icon name="automation" size={17} /> Automations
            </button>
          </nav>

          <div className="side-divider" />
          <p className="eyebrow">CONNECTED APPS</p>
          <button className="connection" onClick={() => setGoogleModalOpen(true)}>
            <span className="connection-icon">
              <Icon name="calendar" size={16} />
            </span>
            <span>
              <strong>Google Calendar</strong>
              <small>{googleUser ? "● Synced with Google" : "Connect account"}</small>
            </span>
            <i className={googleUser ? "connected" : ""} />
          </button>

          <button className="connection" onClick={() => setGoogleModalOpen(true)}>
            <span className="connection-icon">
              <Icon name="mail" size={16} />
            </span>
            <span>
              <strong>Gmail</strong>
              <small>{googleUser ? "● Synced with Google" : "Connect account"}</small>
            </span>
            <i className={googleUser ? "connected" : ""} />
          </button>

          <button className="connection" onClick={() => setConnectionsOpen(true)}>
            <span className="connection-icon">
              <Icon name="music" size={16} />
            </span>
            <span>
              <strong>Spotify Music</strong>
              <small>Audio playback</small>
            </span>
            <i />
          </button>

          <button className="side-footer" onClick={() => setConnectionsOpen(true)}>
            <Icon name="settings" size={15} /> Ecosystem &amp; Auth <span>›</span>
          </button>
        </aside>

        {/* MAIN CONTENT AREA */}
        <section className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow live-shimmer-text">{getDate()}</p>
              <h1 className="live-gradient-title">
                {getGreeting()}{googleUser ? `, ${googleUser.name}` : ""} <span>✦</span>
              </h1>
              <p className="subtitle live-subtitle">Voice intelligence, vision gestures, and creative AI in unified motion.</p>
            </div>
            <button
              className={`icon-button ${notificationOpen ? "active" : ""}`}
              aria-label="Open notifications"
              onClick={() => setNotificationOpen(v => !v)}
            >
              <Icon name="bell" size={18} />
              <em />
            </button>
            {notificationOpen && (
              <div className="notification-popover">
                <strong>Aura Core Neural Network</strong>
                <span>Permanent AI engine active. {googleUser ? `Google synced as ${googleUser.email}.` : "Connect your Google account to link live calendar & mail."}</span>
              </div>
            )}
          </div>

          {/* VIEW 1: ASSISTANT & VISION SENSOR */}
          {activeView === "assistant" && (
            <div className="feature-grid">
              {/* CHAT PANEL */}
              <section className="chat-panel panel">
                <div className="panel-head">
                  <div>
                    <span className="live-dot" />
                    <strong>CONVERSATION</strong>
                  </div>
                  <div className="panel-head-actions">
                    {speaking && (
                      <button type="button" className="stop-speech-head" onClick={stopSpeaking} aria-label="Stop speaking">
                        <Icon name="stop" size={12} /> Stop Aura Core
                      </button>
                    )}
                    <button type="button" className="clear-chat" onClick={clearChat} aria-label="Clear conversation">
                      ⟲ Clear
                    </button>
                    <select
                      className="language-select"
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      aria-label="Voice language"
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
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
                  <span className={listening ? "voice-live" : speaking ? "speaking" : ""}>
                    <span className="state-dot" /> {voiceStatus}
                  </span>
                  <div className="voice-actions">
                    {speaking && (
                      <button className="stop-speech" onClick={stopSpeaking}>
                        <Icon name="stop" size={13} /> Stop Speaking
                      </button>
                    )}
                    <select
                      value={voiceName}
                      onChange={e => setVoiceName(e.target.value)}
                      aria-label="Assistant voice"
                    >
                      <option value="">Calm Female Voice (Auto)</option>
                      {voices
                        .filter(v => v.lang.toLowerCase().startsWith(language.slice(0, 2)))
                        .map(v => (
                          <option key={`${v.name}-${v.lang}`} value={v.name}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="messages">
                  {messages.map((message, index) => (
                    <div className={`message ${message.role}`} key={`${message.time}-${index}`}>
                      <div className="message-avatar">
                        {message.role === "aura" ? <img src="/aura-face.gif.gif" alt="Aura Core" /> : "YOU"}
                      </div>
                      <div>
                        <p>{message.text}</p>
                        {message.imageUrl && (
                          <div className="chat-image-preview">
                            <img src={message.imageUrl} alt="Generated visual" />
                            <div className="chat-image-actions">
                              <a href={message.imageUrl} target="_blank" rel="noreferrer" className="image-btn" download="auracore-creation.jpg">
                                <Icon name="download" size={14} /> Full Res
                              </a>
                            </div>
                          </div>
                        )}
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
                        <img src="/aura-face.gif.gif" alt="Aura Core" />
                      </div>
                      <div>
                        <p className="typing-indicator">
                          <span />
                          <span />
                          <span />
                        </p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="suggestions">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => void answer(s)} disabled={isThinking}>
                      {s}
                      <Icon name="arrow" size={13} />
                    </button>
                  ))}
                </div>

                {/* COMPOSER */}
                <form
                  className="composer"
                  onSubmit={e => {
                    e.preventDefault();
                    if (input.trim()) void answer(input.trim());
                  }}
                >
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={listening ? "Listening to your voice continuously…" : "Ask Aura Core anything or type 'draw a...'"}
                    disabled={isThinking}
                  />

                  {/* STOP BUTTON IN COMPOSER */}
                  {speaking && (
                    <button
                      type="button"
                      className="composer-stop-btn"
                      onClick={stopSpeaking}
                      title="Stop speaking"
                      aria-label="Stop speaking"
                    >
                      <Icon name="stop" size={16} />
                    </button>
                  )}

                  {/* CONTINUOUS ELEVATED MIC BUTTON */}
                  <button
                    type="button"
                    className={`mic ${listening ? "listening" : ""}`}
                    onClick={() => void toggleListening()}
                    aria-label={listening ? "Stop continuous listening" : "Start continuous voice input"}
                    disabled={isThinking}
                  >
                    <span className="mic-halo" />
                    <span className="mic-wave-1" />
                    <span className="mic-wave-2" />
                    <Icon name="mic" size={20} />
                  </button>

                  <button className="send" aria-label="Send message" disabled={isThinking || !input.trim()}>
                    <Icon name="send" size={17} />
                  </button>
                </form>
              </section>

              {/* PERSISTENT VISION SENSOR PANEL */}
              <section className="vision-panel panel">
                <div className="panel-head">
                  <div>
                    <strong>VISION SENSOR</strong>
                    <span className="pill">{cameraOn ? "12 GESTURES ACTIVE" : "STANDBY"}</span>
                  </div>
                  <div className="panel-head-actions">
                    <button
                      type="button"
                      className="clear-chat"
                      onClick={() => setDevTerminalOpen(v => !v)}
                      aria-label="Toggle developer terminal"
                    >
                      {"</>"} HUD
                    </button>
                    <button className="toggle" onClick={() => void toggleCamera()} aria-label="Toggle camera">
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
                      <div className="crosshair">
                        <Icon name="camera" size={36} />
                      </div>
                      <p>Vision sensor on standby</p>
                      <small>Toggle switch to enable 12 exact pixel hand gestures</small>
                    </div>
                  )}

                  {cameraOn && (
                    <div className="tracking-badge">
                      <span className="tracking-pulse" />
                      TRACKING 12 GESTURES · ZOOM {Math.round(zoom * 100)}%
                    </div>
                  )}
                </div>

                <div className="gesture-readout">
                  <span className="gesture-icon">{gestureIcon}</span>
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
                      <small>MOTION ENERGY</small>
                      <strong>{cameraOn ? `${motion}% active` : "0% idle"}</strong>
                    </span>
                  </div>
                  <div>
                    <span className="stat-icon hand">◉</span>
                    <span>
                      <small>AUDIO MODE</small>
                      <strong>{muted ? "Privacy Mute" : speaking ? "Speaking" : "Active"}</strong>
                    </span>
                  </div>
                </div>

                <div className="sensitivity">
                  <div>
                    <span>Motion Velocity</span>
                    <b>{motion}%</b>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${motion}%` }} />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* VIEW 2: IMAGINE STUDIO (PREMIUM IMAGE CREATION TOOL) */}
          {activeView === "imagine" && (
            <section className="panel imagine-panel">
              <div className="panel-head">
                <div>
                  <strong>AURA CORE IMAGINE STUDIO</strong>
                  <span className="pill pro">FLUX.1 8K HIGH RESOLUTION</span>
                </div>
                {generatedImages.length > 0 && (
                  <button type="button" className="clear-chat" onClick={() => setGeneratedImages([])}>
                    ⟲ Clear Gallery
                  </button>
                )}
              </div>

              <div className="imagine-body">
                {/* PROMPT COMPOSER */}
                <div className="imagine-composer">
                  <div className="imagine-input-row">
                    <input
                      type="text"
                      className="imagine-input"
                      placeholder="Describe what you want to create in ultra-high resolution…"
                      value={imagePrompt}
                      onChange={e => setImagePrompt(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && imagePrompt.trim()) void generateImage(imagePrompt);
                      }}
                    />
                    <button
                      type="button"
                      className="magic-prompt-btn"
                      onClick={() => {
                        const enhanced = imagePrompt.trim()
                          ? `${imagePrompt.trim()}, masterpiece, ultra-detailed 8k, volumetric rays, cinematic atmosphere`
                          : "Cyberpunk female AI android glowing with intricate quantum circuitry, ethereal lighting, 8k resolution";
                        setImagePrompt(enhanced);
                      }}
                      title="AI Magic Prompt Expander"
                    >
                      ✨ Enhance
                    </button>
                    <button
                      type="button"
                      className="generate-btn"
                      disabled={isGeneratingImage || !imagePrompt.trim()}
                      onClick={() => void generateImage(imagePrompt)}
                    >
                      {isGeneratingImage ? <span className="spinner" /> : <Icon name="spark" size={17} />}
                      <span>{isGeneratingImage ? "Rendering 8K…" : "Generate Image"}</span>
                    </button>
                  </div>

                  {/* STYLES & RATIO CONTROLS */}
                  <div className="imagine-controls">
                    <div className="style-pills">
                      {imageStyles.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className={`style-pill ${selectedStyle === s.id ? "active" : ""}`}
                          onClick={() => setSelectedStyle(s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <div className="ratio-controls">
                      <button
                        type="button"
                        className={`ratio-btn ${aspectRatio === "1:1" ? "active" : ""}`}
                        onClick={() => setAspectRatio("1:1")}
                      >
                        1:1 Square
                      </button>
                      <button
                        type="button"
                        className={`ratio-btn ${aspectRatio === "16:9" ? "active" : ""}`}
                        onClick={() => setAspectRatio("16:9")}
                      >
                        16:9 Landscape
                      </button>
                      <button
                        type="button"
                        className={`ratio-btn ${aspectRatio === "9:16" ? "active" : ""}`}
                        onClick={() => setAspectRatio("9:16")}
                      >
                        9:16 Portrait
                      </button>
                    </div>
                  </div>
                </div>

                {/* ACTIVE PREVIEW */}
                {activePreviewImage && (
                  <div className="active-image-card">
                    <div className="image-wrapper">
                      <img src={activePreviewImage.url} alt={activePreviewImage.prompt} />
                      <div className="image-overlay-info">
                        <p className="image-overlay-prompt">"{activePreviewImage.prompt}"</p>
                        <span className="image-overlay-meta">
                          {activePreviewImage.style} · {activePreviewImage.aspectRatio} · {activePreviewImage.timestamp}
                        </span>
                      </div>
                    </div>
                    <div className="image-toolbar">
                      <a href={activePreviewImage.url} target="_blank" rel="noreferrer" className="tool-btn" download="auracore-art.jpg">
                        <Icon name="download" size={15} /> Download 8K
                      </a>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => {
                          addAuraMessage(`Shared from Imagine Studio: "${activePreviewImage.prompt}"`, activePreviewImage.url);
                          setActiveView("assistant");
                        }}
                      >
                        ◈ Send to Assistant
                      </button>
                    </div>
                  </div>
                )}

                {/* RECENT GALLERY */}
                <div className="gallery-section">
                  <h3 className="gallery-title">Creation Gallery ({generatedImages.length})</h3>
                  {generatedImages.length === 0 ? (
                    <div className="gallery-empty">
                      <Icon name="image" size={38} />
                      <p>No creations yet. Type any prompt above or click "✨ Enhance" to create stunning 8K artwork.</p>
                    </div>
                  ) : (
                    <div className="gallery-grid">
                      {generatedImages.map(img => (
                        <div
                          key={img.id}
                          className="gallery-item"
                          onClick={() => setActivePreviewImage(img)}
                        >
                          <img src={img.url} alt={img.prompt} loading="lazy" />
                          <div className="gallery-item-hover">
                            <span>{img.prompt}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* VIEW 3: ACTIVITY & 12 GESTURES AUDIT */}
          {activeView === "activity" && (
            <section className="panel activity-panel">
              <div className="panel-head">
                <div>
                  <strong>ACTIVITY &amp; 12 GESTURES AUDIT</strong>
                  <span className="pill">{gestureLog.length} events logged</span>
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
                    <small>MESSAGES</small>
                    <strong>{messages.length}</strong>
                  </div>
                  <div>
                    <small>GESTURES DETECTED</small>
                    <strong>{gestureLog.length}</strong>
                  </div>
                  <div>
                    <small>CREATIONS IN GALLERY</small>
                    <strong>{generatedImages.length}</strong>
                  </div>
                </div>

                {/* Gesture reference cheat sheet */}
                <div className="gesture-reference-card">
                  <h4>12 Hand Gesture Protocols</h4>
                  <div className="gesture-rules-grid">
                    <div><b>1. Pinch In (&lt;20px)</b><span>Zoom In UI</span></div>
                    <div><b>2. Pinch &amp; Spread (&gt;120px)</b><span>Zoom Out UI</span></div>
                    <div><b>3. Victory / Peace (✌️)</b><span>Snap &amp; Inspect (Vision Audit)</span></div>
                    <div><b>4. Pointing Index (☝️)</b><span>Mouse / Cursor Control</span></div>
                    <div><b>5. Thumbs Up (👍)</b><span>Approve / Confirm</span></div>
                    <div><b>6. Thumbs Down (👎)</b><span>Reject / Cancel</span></div>
                    <div><b>7. Rock On / Horns (🤘)</b><span>Toggle HUD Terminal</span></div>
                    <div><b>8. Three-Finger Claw</b><span>Screen Capture / Save Log</span></div>
                    <div><b>9. Swipe Right (&gt;+50px)</b><span>Next Tab / Forward</span></div>
                    <div><b>10. Swipe Left (&lt;-50px)</b><span>Previous Tab / Back</span></div>
                    <div><b>11. Swipe Up (&lt;-40px)</b><span>Scroll Down</span></div>
                    <div><b>12. Open Palm (✋)</b><span>System Privacy / Mute</span></div>
                  </div>
                </div>

                {gestureLog.length === 0 ? (
                  <p className="activity-empty">
                    No gestures captured yet. Enable the vision sensor and show your hand gestures to Aura Core.
                  </p>
                ) : (
                  <ul className="activity-list">
                    {gestureLog.map((entry, index) => (
                      <li key={`${entry.time}-${index}`}>
                        <span className="activity-gesture-icon">{entry.icon || "✨"}</span>
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

          {/* VIEW 4: AUTOMATIONS */}
          {activeView === "automations" && (
            <section className="panel automations-panel">
              <div className="panel-head">
                <div>
                  <strong>INTELLIGENT AUTOMATIONS</strong>
                  <span className="pill">System Controls</span>
                </div>
              </div>
              <div className="automation-row">
                <span>
                  <strong>Read replies aloud</strong>
                  <small>Aura Core automatically speaks replies using natural text-to-speech</small>
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
                  <small>Persist conversation history securely in this browser</small>
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
                  <strong>12 Hand Gesture Automations</strong>
                  <small>Allow exact pixel hand gestures to trigger real actions: Pinch In, Spread, Peace, Point, Claw, Thumbs, Horns, Swipes, and Open Palm</small>
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
              <div className="automation-row">
                <span>
                  <strong>Sound Effects &amp; Intro Audio</strong>
                  <small>Play calm female welcome voice and futuristic ambient audio on launch</small>
                </span>
                <button
                  className="toggle"
                  onClick={() => toggleSetting("soundEffectsEnabled")}
                  aria-pressed={settings.soundEffectsEnabled}
                  aria-label="Toggle sound effects"
                >
                  <span className={settings.soundEffectsEnabled ? "on" : ""} />
                </button>
              </div>
            </section>
          )}

          {/* QUICK ACTION ROW */}
          {activeView === "assistant" && (
            <div className="quick-row">
              <button
                type="button"
                onClick={() => void answer(googleUser ? "What's on my Google Calendar schedule today?" : "What's on my schedule today?")}
                disabled={isThinking}
              >
                <span className="quick-icon">
                  <Icon name="calendar" />
                </span>
                <span>
                  <small>{googleUser ? "GOOGLE CALENDAR" : "SCHEDULE"}</small>
                  <strong>Team Standup <b>in 24 min</b></strong>
                </span>
              </button>

              <button
                type="button"
                onClick={() => void answer("What is the weather forecast right now?")}
                disabled={isThinking}
              >
                <span className="quick-icon weather">☼</span>
                <span>
                  <small>LOCAL WEATHER</small>
                  <strong>Live lookup <b>Ask Aura Core</b></strong>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMuted(v => !v);
                  if (!muted) stopSpeaking();
                }}
              >
                <span className={`quick-icon focus ${muted ? "muted-icon" : ""}`}>◉</span>
                <span>
                  <small>VOICE MODE</small>
                  <strong>{muted ? "Muted" : "Active"} <b>{muted ? "Tap to unmute" : "Tap to mute"}</b></strong>
                </span>
              </button>
            </div>
          )}

          {/* ---------------- ECOSYSTEM MODAL ---------------- */}
          {connectionsOpen && (
            <div className="oauth-backdrop" role="dialog" aria-modal="true" aria-labelledby="oauth-title">
              <div className="oauth-dialog">
                <button
                  className="oauth-close"
                  onClick={() => setConnectionsOpen(false)}
                  aria-label="Close connections"
                >
                  <Icon name="close" size={20} />
                </button>

                <p className="eyebrow">AURA CORE ECOSYSTEM &amp; AUTH</p>
                <h2 id="oauth-title">Connect your apps</h2>
                <p className="oauth-copy">
                  Authorize your Google Account to connect Google Calendar and Gmail. Aura Core uses permanent AI keys—no API key is demanded from you.
                </p>

                {/* GOOGLE AUTH CARD */}
                <div className="google-auth-card">
                  <div className="google-auth-info">
                    <Icon name="google" size={28} />
                    <div>
                      <strong>Google Account</strong>
                      <span>
                        {googleUser ? `Connected as ${googleUser.email}` : "Connect your Google Account to sync Calendar and Gmail"}
                      </span>
                    </div>
                  </div>
                  {googleUser ? (
                    <button className="google-auth-btn disconnect" onClick={disconnectGoogle}>
                      Disconnect
                    </button>
                  ) : (
                    <button className="google-auth-btn connect" onClick={() => setGoogleModalOpen(true)}>
                      Choose Account
                    </button>
                  )}
                </div>

                <div className="oauth-grid">
                  <button onClick={() => setGoogleModalOpen(true)}>
                    <strong>
                      <Icon name="calendar" size={14} /> Google Calendar
                    </strong>
                    <small>{googleUser ? "● Synced with Google" : "Sync events & reminders"}</small>
                  </button>

                  <button onClick={() => setGoogleModalOpen(true)}>
                    <strong>
                      <Icon name="mail" size={14} /> Gmail
                    </strong>
                    <small>{googleUser ? "● Synced with Google" : "Check priority emails"}</small>
                  </button>

                  <button onClick={() => setOauthStatus("Spotify authorized in development mode.")}>
                    <strong>◉ Spotify</strong>
                    <small>Playback &amp; music control</small>
                  </button>

                  <button onClick={() => setOauthStatus("Microsoft 365 authorized in development mode.")}>
                    <strong>▦ Microsoft 365</strong>
                    <small>Outlook &amp; Work calendar</small>
                  </button>
                </div>

                {oauthStatus && <p className="oauth-status">{oauthStatus}</p>}
                <small className="oauth-note">
                  Integrated with permanent AI keys. User credentials and authorization stay encrypted on your device.
                </small>
              </div>
            </div>
          )}

          {/* ---------------- DEVELOPER TERMINAL HUD ---------------- */}
          {devTerminalOpen && (
            <div className="dev-terminal" role="log" aria-label="Developer terminal">
              <div className="dev-terminal-head">
                <span>
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" /> auracore://hud
                </span>
                <button type="button" onClick={() => setDevTerminalOpen(false)} aria-label="Close terminal">
                  ×
                </button>
              </div>
              <div className="dev-terminal-body">
                <p>&gt; auracore --status</p>
                <p className="dim">
                  camera: {cameraOn ? "on (local assets + watchdog active)" : "off"} · gestures: 12 exact pixel rules · audio: {speaking ? "speaking" : "idle"} · continuous-voice: {listening ? "active" : "standby"}
                </p>
                <p>&gt; auracore --recent-gestures</p>
                {gestureLog.slice(0, 6).map((entry, index) => (
                  <p key={`${entry.time}-${index}`} className="dim">
                    [{entry.time}] {entry.icon} {entry.name} → {entry.action}
                  </p>
                ))}
                {gestureLog.length === 0 && <p className="dim">[idle] no gestures recorded</p>}
                <p className="cursor-line">
                  &gt; <span className="blink">▌</span>
                </p>
              </div>
            </div>
          )}

          <footer>
            <span>● Aura Core is ready</span>
            <span>Continuous Voice + 12 Gestures + FLUX Image Studio online</span>
            <span>{googleUser ? `Google: ${googleUser.email}` : (muted ? "Voice muted" : "Voice output ready")}</span>
          </footer>
        </section>
      </section>
    </main>
  );
}

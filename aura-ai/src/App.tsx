import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import "./App.css";

type Message = { role: "user" | "aura"; text: string; time: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: () => void;
  onresult: (event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void;
  onend: () => void;
  onerror: (event: { error: string }) => void;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type VoiceOption = { name: string; lang: string; voice: SpeechSynthesisVoice };
type Provider = "google-calendar" | "gmail" | "spotify" | "microsoft" | "whatsapp";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

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
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const wasmUrl =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function fingerIsUp(
  hand: { x: number; y: number }[],
  tip: number,
  pip: number,
) {
  return hand[tip].y < hand[pip].y - 0.035;
}
function classifyGesture(
  hand: { x: number; y: number }[],
  previous: { x: number; y: number } | null,
) {
  const index = fingerIsUp(hand, 8, 6);
  const middle = fingerIsUp(hand, 12, 10);
  const ring = fingerIsUp(hand, 16, 14);
  const pinky = fingerIsUp(hand, 20, 18);
  const pinch = distance(hand[4], hand[8]);
  const thumbUp =
    hand[4].y < hand[3].y - 0.08 && !index && !middle && !ring && !pinky;
  const thumbDown =
    hand[4].y > hand[3].y + 0.08 && !index && !middle && !ring && !pinky;
  if (pinch < 0.07) return { name: "Pinch In", action: "Zoom in UI" };
  if (pinch > 0.42) return { name: "Pinch & Spread", action: "Zoom out UI" };
  if (index && middle && !ring && !pinky)
    return { name: "Victory / Peace", action: "Snap & inspect" };
  if (index && !middle && !ring && !pinky)
    return { name: "Pointing Index", action: "Cursor control" };
  if (thumbUp) return { name: "Thumbs Up", action: "Approve / confirm" };
  if (thumbDown) return { name: "Thumbs Down", action: "Reject / cancel" };
  if (index && pinky && !middle && !ring)
    return { name: "Rock On / Horns", action: "Toggle developer terminal" };
  if (distance(hand[4], hand[8]) < 0.12 && distance(hand[8], hand[12]) < 0.12)
    return { name: "Three-Finger Claw", action: "Screen capture / save log" };
  if (index && middle && ring && pinky)
    return { name: "Open Palm", action: "Privacy / mute mode" };
  if (previous && Math.abs(hand[8].x - previous.x) > 0.12)
    return {
      name: hand[8].x > previous.x ? "Swipe Right" : "Swipe Left",
      action:
        hand[8].x > previous.x ? "Next tab / forward" : "Previous tab / back",
    };
  if (previous && previous.y - hand[8].y > 0.1)
    return { name: "Swipe Up", action: "Scroll down" };
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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "aura",
      text: "Good morning. I’m Aura, your voice-first assistant. How can I help?",
      time: getTime(),
    },
  ]);
  const voicesRef = useRef<VoiceOption[]>([]);
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

  useEffect(() => {
    const loadVoices = () => {
      const available =
        window.speechSynthesis
          ?.getVoices()
          .map((voice) => ({ name: voice.name, lang: voice.lang, voice })) ??
        [];
      setVoices(available);
      voicesRef.current = available;
      setVoiceName((current) => current || available[0]?.name || "");
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);
  const speak = (text: string) => {
    if (muted || !("speechSynthesis" in window)) return;
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
    utterance.onstart = () => setVoiceStatus(`Speaking in ${language}`);
    utterance.onend = () => setVoiceStatus("Tap the microphone and speak");
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

    [110, 164.81, 220].forEach((freq, i) => {
      const osc = context.createOscillator();
      osc.type = i === 1 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, context.currentTime + 3);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.95, context.currentTime + 6);
      
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, context.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2000, context.currentTime + 3);
      filter.Q.setValueAtTime(8, context.currentTime);
      
      osc.connect(filter);
      filter.connect(master);
      osc.start();
      osc.stop(context.currentTime + 6);
    });

    window.setTimeout(() => void context.close(), 6500);
  };
  const speakWelcome = () => {
    if (!("speechSynthesis" in window)) return;
    
    const attemptSpeak = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0) {
        window.setTimeout(attemptSpeak, 100);
        return;
      }

      window.speechSynthesis.cancel();
      const preferredFemale = availableVoices.find((option) =>
        /female|samantha|zira|ava|aria|jenny|susan|google uk english female|microsoft.*female/i.test(option.name),
      );
      const languageVoice = availableVoices.find((option) =>
        option.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()),
      );
      
      const utterance = new SpeechSynthesisUtterance("Welcome to Aura");
      utterance.voice = preferredFemale ?? languageVoice ?? availableVoices[0];
      utterance.lang = utterance.voice?.lang ?? language;
      utterance.rate = 0.55; 
      utterance.pitch = 1.05;
      utterance.volume = 1;
      
      let soundTriggered = false;
      const triggerSound = () => {
        if (soundTriggered) return;
        soundTriggered = true;
        playPostWelcomeSound();
      };

      utterance.onend = triggerSound;
      utterance.onerror = triggerSound;
      
      // Fallback in case onend doesn't fire after 8 seconds
      window.setTimeout(triggerSound, 8000);

      window.speechSynthesis.speak(utterance);
    };

    attemptSpeak();
  };
  const startWelcomeSequence = () => {
    if (welcomeStartedRef.current) return;
    welcomeStartedRef.current = true;
    playWelcomeSound();
    speakWelcome();
  };
  useEffect(() => {
    const timer = window.setTimeout(startWelcomeSequence, 350);
    return () => window.clearTimeout(timer);
  }, []);
  const addAuraMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      { role: "aura", text, time: getTime() },
    ]);
    speak(text);
  };
  const openOAuth = (provider: Provider) => {
    const redirectUri = `${window.location.origin}/oauth/callback`;
    const clients: Record<Provider, string | undefined> = {
      "google-calendar": import.meta.env.VITE_GOOGLE_CLIENT_ID,
      gmail: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      spotify: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      microsoft: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
      whatsapp: import.meta.env.VITE_WHATSAPP_APP_ID,
    };
    const clientId = clients[provider];
    if (!clientId || clientId.startsWith("replace_with_")) {
      setOauthStatus("Add this provider's public client ID to .env, restart Vite, then try again.");
      return;
    }
    const urls: Record<Provider, string> = {
      "google-calendar": `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("https://www.googleapis.com/auth/calendar.events")}&include_granted_scopes=true&state=aura-calendar`,
      gmail: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly")}&include_granted_scopes=true&state=aura-gmail`,
      spotify: `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("user-read-playback-state user-modify-playback-state")}&state=aura-spotify`,
      microsoft: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("openid profile User.Read Calendars.Read")}&response_mode=fragment&state=aura-microsoft`,
      whatsapp: `https://www.facebook.com/v23.0/dialog/oauth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("business_management whatsapp_business_management")}&state=aura-whatsapp`,
    };
    window.open(urls[provider], "aura-oauth", "popup,width=520,height=720");
    setOauthStatus("Permission window opened. Complete the provider consent screen, then return to Aura.");
  };
  const answer = async (question: string) => {
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
    if (name === "Pinch In") setZoom((value) => Math.min(1.35, value + 0.05));
    if (name === "Pinch & Spread")
      setZoom((value) => Math.max(0.8, value - 0.05));
    if (name === "Open Palm") {
      setMuted(true);
      window.speechSynthesis?.cancel();
    }
    if (name === "Thumbs Up")
      addAuraMessage("Approved. I’m ready for the next action.");
    if (name === "Thumbs Down")
      addAuraMessage("Cancelled. No action was taken.");
    if (name === "Victory / Peace")
      addAuraMessage(
        "Vision audit ready. I captured the peace gesture for inspection.",
      );
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
        </div>
        <div className="status">
          <span className="status-dot" /> SYSTEM ONLINE{" "}
          <span className="divider" /> AURA ACTIVE
        </div>
      </header>
      <section className="dashboard">
        <aside className="sidebar">
          <p className="eyebrow">WORKSPACE</p>
          <nav>
            <button className="nav-item active">
              <span>◈</span> Assistant <b>1</b>
            </button>
            <button className="nav-item">
              <span>◷</span> Activity
            </button>
            <button className="nav-item">
              <span>⌁</span> Automations
            </button>
          </nav>
          <div className="side-divider" />
          <p className="eyebrow">CONNECTED</p>
          <div className="connection">
            <span className="connection-icon">▣</span>
            <span>
              <strong>Calendar</strong>
              <small>Synced just now</small>
            </span>
            <i />
          </div>
          <div className="connection">
            <span className="connection-icon">◉</span>
            <span>
              <strong>Music</strong>
              <small>Ready to play</small>
            </span>
            <i />
          </div>
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
            <button className="icon-button" aria-label="Open notifications">
              ♢<em />
            </button>
          </div>
          <div className="feature-grid">
            <section className="chat-panel panel">
              <div className="panel-head">
                <div>
                  <span className="live-dot" /> <strong>CONVERSATION</strong>
                </div>
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
              <div className="voice-controls">
                <span className={listening ? "voice-live" : ""}>
                  ● {voiceStatus}
                </span>
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
                      <time>{message.time}</time>
                    </div>
                  </div>
                ))}
              </div>
              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => void answer(suggestion)}
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
                />
                <button
                  type="button"
                  className={`mic ${listening ? "listening" : ""}`}
                  onClick={toggleListening}
                  aria-label="Toggle voice input"
                >
                  ♩
                </button>
                <button className="send" aria-label="Send message">
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
                <button
                  className="toggle"
                  onClick={toggleCamera}
                  aria-label="Toggle camera"
                >
                  <span className={cameraOn ? "on" : ""} />
                </button>
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
          <div className="quick-row">
            <div>
              <span className="quick-icon">◷</span>
              <span>
                <small>NEXT UP</small>
                <strong>
                  Team standup <b>in 24 min</b>
                </strong>
              </span>
            </div>
            <div>
              <span className="quick-icon weather">☼</span>
              <span>
                <small>LOCAL WEATHER</small>
                <strong>
                  Live lookup <b>Ask Aura</b>
                </strong>
              </span>
            </div>
            <div>
              <span className="quick-icon focus">⌾</span>
              <span>
                <small>FOCUS MODE</small>
                <strong>
                  {muted ? "Privacy mute" : "Ready"}{" "}
                  <b>{muted ? "Open palm detected" : "Active"}</b>
                </strong>
              </span>
            </div>
          </div>
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

export default App;

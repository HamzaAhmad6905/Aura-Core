import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import firebaseConfig from "./firebase-applet-config.json";

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: "select_account",
});

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Unable to obtain Google access token. Please ensure permissions were granted.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Google Sign-In error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
};

export async function fetchCalendarEvents(token: string): Promise<CalendarEvent[]> {
  try {
    const timeMin = new Date().toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&maxResults=5&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((e: any) => ({
      id: e.id,
      summary: e.summary || "Untitled Event",
      start: e.start?.dateTime || e.start?.date || "",
      end: e.end?.dateTime || e.end?.date || "",
    }));
  } catch (err) {
    console.warn("Error fetching calendar events:", err);
    return [];
  }
}

export type GmailSnippet = {
  id: string;
  snippet: string;
};

export async function fetchGmailMessages(token: string): Promise<GmailSnippet[]> {
  try {
    const listRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=4&q=is:unread`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!listRes.ok) return [];
    const listData = await listRes.json();
    const messages = listData.messages || [];
    const snippets: GmailSnippet[] = [];

    for (const m of messages.slice(0, 3)) {
      const msgRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=minimal`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        snippets.push({
          id: m.id,
          snippet: msgData.snippet || "New message",
        });
      }
    }
    return snippets;
  } catch (err) {
    console.warn("Error fetching Gmail messages:", err);
    return [];
  }
}

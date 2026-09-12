# Aura OAuth Setup

Aura must use provider OAuth consent screens for Calendar, Music, Microsoft 365, Gmail, and WhatsApp. Do not put provider client secrets or access tokens in React code.

## Local callback

Register this callback URL with each provider:

```text
http://localhost:5173/oauth/callback
```

If Vite chooses port 5174, register that URL too or start Vite on a fixed port.

## Google Calendar and Gmail

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable Google Calendar API and Gmail API.
4. Configure the OAuth consent screen.
5. Create an OAuth Web application client.
6. Add the local callback URL above.
7. Put the client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`.

Use separate least-privilege scopes: Calendar read/write only when needed, and Gmail read/send only when explicitly enabled.

## Spotify

1. Create an app in the Spotify Developer Dashboard.
2. Add the callback URL above.
3. Put the client ID in `.env` as `VITE_SPOTIFY_CLIENT_ID`.

## Microsoft 365

1. Register an app in Microsoft Entra ID.
2. Add a single-page application redirect URI for the callback URL.
3. Add delegated permissions for Calendars.Read and User.Read.
4. Put the application ID in `.env` as `VITE_MICROSOFT_CLIENT_ID`.

## WhatsApp

WhatsApp requires a Meta Business app and a server-side webhook/token flow. It cannot be safely connected with only a browser client ID. Add `VITE_WHATSAPP_APP_ID` after creating the Meta app, then configure the server webhook and encrypted token storage before enabling messaging.

After editing `.env`, restart Vite:

```powershell
npm run dev
```

The consent popup should request permission only after the user clicks Connect. Client IDs are public identifiers; client secrets and access tokens must remain server-side.
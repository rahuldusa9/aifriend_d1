# AI Friend - Demo Backend + Minimal Frontend

This repository contains a runnable demo backend for the AI Friend project and a minimal static frontend to demo register/login, create AI friends, and chat with them.

Prereqs
- Node.js 18+
- MongoDB (local) or MongoDB Atlas (use `MONGODB_URI`)

Quick start (Windows cmd.exe)

1. Copy example env:

```cmd
copy .env.example .env
```

2. Install dependencies:

```cmd
npm install
```

3. Start server (development):

```cmd
npm run dev
```

By default the app listens on http://localhost:4000

Notes
- If `GEMINI_API_KEY` is provided, the AI service will attempt to call the configured Gemini endpoint.
- If no Gemini key is present, a local fallback reply generator will be used so the demo remains interactive.

Endpoints
- POST /api/auth/register { name, email, password }
- POST /api/auth/login { email, password }
- POST /api/ai-friends (auth) { name, personality[], backstory }
- GET /api/ai-friends (auth)
- POST /api/chats/send (auth) { friendId, message, safeMode }
- GET /api/chats/history/:friendId (auth)

Frontend demo
- A minimal demo page is available at `/public/index.html` — it uses the API endpoints to demo flows.

Next steps
- Add frontend SPA (Next.js) with real-time sockets
- Harden Gemini integration (retries, backoff) and rate-limit per user
- Add tests and CI

"# aifriend_d1"  

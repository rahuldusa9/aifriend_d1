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

Deployment (both frontend and backend on Render)
------------------------------------------------
If you want frontend and backend to live together and support Socket.IO reliably, Render is a simple option.

1) Create two Render services from this repository:
	- Backend service
	  - Root directory: `/` (repo root)
	  - Environment: `Node` (or use Docker)
	  - Start Command: `npm start`
	  - Add env vars in Render: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY` (optional), `GEMINI_MODEL` (optional)
	- Frontend service
	  - Root directory: `/frontend`
	  - Build Command: `npm install && npm run build`
	  - Start Command: `npm run start` (or serve the static build)
	  - Set environment variable `NEXT_PUBLIC_API_BASE` to `https://<your-backend-url>/api`

2) Socket.IO notes
	- The frontend uses `NEXT_PUBLIC_API_BASE` to connect to the backend (including Socket.IO). Make sure it points to the backend URL with `/api`.
	- Render supports WebSocket upgrades so Socket.IO will work.

3) Quick local test before deploying
	- Start backend locally: `npm run dev` (port 4000)
	- Start frontend locally: `cd frontend && npm run dev` (port 3000)
	- Open frontend at http://localhost:3000 and ensure chat works.

4) Alternative: Vercel frontend + Render backend
	- Deploy frontend to Vercel (Root Directory: `/frontend`) and set `NEXT_PUBLIC_API_BASE` to the Render backend URL (with `/api`).

If you want, I can create a small `render.yaml` or GitHub Action to automatically deploy both services. Tell me which provider you prefer and I will add the deployment helper files.

Next steps
- Add frontend SPA (Next.js) with real-time sockets
- Harden Gemini integration (retries, backoff) and rate-limit per user
- Add tests and CI

"# aifriend_d1"  

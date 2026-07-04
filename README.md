# Chai aur Chat ☕ — AI Personas of Hitesh Choudhary & Piyush Garg

Chat with data-grounded AI personas of two beloved coding teachers — or watch them discuss your question together in **Chai pe Charcha** mode. Built for the ChaiCode GenAI with JavaScript cohort.

**Live:** _add your Vercel URL here_

## Features
- Two personas with measurably distinct voices (Hindi-dominant vs English-dominant Hinglish), generated from 165k words of real transcript data
- **RAG over 35 real videos** — personas cite their own actual videos with timestamped links; link corruption is impossible by design (server-side token substitution)
- **Chai pe Charcha** — both personas answer together; Piyush reacts to what Hitesh actually said
- Streaming responses, per-persona chat histories, full theme morph on switch
- Server-side rate limiting (25 msgs/day/IP) + five layers of API cost protection

## Setup
```bash
npm install
cp .env.local.example .env.local   # add your GEMINI_API_KEY
node scripts/build-index.js        # one-time: builds data/rag-index.json from transcripts
npm run dev                        # http://localhost:3000
```
Transcripts are expected at `../persona-ai-phase1/data/transcripts` (see `docs/data-collection.md` for how they were collected), or set `TRANSCRIPTS_DIR`.

For production rate limiting, add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (free tier at upstash.com); without them the limiter falls back to per-instance memory.

## Architecture
```
app/page.js                 UI: 3 modes, streaming, theme morph
app/api/chat/route.js       validate → rate-limit → RAG → stream Gemini
app/api/charcha/route.js    dual-persona chained discussion
lib/personas.server.js      system prompts (server-only, dossier-generated)
lib/personas.client.js      client-safe UI config (no prompts in the bundle)
lib/rag.js                  retrieval + streaming-safe link substitution
lib/ratelimit.js            Upstash / in-memory rate limiter
scripts/build-index.js      one-time embedding index builder
```

## Documentation
- [How persona data was collected & prepared](docs/data-collection.md)
- [Prompt engineering strategy](docs/prompt-engineering.md)
- [Context management approach](docs/context-management.md)
- [Sample conversations & calibration rounds](docs/sample-conversations.md)

## Disclaimer
Educational/demo project. AI personas may be inaccurate; not affiliated with or endorsed by Hitesh Choudhary or Piyush Garg. All persona data derives from their publicly available content.

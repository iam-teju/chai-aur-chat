# Context Management Approach

## Per-request context assembly
Each request to `/api/chat` assembles context in three parts:
1. **System instruction** = persona prompt + (optional) RAG block
2. **Conversation history** — trimmed to the **last 20 messages** before hitting the model. Bounds cost and latency; in practice persona consistency is maintained by the always-present system prompt rather than distant history.
3. **Input guards** — 4000-char cap per message; malformed payloads rejected before any model call.

## RAG pipeline (transcript grounding)
- **Offline indexing** (`scripts/build-index.js`): 35 transcripts chunked to ~250 words with 30-word overlap, timestamps preserved; embedded with `gemini-embedding-001` (768 dims, RETRIEVAL_DOCUMENT task type); written to a single JSON index (no vector DB needed at this corpus size).
- **Online retrieval** (`lib/rag.js`): the latest user message is embedded (RETRIEVAL_QUERY), cosine-scored against the active persona's chunks only, top-3 above a 0.55 relevance floor injected into the system instruction, max 2 chunks per video. Index loads once per server instance and is reused across warm invocations.
- **Timestamped citations**: each chunk carries its start second, so shared links deep-link to the exact video moment (`&t=…s`).
- **Graceful degradation**: missing index or failed embedding → chat proceeds without retrieval. RAG can never break the chat.

## Streaming with server-side link substitution
Responses stream token-by-token. A streaming-safe replacer converts video tokens ([[V1]]) into verified markdown links, holding back a 12-char tail so tokens split across chunk boundaries are never emitted half-replaced.

## Charcha mode context
The duo endpoint keeps the last 8 exchanges as a rendered dialogue transcript. Hitesh answers with that transcript + his RAG context; Piyush then receives the transcript + Hitesh's complete fresh answer + his own RAG context. Sequential chaining (not parallel calls) is what makes the second speaker genuinely responsive.

## Cost & abuse controls
1. Server-side rate limit: 25 messages/day/IP (Upstash Redis sliding window in production; in-memory fallback in dev). Charcha counts one credit despite two internal model calls.
2. `maxOutputTokens`: 1024 (chat) / 512 per speaker (charcha), with `thinkingBudget: 0` — Gemini 2.5's hidden reasoning tokens otherwise consume the output budget (this caused truncated/empty replies until disabled).
3. History trimming + message caps as above.
4. `GEMINI_API_KEY` is server-only; system prompts are also server-only (`personas.server.js` never reaches the client bundle).

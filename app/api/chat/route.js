// app/api/chat/route.js
// POST { personaId, messages: [{role: 'user'|'assistant', content}] }
// Streams plain text. Rate-limit state returned via X-RateLimit-* headers.
//
// Cost protection layers:
//   1. Server-side rate limit (25/day/IP) — lib/ratelimit.js
//   2. maxOutputTokens cap per reply
//   3. History trimmed to the last MAX_HISTORY messages before hitting Gemini
//   4. API key lives only in server env — never shipped to the browser

import { GoogleGenAI } from '@google/genai';
import { PERSONAS } from '@/lib/personas.server';
import { checkRateLimit } from '@/lib/ratelimit';
import { retrieve, formatContext, makeLinkReplacer } from '@/lib/rag';

export const runtime = 'nodejs';

const MODEL = 'gemini-2.5-flash';
const MAX_HISTORY = 20; // last N messages sent to the model
const MAX_OUTPUT_TOKENS = 1024;
const MAX_MESSAGE_CHARS = 4000; // reject absurdly long user messages

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function getIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'local';
}

export async function POST(req) {
  // --- rate limit first, before any model cost ---
  const ip = getIp(req);
  const rl = await checkRateLimit(ip);
  const rlHeaders = {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
  };
  if (!rl.success) {
    return Response.json(
      { error: 'Daily message limit reached. Kal milte hain! ☕' },
      { status: 429, headers: rlHeaders }
    );
  }

  // --- validate input ---
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: rlHeaders });
  }
  const persona = PERSONAS[body?.personaId];
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!persona || !messages || messages.length === 0) {
    return Response.json({ error: 'personaId and messages required' }, { status: 400, headers: rlHeaders });
  }
  const last = messages[messages.length - 1];
  if (last.role !== 'user' || typeof last.content !== 'string' || last.content.length > MAX_MESSAGE_CHARS) {
    return Response.json({ error: 'Invalid message' }, { status: 400, headers: rlHeaders });
  }

  // --- build Gemini request ---
  const contents = messages.slice(-MAX_HISTORY).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content).slice(0, MAX_MESSAGE_CHARS) }],
  }));

  // --- RAG: pull relevant chunks from this persona's real videos ---
  let ragContext = '';
  let ragLinks = {};
  try {
    const hits = await retrieve(body.personaId, last.content);
    const ctx = formatContext(hits);
    ragContext = ctx.text;
    ragLinks = ctx.links;
  } catch {} // retrieval is best-effort, never blocks the chat

  try {
    const result = await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: {
        systemInstruction: persona.systemPrompt + ragContext,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.9, // personality needs room to breathe
        // 2.5 Flash is a thinking model; thinking tokens count against
        // maxOutputTokens and were causing truncated/empty replies.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const encoder = new TextEncoder();
    const replacer = makeLinkReplacer(ragLinks);
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result) {
            const text = chunk.text;
            if (text) {
              const out = replacer.push(text);
              if (out) controller.enqueue(encoder.encode(out));
            }
          }
          const tail = replacer.end();
          if (tail) controller.enqueue(encoder.encode(tail));
        } catch (err) {
          controller.enqueue(encoder.encode('\n\n[connection dropped — dobara try karo]'));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...rlHeaders },
    });
  } catch (err) {
    console.error('Gemini error:', err?.message);
    return Response.json(
      { error: 'Model error — thodi der baad try karo.' },
      { status: 502, headers: rlHeaders }
    );
  }
}

// app/api/charcha/route.js
// "Chai pe Charcha" — both personas discuss the user's question together.
// Hitesh answers first, then Piyush responds having READ Hitesh's answer.
// One streamed response; personas separated by the @@PIYUSH@@ marker,
// which the client uses to split into two labeled bubbles.
// Costs one rate-limit credit per exchange (two model calls internally).

import { GoogleGenAI } from '@google/genai';
import { PERSONAS } from '@/lib/personas.server';
import { checkRateLimit } from '@/lib/ratelimit';
import { retrieve, formatContext, makeLinkReplacer } from '@/lib/rag';

export const runtime = 'nodejs';

const MODEL = 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = 512; // each speaker stays punchy in charcha
const MAX_MESSAGE_CHARS = 4000;
const MARKER = '\n@@PIYUSH@@\n';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ADDRESSING = {
  hitesh: 'You address him simply as "Piyush" — he is your younger co-teacher and friend.',
  piyush: 'You address him as "Hitesh sir" — that is genuinely how you address him on your real streams (senior-junior respect, warm not stiff).',
};

const CHARCHA_RULES = (selfId, other) => `

SPECIAL MODE — "Chai pe Charcha": you and ${other} are answering this user TOGETHER, like your joint live streams. Rules:
- Keep it SHORT: 2-5 sentences. This is a discussion, not a lecture.
- Stay fully in YOUR voice; the contrast between you two is the point.
- You may playfully reference ${other} — agree, add on, or push back with light banter. You are friends and co-teachers; disagreement is warm, never hostile. ${ADDRESSING[selfId]}
- Do not greet or sign off. Jump straight into the point.`;

function transcriptOf(history) {
  return history
    .map((m) => {
      if (m.role === 'user') return `User: ${m.content}`;
      return `Hitesh: ${m.hitesh}\nPiyush: ${m.piyush}`;
    })
    .join('\n\n');
}

async function speak(personaId, extra, prompt) {
  const persona = PERSONAS[personaId];
  const result = await ai.models.generateContentStream({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: persona.systemPrompt + extra,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.9,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return result;
}

export async function POST(req) {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0].trim() : 'local';
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

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: rlHeaders });
  }
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > MAX_MESSAGE_CHARS) {
    return Response.json({ error: 'Invalid question' }, { status: 400, headers: rlHeaders });
  }

  // RAG for both personas in parallel (best-effort)
  let hCtx = { text: '', links: {} }, pCtx = { text: '', links: {} };
  try {
    const [h, p] = await Promise.all([retrieve('hitesh', question), retrieve('piyush', question)]);
    hCtx = formatContext(h);
    pCtx = formatContext(p);
  } catch {}

  const past = history.length ? `Conversation so far:\n${transcriptOf(history)}\n\n` : '';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // --- Hitesh speaks first ---
        let hiteshText = '';
        const hReplace = makeLinkReplacer(hCtx.links);
        const h = await speak(
          'hitesh',
          CHARCHA_RULES('hitesh', 'Piyush') + hCtx.text,
          `${past}User's new question: "${question}"\n\nGive your take (Piyush will respond after you).`
        );
        for await (const chunk of h) {
          const t = chunk.text;
          if (t) {
            const out = hReplace.push(t);
            if (out) {
              hiteshText += out;
              controller.enqueue(encoder.encode(out));
            }
          }
        }
        const hTail = hReplace.end();
        if (hTail) {
          hiteshText += hTail;
          controller.enqueue(encoder.encode(hTail));
        }

        controller.enqueue(encoder.encode(MARKER));

        // --- Piyush responds, having read Hitesh ---
        const pReplace = makeLinkReplacer(pCtx.links);
        const p = await speak(
          'piyush',
          CHARCHA_RULES('piyush', 'Hitesh') + pCtx.text,
          `${past}User's new question: "${question}"\n\nHitesh just said:\n"${hiteshText}"\n\nNow give YOUR take — add to it, or push back where you genuinely see it differently.`
        );
        for await (const chunk of p) {
          const t = chunk.text;
          if (t) {
            const out = pReplace.push(t);
            if (out) controller.enqueue(encoder.encode(out));
          }
        }
        const pTail = pReplace.end();
        if (pTail) controller.enqueue(encoder.encode(pTail));
      } catch (err) {
        controller.enqueue(encoder.encode('\n\n[connection dropped — dobara try karo]'));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...rlHeaders },
  });
}

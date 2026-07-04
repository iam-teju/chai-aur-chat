// lib/rag.js
// Retrieval over the pre-built transcript index (data/rag-index.json).
// Zero-infrastructure RAG: index loads once per server instance,
// query embedding via Gemini, cosine similarity in-process.
// Gracefully degrades: if the index or embedding is unavailable,
// chat continues without retrieved context.

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const EMBED_MODEL = 'gemini-embedding-001';
const DIMS = 768;
const TOP_K = 3;
const MIN_SCORE = 0.55; // below this, retrieval is noise — skip injection

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let INDEX = null;
function loadIndex() {
  if (INDEX !== null) return INDEX;
  try {
    const p = path.join(process.cwd(), 'data', 'rag-index.json');
    INDEX = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`RAG index loaded: ${INDEX.length} chunks`);
  } catch {
    INDEX = []; // index not built — RAG silently off
  }
  return INDEX;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function retrieve(personaId, query) {
  const index = loadIndex();
  if (index.length === 0 || !query) return [];

  let qv;
  try {
    const res = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: query,
      config: { outputDimensionality: DIMS, taskType: 'RETRIEVAL_QUERY' },
    });
    qv = res.embeddings?.[0]?.values;
  } catch (e) {
    console.error('RAG embed failed (continuing without):', e?.message);
    return [];
  }
  if (!qv) return [];

  const scored = [];
  for (const c of index) {
    if (c.persona !== personaId) continue;
    scored.push({ c, score: cosine(qv, c.v) });
  }
  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, TOP_K).filter((s) => s.score >= MIN_SCORE);
  // dedupe: max 2 chunks from the same video
  const seen = {};
  return top.filter(({ c }) => ((seen[c.videoId] = (seen[c.videoId] || 0) + 1), seen[c.videoId] <= 2));
}

export function formatContext(results) {
  if (!results.length) return { text: '', links: {} };
  const links = {};
  const blocks = results
    .map(({ c }, i) => {
      const token = `[[V${i + 1}]]`;
      links[token] = `[${c.title}](${c.url}&t=${c.t}s)`;
      return `[Your video ${token}: "${c.title}"]\n"...${c.text.slice(0, 700)}..."`;
    })
    .join('\n\n');
  const text = `

EXCERPTS FROM YOUR OWN REAL VIDEOS, retrieved because they may relate to the user's question:
${blocks}

Using these: they are your actual words — reuse their arguments, examples, and opinions naturally when relevant. If one of these videos genuinely covers the user's question in depth, you may mention it the way you do on stream ("maine iss pe ek video banaya hai, dekh lena:") and then write its token EXACTLY as given, e.g. [[V1]] — the token is automatically converted into the correct clickable link. NEVER type a YouTube URL yourself; tokens are the only way to share video links. If the excerpts aren't relevant, ignore them completely — do not force a mention.`;
  return { text, links };
}

// Streaming-safe token→link substitution. Holds back a small tail so a token
// split across two stream chunks is never flushed half-replaced.
export function makeLinkReplacer(links) {
  const entries = Object.entries(links || {});
  const HOLD = 12; // longer than any token "[[V9]]"
  let pending = '';
  const apply = (str) => {
    for (const [tok, md] of entries) str = str.split(tok).join(md);
    return str;
  };
  return {
    push(text) {
      pending = apply(pending + text);
      if (pending.length <= HOLD) return '';
      const cut = pending.length - HOLD;
      const out = pending.slice(0, cut);
      pending = pending.slice(cut);
      return out;
    },
    end() {
      const out = apply(pending);
      pending = '';
      return out;
    },
  };
}

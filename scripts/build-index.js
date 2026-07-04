// scripts/build-index.js
// Phase 3 — RAG index builder. Run ONCE locally (needs GEMINI_API_KEY):
//
//   node scripts/build-index.js
//
// Reads Phase 1 transcripts, chunks them (~250 words, timestamp-aware),
// embeds with Gemini, writes data/rag-index.json (shipped with the app).
//
// Transcripts location: set TRANSCRIPTS_DIR env var, or defaults to
// ../persona-ai-phase1/data/transcripts (sibling folder layout).

import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRANSCRIPTS_DIR =
  process.env.TRANSCRIPTS_DIR || path.join(ROOT, '..', 'persona-ai-phase1', 'data', 'transcripts');
const OUT_FILE = path.join(ROOT, 'data', 'rag-index.json');

const EMBED_MODEL = 'gemini-embedding-001';
const DIMS = 768; // small + plenty for this corpus
const CHUNK_WORDS = 250;
const BATCH = 16;

// read key from .env.local without extra deps
async function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const env = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8');
    const m = env.match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  throw new Error('GEMINI_API_KEY not found (env var or .env.local)');
}

function chunkTranscript(rec) {
  // Detect ms vs s offsets (our videos are all < 2h)
  const maxOff = Math.max(...rec.segments.map((s) => s.offset || 0));
  const toSec = maxOff > 20000 ? (o) => o / 1000 : (o) => o;

  const chunks = [];
  let words = [], startSec = 0;
  for (const seg of rec.segments) {
    if (words.length === 0) startSec = Math.max(0, Math.floor(toSec(seg.offset || 0)));
    words.push(...String(seg.text).split(/\s+/).filter(Boolean));
    if (words.length >= CHUNK_WORDS) {
      chunks.push({ text: words.join(' '), startSec });
      words = words.slice(-30); // small overlap for continuity
    }
  }
  if (words.length > 40) chunks.push({ text: words.join(' '), startSec });
  return chunks;
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: await loadKey() });
  const index = [];

  for (const persona of ['hitesh', 'piyush']) {
    const dir = path.join(TRANSCRIPTS_DIR, persona);
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    console.log(`\n=== ${persona}: ${files.length} videos ===`);

    for (const f of files) {
      const rec = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      const chunks = chunkTranscript(rec);

      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        const res = await ai.models.embedContent({
          model: EMBED_MODEL,
          contents: batch.map((c) => c.text),
          config: { outputDimensionality: DIMS, taskType: 'RETRIEVAL_DOCUMENT' },
        });
        const embs = res.embeddings || [];
        embs.forEach((e, j) => {
          index.push({
            persona,
            videoId: rec.videoId,
            title: rec.title,
            url: rec.url,
            t: batch[j].startSec,
            text: batch[j].text,
            // round to shrink the JSON ~40%
            v: e.values.map((x) => Number(x.toFixed(5))),
          });
        });
        await new Promise((r) => setTimeout(r, 400)); // stay under rate limits
      }
      console.log(`  ✓ ${rec.title} → ${chunks.length} chunks`);
    }
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(index));
  const mb = ((await fs.stat(OUT_FILE)).size / 1e6).toFixed(1);
  console.log(`\nDone: ${index.length} chunks → data/rag-index.json (${mb} MB)`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});

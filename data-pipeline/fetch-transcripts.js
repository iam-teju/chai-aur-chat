/**
 * Phase 1 — Persona Data Pipeline
 * Fetches YouTube transcripts for a curated list of videos per persona.
 *
 * Usage:  node scripts/fetch-transcripts.js
 * Output: data/transcripts/<persona>/<videoId>.json
 *
 * Run this LOCALLY (needs open internet access to YouTube).
 */

import { YoutubeTranscript } from 'youtube-transcript';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_FILE = path.join(__dirname, 'videos.json');
const OUT_DIR = path.join(__dirname, '..', 'data', 'transcripts');

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : url.trim(); // allow raw IDs too
}

async function fetchOne(persona, entry) {
  const videoId = extractVideoId(entry.url);
  const outPath = path.join(OUT_DIR, persona, `${videoId}.json`);

  try {
    await fs.access(outPath);
    console.log(`  ✓ cached  ${videoId}  ${entry.title}`);
    return;
  } catch { /* not cached, fetch it */ }

  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    const fullText = segments.map(s => s.text).join(' ');
    const record = {
      videoId,
      title: entry.title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      persona,
      tags: entry.tags || [],
      wordCount: fullText.split(/\s+/).length,
      fetchedAt: new Date().toISOString(),
      text: fullText,
      segments, // keep timestamps for future RAG citations
    };
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(record, null, 2));
    console.log(`  ↓ fetched ${videoId}  (${record.wordCount} words)  ${entry.title}`);
  } catch (err) {
    console.error(`  ✗ FAILED  ${videoId}  ${entry.title} — ${err.message}`);
  }

  // be polite to YouTube
  await new Promise(r => setTimeout(r, 1500));
}

async function main() {
  const videos = JSON.parse(await fs.readFile(VIDEOS_FILE, 'utf8'));
  for (const [persona, list] of Object.entries(videos)) {
    console.log(`\n=== ${persona} (${list.length} videos) ===`);
    for (const entry of list) await fetchOne(persona, entry);
  }
  console.log('\nDone. Transcripts saved to data/transcripts/');
}

main();

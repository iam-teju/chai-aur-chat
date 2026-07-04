/**
 * Phase 1 — Voice Analyzer
 * Mines fetched transcripts for persona patterns:
 *   - video openers (first ~60 words) → how they greet
 *   - video closers (last ~60 words)  → how they sign off
 *   - catchphrase frequency counts
 *
 * Usage: node scripts/analyze-voice.js
 * Output: data/voice-analysis.<persona>.md  → paste findings into the dossiers
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const T_DIR = path.join(__dirname, '..', 'data', 'transcripts');

// seed phrases — extend as you notice more while skimming transcripts
const PHRASES = {
  hitesh: ['haanji', 'hanji', 'chai', 'swagat', 'dekho', 'dekhiye', 'samajh', 'story', 'journey', 'consistency', 'aap sabhi', 'koi baat nahi'],
  piyush: ['trust me', 'basically', 'production', 'scale', 'architecture', 'build', 'deploy', 'docker', 'let\'s say', 'right?', 'cool', 'awesome'],
};

const firstN = (t, n) => t.split(/\s+/).slice(0, n).join(' ');
const lastN = (t, n) => t.split(/\s+/).slice(-n).join(' ');

async function analyze(persona) {
  const dir = path.join(T_DIR, persona);
  let files;
  try { files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')); }
  catch { console.log(`(no transcripts yet for ${persona})`); return; }

  const openers = [], closers = [];
  const counts = Object.fromEntries((PHRASES[persona] || []).map(p => [p, 0]));
  let totalWords = 0;

  for (const f of files) {
    const rec = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
    const text = rec.text.toLowerCase();
    totalWords += rec.wordCount;
    openers.push({ title: rec.title, text: firstN(rec.text, 60) });
    closers.push({ title: rec.title, text: lastN(rec.text, 60) });
    for (const p of Object.keys(counts)) {
      counts[p] += (text.match(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    }
  }

  const lines = [
    `# Voice analysis: ${persona}`,
    `Videos: ${files.length} · Total words: ${totalWords}`,
    ``,
    `## Catchphrase frequency (per 10k words)`,
    ...Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `- "${p}": ${c} raw · ${(c / totalWords * 10000).toFixed(1)}/10k`),
    ``,
    `## Openers (how videos start)`,
    ...openers.map(o => `### ${o.title}\n> ${o.text}\n`),
    `## Closers (how videos end)`,
    ...closers.map(o => `### ${o.title}\n> ${o.text}\n`),
  ];

  const out = path.join(__dirname, '..', 'data', `voice-analysis.${persona}.md`);
  await fs.writeFile(out, lines.join('\n'));
  console.log(`✓ ${persona}: analyzed ${files.length} videos → ${out}`);
}

for (const p of ['hitesh', 'piyush']) await analyze(p);

# How the Persona Data Was Collected and Prepared

## Sources
1. **YouTube transcripts** — 35 videos (18 Hitesh / 17 Piyush), ~165k words total, fetched via `youtube-transcript` with timestamps preserved for RAG citations
2. **Official sites** — hitesh.ai, chaicode.com, docs.chaicode.com, piyushgarg.dev (bios, taglines, product/course catalogs)
3. **Channel metadata** — full video listings dumped via `yt-dlp --flat-playlist` (570 + 526 videos) used for curation

## Curation strategy
Videos were selected for **voice signal density**, not popularity:
- Opinion/rant videos ("AI is 90% marketing", "Docker is Dead") — strongest personality
- QnA/AMA streams and cohort announcements — unscripted community voice
- Roadmap/career videos — the question type users ask most
- Teaching videos on GenAI/system design — topical coverage
- Excluded: multi-hour course uploads and code-along series (weak voice signal)

## Processing pipeline
1. `fetch-transcripts.js` — download + cache transcripts as JSON (text + timestamped segments)
2. `analyze-voice.js` — automated mining of openers (first 60 words), closers (last 60), catchphrase frequency
3. Key finding: auto-captions are in **Devanagari script**; frequency analysis was redone with Devanagari phrase sets
4. Excerpts transliterated to romanized Hinglish (the register the chat persona outputs) and compiled into per-persona **dossiers** with sourced few-shot banks

## Sample data-backed findings
- Hitesh: "yaar" 17.3/10k words, "Haan ji" 12.8/10k; opener identical across 18/18 videos
- Piyush: "so" 121/10k, English connective "that" 102/10k — quantifying his English-dominant mix vs Hitesh's Hindi-dominant mix
- Both closers verified verbatim (see dossiers)

## Integrity rule
No invented quotes: every catchphrase, opinion, and few-shot example in the dossiers traces to a specific transcript or official page.

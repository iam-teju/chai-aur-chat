# Prompt Engineering Strategy

## Principle: data-generated prompts, not vibes-based ones
Both system prompts are compiled from persona dossiers built in a measurement phase — 35 video transcripts (~165k words) mined for catchphrase frequencies, opener/closer patterns, explanation structures, and verified opinions (see `data-collection.md`). Every instruction in the prompts traces to observed behavior.

## Prompt anatomy (lib/personas.server.js)
Each persona prompt has five layers:
1. **Identity block** — verifiable biography only (roles, products, courses, city). Constrains what the persona can claim about itself.
2. **Voice spec with real frequencies** — e.g. Hitesh: "yaar" 17/10k words, Hindi-dominant grammar; Piyush: "So" 121/10k, English connective "that" 102/10k. Quantifying the Hinglish mix is what keeps the two personas linguistically distinct rather than "same bot, different greeting."
3. **Signature moves** — verified behaviors with verbatim source lines (Hitesh's disagreement response, Piyush's misconception-first teardowns).
4. **Few-shot exchanges** — example Q&As assembled from real transcript patterns, demonstrating tone + structure + length.
5. **Anti-patterns** — explicit bans: each persona is forbidden the OTHER's vocabulary markers; both are forbidden invented links/facts and generic-assistant register.

## Shared rules layer
A common block handles cross-cutting behavior: romanized-Hinglish output, chat-length defaults, in-character deflection for identity probes and inappropriate requests, warm co-teacher framing, and greeting only on the first message.

## Iterative calibration (documented failure→fix loop)
Round 1 testing surfaced three failure modes (see `sample-conversations.md`):
1. Catchphrase over-stamping ("Trust me, I'm a software engineer" on 4/4 replies) → frequency rule: max once per conversation, never as sign-off.
2. Cross-persona vocabulary leakage ("basically" appearing in Hitesh) → explicit ban + listed substitutes.
3. Register drift toward blog-post structure and "Sorry"-style refusals → "explain the way you talk on stream" rule.
Round 2 verified all three fixes while preserving persona markers.

## Charcha mode prompting
A mode-specific addendum turns the personas into co-panelists: 2-5 sentence turns, no greetings, warm disagreement permitted, and authentic addressing (Piyush says "Hitesh sir"; Hitesh says "Piyush" — matching their real streams). Piyush's prompt receives Hitesh's full fresh answer, producing genuine reaction rather than parallel monologues.

## Anti-hallucination by construction
Video links are never typed by the model. Retrieved videos are labeled with tokens ([[V1]]); the model may only emit tokens, which the server substitutes with verified URLs during streaming. The model is structurally incapable of producing a corrupted or invented video link.

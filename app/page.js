'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PERSONA_UI, CHARCHA_UI, DAILY_LIMIT } from '@/lib/personas.client';

const MARKER = '@@PIYUSH@@';
const MD = {
  a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
};
const TABS = [PERSONA_UI.hitesh, PERSONA_UI.piyush, CHARCHA_UI];

export default function Home() {
  const [activeId, setActiveId] = useState('hitesh');
  const [histories, setHistories] = useState({ hitesh: [], piyush: [], charcha: [] });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(DAILY_LIMIT);
  const [error, setError] = useState('');
  const chatRef = useRef(null);

  const ui = activeId === 'charcha' ? CHARCHA_UI : PERSONA_UI[activeId];
  const messages = histories[activeId];
  const isCharcha = activeId === 'charcha';

  useEffect(() => {
    for (const [k, v] of Object.entries(ui.theme)) {
      document.documentElement.style.setProperty(k, v);
    }
  }, [ui]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  function updateLast(mode, updater) {
    setHistories((h) => {
      const msgs = [...h[mode]];
      msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
      return { ...h, [mode]: msgs };
    });
  }

  async function readStream(res, onChunk) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      onChunk(acc);
    }
  }

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput('');
    setError('');
    setBusy(true);
    const mode = activeId;

    try {
      if (mode === 'charcha') {
        const history = histories.charcha;
        setHistories((h) => ({
          ...h,
          charcha: [...h.charcha, { role: 'user', content }, { role: 'duo', hitesh: '', piyush: '' }],
        }));
        const res = await fetch('/api/charcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: content, history }),
        });
        const rem = res.headers.get('X-RateLimit-Remaining');
        if (rem !== null) setRemaining(Number(rem));
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Kuch galat ho gaya — try again.');
        }
        await readStream(res, (acc) => {
          const [h, p] = acc.split(MARKER);
          updateLast('charcha', () => ({ role: 'duo', hitesh: (h || '').trim(), piyush: (p || '').trim() }));
        });
      } else {
        const userMsg = { role: 'user', content };
        const history = [...histories[mode], userMsg];
        setHistories((h) => ({ ...h, [mode]: [...history, { role: 'assistant', content: '' }] }));
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personaId: mode, messages: history }),
        });
        const rem = res.headers.get('X-RateLimit-Remaining');
        if (rem !== null) setRemaining(Number(rem));
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Kuch galat ho gaya — try again.');
        }
        let finalText = '';
        await readStream(res, (acc) => {
          finalText = acc;
          updateLast(mode, () => ({ role: 'assistant', content: acc }));
        });
        if (!finalText.trim()) throw new Error('Khaali response aaya — ek baar aur try karo.');
      }
    } catch (err) {
      setError(err.message);
      setHistories((h) => {
        const msgs = [...h[mode]];
        const lastMsg = msgs[msgs.length - 1];
        const empty =
          (lastMsg?.role === 'assistant' && lastMsg.content === '') ||
          (lastMsg?.role === 'duo' && !lastMsg.hitesh && !lastMsg.piyush);
        if (empty) msgs.pop();
        return { ...h, [mode]: msgs };
      });
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          Chai aur <span>Chat</span>
        </div>
        <div className="switcher" role="tablist" aria-label="Choose mode">
          {TABS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={activeId === p.id}
              className={activeId === p.id ? 'active' : ''}
              onClick={() => setActiveId(p.id)}
            >
              {p.id === 'charcha' ? 'Charcha ☕' : p.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </header>

      <main className="chat" ref={chatRef}>
        <div className="chat-inner">
          <div className="persona-hero">
            {isCharcha ? (
              <div className="avatar-pair">
                <img src={PERSONA_UI.hitesh.avatar} alt="Hitesh" />
                <img src={PERSONA_UI.piyush.avatar} alt="Piyush" />
              </div>
            ) : (
              <img className="hero-avatar" src={ui.avatar} alt={ui.name} />
            )}
            <h1>{ui.name}</h1>
            <div className="tagline">{ui.tagline}</div>
            {ui.links && (
              <div className="links">
                {ui.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <>
              <div className="msg">
                {!isCharcha && <img className="avatar" src={ui.avatar} alt="" />}
                <div className="bubble">{ui.greeting}</div>
              </div>
              <div className="chips">
                {ui.chips.map((c) => (
                  <button key={c} onClick={() => send(c)} disabled={busy}>
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          {messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} className="msg user">
                  <div className="bubble">{m.content}</div>
                </div>
              );
            }
            if (m.role === 'duo') {
              const streamingHere = busy && i === messages.length - 1;
              return (
                <div key={i} className="duo">
                  <div className="msg">
                    <div className="bubble">
                      <div className="speaker speaker-hitesh">
                        <img src={PERSONA_UI.hitesh.avatar} alt="" /> Hitesh
                      </div>
                      {m.hitesh ? (
                        <ReactMarkdown components={MD}>{m.hitesh}</ReactMarkdown>
                      ) : streamingHere ? (
                        <span className="typing">chai ka sip le rahe hain…</span>
                      ) : null}
                    </div>
                  </div>
                  {(m.piyush || (streamingHere && m.hitesh)) && (
                    <div className="msg">
                      <div className="bubble">
                        <div className="speaker speaker-piyush">
                          <img src={PERSONA_UI.piyush.avatar} alt="" /> Piyush
                        </div>
                        {m.piyush ? (
                          <ReactMarkdown components={MD}>{m.piyush}</ReactMarkdown>
                        ) : (
                          <span className="typing">sun raha hai…</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={i} className="msg assistant">
                <img className="avatar" src={ui.avatar} alt="" />
                <div className="bubble">
                  {m.content === '' && busy && i === messages.length - 1 ? (
                    <span className="typing">likh rahe hain…</span>
                  ) : (
                    <ReactMarkdown components={MD}>{m.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            );
          })}

          {error && <div className="typing">⚠ {error}</div>}
        </div>
      </main>

      <div className="composer">
        <div className="composer-inner">
          <textarea
            rows={1}
            placeholder={isCharcha ? 'Dono se poochho…' : `Message ${ui.name.split(' ')[0]}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy || remaining <= 0}
          />
          <button
            className="send"
            onClick={() => send()}
            disabled={busy || !input.trim() || remaining <= 0}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>

      <footer className="footer">
        <b>
          {remaining}/{DAILY_LIMIT}
        </b>{' '}
        messages left today · AI persona for educational purposes — may be inaccurate
      </footer>
    </div>
  );
}

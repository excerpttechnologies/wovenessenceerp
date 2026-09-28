'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  search, getTopic, categories, OPENERS, CONFIDENT,
} from '@/lib/chatbot/knowledge';

/* ==========================================================================
   Help bot - opened from the top bar, on every page.

   NO AI. Every answer is a hand-written entry in lib/chatbot/knowledge.js,
   picked by keyword scoring. The same question always returns the same
   answer, there is no network call, and nothing is generated at runtime.

   Mounted once in app/admin/layout.js - signed-in screens only, so it stays
   off the marketing landing page and /login. Living in the layout rather
   than on each page means the transcript stays put as you move between
   screens; a hard reload restores it from sessionStorage.

   z-[60] deliberately: the modals, the full-screen Add Barcode Settings
   overlay and the POS till are all z-50, and help you cannot reach from
   inside a dialog is not much help. `no-print` keeps it off printed
   challans and invoices - globals.css already hides everything outside
   .print-doc at print time, this is belt-and-braces.
   ========================================================================== */

const STORE = 'groo.helpbot.v1';

/* Messages are stored as ids, not whole topic objects - the knowledge base is
   the single source of truth, so an edited answer shows up in an old
   transcript rather than being frozen at the time it was sent. */
const GREETING = [
  { r: 'b', t: 'Hello. I am the GROO ERP help bot - a fixed set of answers about this app, not an AI.' },
  { r: 'b', t: 'Ask me something, or start with one of these:', chips: OPENERS },
];

function ChatIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-2.8-.4L3 21l1.6-4.6A8.2 8.2 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </svg>
  );
}

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SendIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />
    </svg>
  );
}

/* One rendered answer: paragraphs, optional steps, optional caveat. */
function Answer({ topic }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-bold text-ink">{topic.q}</div>
      {(topic.a || []).map((p, i) => (
        <p key={i} className="mb-1.5 last:mb-0">{p}</p>
      ))}
      {topic.steps?.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          {topic.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
      {topic.note && (
        <p className="mt-2 rounded border-l-[3px] border-warnyellow bg-[#fdf7e3] px-2.5 py-1.5 text-[12.5px] text-[#6b5a1e]">
          {topic.note}
        </p>
      )}
    </div>
  );
}

/* Open/closed lives here rather than in ChatBot so the trigger can sit in
   the Topbar (ChatBotButton) while the panel stays mounted once in the admin
   layout. Both must be inside ChatBotProvider. */
const ChatBotContext = createContext({ open: false, setOpen: () => {} });

export function ChatBotProvider({ children }) {
  const [open, setOpen] = useState(false);
  return <ChatBotContext.Provider value={{ open, setOpen }}>{children}</ChatBotContext.Provider>;
}

/* Top bar trigger, next to the notification bell - same size and hover. */
export function ChatBotButton() {
  const { open, setOpen } = useContext(ChatBotContext);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-label="Open AI Assistant"
      aria-expanded={open}
      title="AI Assistant"
      className={'no-print flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#1D4ED8] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 '
        + (open ? 'bg-[#EFF6FF]' : '')}
    >
      <ChatIcon size={22} />
    </button>
  );
}

export default function ChatBot() {
  const { open, setOpen } = useContext(ChatBotContext);
  const [msgs, setMsgs] = useState(GREETING);
  const [text, setText] = useState('');
  const [browsing, setBrowsing] = useState(null); // null | 'root' | category name
  const [thinking, setThinking] = useState(false);
  const [ready, setReady] = useState(false);

  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const timer = useRef(null);

  /* restore transcript on mount */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved?.msgs) && saved.msgs.length) setMsgs(saved.msgs);
        if (saved?.open) setOpen(true);
      }
    } catch { /* private mode, cleared storage - the greeting stands */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ msgs, open }));
    } catch { /* nothing to do - the transcript is a convenience, not state */ }
  }, [msgs, open, ready]);

  useEffect(() => () => clearTimeout(timer.current), []);

  /* keep the newest message in view */
  useEffect(() => {
    if (!open) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, open, browsing, thinking]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  /* Escape closes the panel, but only when it is the panel that has focus -
     otherwise this would swallow Escape from a form underneath. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const push = useCallback((...items) => setMsgs((m) => [...m, ...items]), []);

  /* A short pause before the answer. Nothing is being computed - the match is
     synchronous - but an instant reply reads as a page glitch rather than a
     response. */
  const reply = useCallback((items) => {
    setThinking(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setThinking(false);
      push(...items);
    }, 260);
  }, [push]);

  const answerTopic = useCallback((id, asked) => {
    const topic = getTopic(id);
    if (!topic) return;
    setBrowsing(null);
    push({ r: 'u', t: asked || topic.q });
    reply([{ r: 'b', topic: id, chips: topic.related || [] }]);
  }, [push, reply]);

  const ask = useCallback((raw) => {
    const q = String(raw || '').trim();
    if (!q) return;
    setBrowsing(null);
    setText('');
    push({ r: 'u', t: q });

    const hits = search(q);
    const best = hits[0];

    if (best && best.score >= CONFIDENT) {
      const others = hits.slice(1, 4).map((h) => h.topic.id);
      const related = best.topic.related || [];
      /* offer the runners-up first - they answer the question actually asked
         more often than the chosen topic's own related list */
      const chips = [...new Set([...others, ...related])].slice(0, 4);
      reply([{ r: 'b', topic: best.topic.id, chips }]);
      return;
    }

    if (hits.length) {
      reply([{
        r: 'b',
        t: 'I do not have an exact answer for that. The closest topics I hold are:',
        chips: hits.map((h) => h.topic.id).slice(0, 4),
      }]);
      return;
    }

    reply([{
      r: 'b',
      t: 'I do not have anything on that. I only cover this ERP - setup, the purchase and sell flows, stock transfers, inter company sell, and the common errors. Try Browse topics below.',
    }]);
  }, [push, reply]);

  const reset = () => {
    clearTimeout(timer.current);
    setThinking(false);
    setBrowsing(null);
    setMsgs(GREETING);
  };

  const cats = categories();

  return (
    <div className="no-print">
      {/* ---------------------------------------------------------- panel
          The launcher is ChatBotButton in the Topbar, so on sm+ the panel
          drops down from under the top bar at the right. */}
      {open && (
        <div
          role="dialog"
          aria-label="GROO ERP help"
          className="fixed bottom-0 right-0 z-[60] flex h-[560px] max-h-[85vh] w-full flex-col overflow-hidden rounded-t-xl border border-line bg-white shadow-pop sm:bottom-auto sm:right-5 sm:top-[calc(theme(spacing.topbar)+8px)] sm:max-h-[calc(100vh-theme(spacing.topbar)-24px)] sm:w-[400px] sm:rounded-xl"
        >
          {/* header */}
          <div className="flex shrink-0 items-center gap-2.5 bg-sidebar px-4 py-3 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <ChatIcon size={17} />
            </span>
            <span className="leading-tight">
              <b className="block text-[14px]">GROO ERP Help</b>
              <span className="text-[11px] text-sidebar-text">Answers from the manual, not an AI</span>
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={reset}
              title="Start over"
              className="rounded px-1.5 py-1 text-[11px] text-sidebar-text hover:bg-white/10 hover:text-white"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="rounded p-1 text-sidebar-text hover:bg-white/10 hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>

          {/* transcript */}
          <div ref={bodyRef} className="flex-1 space-y-2.5 overflow-y-auto bg-page px-3 py-3 text-[13px] leading-relaxed text-cell">
            {msgs.map((m, i) => (
              <div key={i} className={m.r === 'u' ? 'flex justify-end' : ''}>
                <div
                  className={
                    m.r === 'u'
                      ? 'max-w-[85%] rounded-lg rounded-br-sm bg-brand px-3 py-2 text-white'
                      : 'max-w-[92%] rounded-lg rounded-bl-sm border border-line bg-white px-3 py-2.5'
                  }
                >
                  {m.topic ? <Answer topic={getTopic(m.topic)} /> : <span>{m.t}</span>}

                  {m.chips?.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2">
                      {m.chips.map((id) => {
                        const t = getTopic(id);
                        if (!t) return null;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => answerTopic(id)}
                            className="rounded-full border border-linestrong bg-[#f5f8fd] px-2.5 py-1 text-left text-[12px] text-brand-link hover:border-brand hover:bg-white"
                          >
                            {t.q}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="w-fit rounded-lg rounded-bl-sm border border-line bg-white px-3 py-2.5">
                <span className="inline-flex gap-1">
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa6ba]" style={{ animationDelay: '0ms' }} />
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa6ba]" style={{ animationDelay: '120ms' }} />
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa6ba]" style={{ animationDelay: '240ms' }} />
                </span>
              </div>
            )}

            {/* browse - categories, then the questions inside one */}
            {browsing && (
              <div className="rounded-lg border border-line bg-white px-3 py-2.5">
                {browsing === 'root' ? (
                  <>
                    <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-inkmuted">
                      Browse topics
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cats.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setBrowsing(c.name)}
                          className="rounded-full border border-linestrong bg-[#f5f8fd] px-2.5 py-1 text-[12px] text-brand-link hover:border-brand hover:bg-white"
                        >
                          {c.name} <span className="text-inkmuted">({c.topics.length})</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBrowsing('root')}
                        className="text-[12px] text-brand-link hover:underline"
                      >
                        &larr; All
                      </button>
                      <span className="text-[12px] font-bold uppercase tracking-wide text-inkmuted">
                        {browsing}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(cats.find((c) => c.name === browsing)?.topics || []).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => answerTopic(t.id)}
                          className="block w-full rounded px-2 py-1.5 text-left text-[12.5px] text-brand-link hover:bg-[#f5f8fd]"
                        >
                          {t.q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="shrink-0 border-t border-line bg-white px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                className="h-9 min-w-0 flex-1 rounded-md border border-linestrong px-2.5 text-[13px] outline-none focus:border-brand"
                placeholder="Ask about this ERP..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') ask(text); }}
              />
              <button
                type="button"
                onClick={() => ask(text)}
                disabled={!text.trim()}
                aria-label="Send"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-white hover:bg-brand-hover disabled:bg-[#c3cbd9]"
              >
                <SendIcon />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setBrowsing((b) => (b ? null : 'root'))}
              className="mt-1.5 text-[11.5px] text-brand-link hover:underline"
            >
              {browsing ? 'Hide topics' : 'Browse topics'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

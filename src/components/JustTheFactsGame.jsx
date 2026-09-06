import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ALL_FACTS,
  FAST_MS,
  TIMEOUT_MS,
  ROUND_SIZE,
  DRILL_SIZE,
  WRONG_HOLD_MS,
  factKey,
  getFact,
  emptyStats,
  getRecord,
  classify,
  sampleRound,
  drillRound,
  checkTyped,
  gradeAnswer,
  summarizeRound,
  applyRound,
  countByClass,
} from "../lib/justTheFactsEngine.js";
import { createSound } from "../lib/justTheFactsSound.js";

export const STATS_KEY = "just-the-facts-stats";

// ─── STORAGE ─────────────────────────────────────────────────────────────

function loadStats() {
  const base = emptyStats();
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      ...base,
      ...parsed,
      facts: parsed && parsed.facts ? parsed.facts : {},
    };
  } catch {
    return base;
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

// ─── STYLES ──────────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;0,9..144,900;1,9..144,600&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

    :root {
      --paper: #EADFC6;
      --ink: #1A2537;
      --teal: #1F7A6D;
      --teal-dark: #155A50;
      --gold: #D9A441;
      --rust: #C14A33;
      --dusty: #8A7E68;
    }

    * { -webkit-tap-highlight-color: transparent; }

    .jtf { font-family: 'Manrope', sans-serif; color: var(--ink); }
    .font-display { font-family: 'Fraunces', serif; font-variation-settings: "SOFT" 100, "WONK" 1; }
    .font-body { font-family: 'Manrope', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }

    .grid-paper {
      background-color: var(--paper);
      background-image:
        repeating-linear-gradient(0deg, rgba(26,37,55,0.06) 0 1px, transparent 1px 24px),
        repeating-linear-gradient(90deg, rgba(26,37,55,0.06) 0 1px, transparent 1px 24px);
    }

    .card {
      background: #F3E8D2;
      border: 3px solid var(--ink);
      box-shadow: 6px 6px 0 var(--ink);
      border-radius: 18px;
    }

    .btn {
      font-family: 'Manrope', sans-serif;
      font-weight: 700;
      border: 3px solid var(--ink);
      box-shadow: 4px 4px 0 var(--ink);
      border-radius: 14px;
      transition: transform 0.08s ease, box-shadow 0.08s ease;
      cursor: pointer;
      user-select: none;
      touch-action: manipulation;
    }
    .btn:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 var(--ink); }
    .btn:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
    .btn-primary { background: var(--teal); color: var(--paper); }
    .btn-primary:hover { background: var(--teal-dark); }
    .btn-paper { background: #F3E8D2; color: var(--ink); }
    .btn-paper:hover { background: #F8F0DE; }

    .key {
      background: #F3E8D2;
      color: var(--ink);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 28px;
      min-height: 64px;
    }
    .key-submit { background: var(--teal); color: var(--paper); }
    .key-submit:hover { background: var(--teal-dark); }

    .timer-track { height: 10px; border: 2px solid var(--ink); border-radius: 999px; overflow: hidden; background: rgba(26,37,55,0.08); }
    .timer-fill {
      height: 100%;
      background: var(--teal);
      transform-origin: left center;
      animation: shrink ${FAST_MS}ms linear forwards;
    }
    .timer-fill.over { background: var(--gold); transform: scaleX(0); animation: none; }
    @keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }

    @keyframes shake {
      0%,100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }
    .shake { animation: shake 0.35s ease-in-out; }

    @keyframes tickPop {
      0% { opacity: 0; transform: scale(0.6); }
      30% { opacity: 1; transform: scale(1.1); }
      70% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1); }
    }
    .tick { animation: tickPop 700ms ease-out forwards; }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }

    @keyframes sheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .sheet { animation: sheetIn 0.28s cubic-bezier(0.16, 1, 0.3, 1); }

    @keyframes blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
    .cursor { animation: blink 1s step-end infinite; }

    .stamp {
      border: 2px solid var(--teal);
      color: var(--teal);
      transform: rotate(-4deg);
      letter-spacing: 0.15em;
    }
    .stamp.rust { border-color: var(--rust); color: var(--rust); }
    .stamp.gold { border-color: var(--gold); color: var(--gold); }

    .cell {
      border-radius: 5px;
      border: 1px solid rgba(26,37,55,0.25);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 10px;
      line-height: 1;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      aspect-ratio: 1;
      padding: 0;
      transition: transform 0.08s ease;
    }
    .cell:hover { transform: scale(1.12); z-index: 1; }
    .cell:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; z-index: 1; }
    .cell-head {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 10px;
      display: flex; align-items: center; justify-content: center;
      aspect-ratio: 1;
      color: var(--dusty);
    }

    @media (prefers-reduced-motion: reduce) {
      .shake, .sheet, .slide-up { animation: none; }
      .tick { animation-duration: 1ms; }
    }
  `}</style>
);

// ─── CLASS DISPLAY ───────────────────────────────────────────────────────

const CLASS_META = {
  unseen: { label: "Unseen", glyph: "·", bg: "rgba(138,126,104,0.30)", fg: "var(--ink)" },
  struggling: { label: "Struggling", glyph: "○", bg: "var(--rust)", fg: "var(--paper)" },
  slow: { label: "Slow", glyph: "◐", bg: "var(--gold)", fg: "var(--ink)" },
  fast: { label: "Fast", glyph: "●", bg: "var(--teal)", fg: "var(--paper)" },
};

function formatMs(ms) {
  if (ms === null || ms === undefined) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTotal(ms) {
  const totalTenths = Math.round(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = ((totalTenths % 600) / 10).toFixed(1).padStart(4, "0");
  return `${minutes}:${seconds}`;
}

// ─── HOME ────────────────────────────────────────────────────────────────

const FACTORS = Array.from({ length: 12 }, (_, i) => i + 1);

function MasteryGrid({ stats, onSelect }) {
  return (
    <div
      role="grid"
      aria-label="Multiplication facts mastery grid"
      className="grid gap-[2px] w-full"
      style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
    >
      <div className="cell-head" aria-hidden="true">×</div>
      {FACTORS.map((c) => (
        <div key={`h${c}`} className="cell-head" role="columnheader">{c}</div>
      ))}
      {FACTORS.map((r) => (
        <React.Fragment key={`r${r}`}>
          <div className="cell-head" role="rowheader">{r}</div>
          {FACTORS.map((c) => {
            const key = factKey(r, c);
            const cls = classify(getRecord(stats, key));
            const meta = CLASS_META[cls];
            return (
              <button
                key={key + c}
                type="button"
                role="gridcell"
                className="cell"
                style={{ background: meta.bg, color: meta.fg }}
                aria-label={`${r} times ${c}, ${meta.label.toLowerCase()}`}
                onClick={() => onSelect(key)}
              >
                {r * c}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--dusty)" }}>
      {["unseen", "struggling", "slow", "fast"].map((cls) => (
        <span key={cls} className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-[10px]"
            style={{ background: CLASS_META[cls].bg, color: CLASS_META[cls].fg, border: "1px solid rgba(26,37,55,0.25)" }}
          >
            {CLASS_META[cls].glyph}
          </span>
          {CLASS_META[cls].label}
        </span>
      ))}
    </div>
  );
}

function Home({ stats, onStart, onSelectFact, onToggleSound }) {
  const counts = useMemo(() => countByClass(stats), [stats]);
  return (
    <div className="slide-up flex flex-col items-center px-5 pt-16 pb-10 max-w-md mx-auto min-h-dvh">
      <h1 className="font-display font-black text-5xl leading-none text-center" style={{ color: "var(--ink)" }}>
        Just the Facts
      </h1>
      <p className="mt-2 text-sm font-medium" style={{ color: "var(--dusty)" }}>
        Multiplication, 1 through 12
      </p>

      <div className="card w-full mt-7 p-3">
        <MasteryGrid stats={stats} onSelect={onSelectFact} />
      </div>

      <div className="mt-4">
        <Legend />
      </div>

      <div className="mt-6 text-center">
        <div className="font-display font-black text-4xl leading-none" style={{ color: "var(--teal)" }}>
          {counts.fast}
          <span className="text-2xl font-semibold" style={{ color: "var(--dusty)" }}> / {ALL_FACTS.length}</span>
        </div>
        <div className="font-mono text-xs uppercase tracking-widest mt-1" style={{ color: "var(--dusty)" }}>
          facts fast
        </div>
      </div>

      <button type="button" className="btn btn-primary w-full mt-7 py-4 text-xl" onClick={onStart}>
        Start
      </button>

      <button
        type="button"
        onClick={onToggleSound}
        aria-pressed={!!stats.sound}
        className="mt-4 font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-full"
        style={{ color: "var(--ink)", background: "rgba(26,37,55,0.08)" }}
      >
        Sound {stats.sound ? "on" : "off"}
      </button>

      <p className="mt-auto pt-8 font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--dusty)" }}>
        Just the Facts · franzketechnologies.com
      </p>
    </div>
  );
}

// ─── FACT SHEET ──────────────────────────────────────────────────────────

function FactSheet({ stats, factKeyValue, onClose, onDrill }) {
  const fact = getFact(factKeyValue);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!fact) return null;
  const rec = getRecord(stats, fact.key);
  const cls = classify(rec);
  const meta = CLASS_META[cls];
  const accuracy = rec.attempts ? Math.round((rec.correct / rec.attempts) * 100) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`${fact.a} times ${fact.b} details`}>
      <button type="button" aria-label="Close" className="absolute inset-0" style={{ background: "rgba(26,37,55,0.45)" }} onClick={onClose} />
      <div className="sheet relative w-full max-w-md card rounded-b-none border-b-0 p-6 pb-8" style={{ boxShadow: "none" }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display font-black text-4xl leading-none">
              {fact.a} × {fact.b} = {fact.answer}
            </div>
            <span
              className="inline-flex items-center gap-1.5 mt-3 font-mono text-[11px] uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: meta.bg, color: meta.fg, border: "1px solid rgba(26,37,55,0.25)" }}
            >
              {meta.glyph} {meta.label}
            </span>
          </div>
          <button type="button" onClick={onClose} className="font-mono text-xs uppercase tracking-widest px-3 py-2 rounded-full" style={{ background: "rgba(26,37,55,0.08)" }}>
            Close
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-6">
          <Stat label="Tries" value={rec.attempts} />
          <Stat label="Right" value={accuracy === null ? "—" : `${accuracy}%`} />
          <Stat label="Avg" value={formatMs(rec.avgMs)} />
          <Stat label="Streak" value={rec.streak} />
        </div>

        <button type="button" className="btn btn-primary w-full mt-6 py-3.5 text-lg" onClick={() => onDrill(fact.key)}>
          Drill this
        </button>
      </div>
    </div>
  );
}

const Stat = ({ label, value, tone = "ink" }) => (
  <div className="text-center">
    <div className="font-mono text-[10px] uppercase tracking-widest opacity-60">{label}</div>
    <div className="font-display font-bold text-2xl leading-tight" style={{ color: `var(--${tone})` }}>{value}</div>
  </div>
);

// ─── ROUND ───────────────────────────────────────────────────────────────

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
// Largest product is 144, so three digits is the most a kid can need.
const MAX_DIGITS = 3;
// Ignore taps that land in the first moments of a new fact so a late tap on the
// previous fact cannot become a stray digit on this one.
export const INPUT_GUARD_MS = 150;

function Round({ facts, onFinish, onAbandon, sound }) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState("answering"); // answering | wrongHold
  const [overFast, setOverFast] = useState(false);
  const [tick, setTick] = useState(null); // { id, grade }
  const [shaking, setShaking] = useState(false);

  const phaseRef = useRef("answering");
  const typedRef = useRef("");
  const startedAt = useRef(0);
  const results = useRef([]);
  const timers = useRef({});

  const fact = facts[index];

  const clearTimers = useCallback(() => {
    for (const t of Object.values(timers.current)) clearTimeout(t);
    timers.current = {};
  }, []);

  const advance = useCallback(() => {
    clearTimers();
    if (index + 1 >= facts.length) {
      onFinish(results.current);
      return;
    }
    phaseRef.current = "answering";
    setPhase("answering");
    setIndex((i) => i + 1);
  }, [index, facts.length, onFinish, clearTimers]);

  const record = useCallback(
    (grade, elapsedMs, typedValue) => {
      results.current.push({
        key: fact.key,
        a: fact.a,
        b: fact.b,
        display: fact.display,
        answer: fact.answer,
        grade,
        elapsedMs,
        typed: typedValue,
      });
    },
    [fact]
  );

  const failFact = useCallback(
    (elapsedMs, typedValue) => {
      if (phaseRef.current !== "answering") return;
      phaseRef.current = "wrongHold";
      clearTimers();
      record("wrong", elapsedMs, typedValue);
      sound.bad();
      setPhase("wrongHold");
      setShaking(true);
      timers.current.hold = setTimeout(advance, WRONG_HOLD_MS);
    },
    [advance, clearTimers, record, sound]
  );

  // Arm timers when a new fact appears.
  useEffect(() => {
    startedAt.current = performance.now();
    typedRef.current = "";
    setTyped("");
    setOverFast(false);
    setShaking(false);
    timers.current.slow = setTimeout(() => setOverFast(true), FAST_MS);
    timers.current.timeout = setTimeout(() => failFact(TIMEOUT_MS, typedRef.current), TIMEOUT_MS);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Digits only build the number. An exact match advances on its own; anything
  // else stays on screen so the kid can backspace and fix it, or press ✓ to
  // submit it as their answer.
  const handleDigit = useCallback(
    (d) => {
      if (phaseRef.current !== "answering") return;
      const elapsed = performance.now() - startedAt.current;
      if (elapsed < INPUT_GUARD_MS) return;
      if (typedRef.current.length >= MAX_DIGITS) return;
      sound.click();
      const next = typedRef.current + d;
      typedRef.current = next;
      setTyped(next);
      if (checkTyped(fact.answer, next) !== "match") return;

      const grade = gradeAnswer(elapsed, "match");
      if (grade === "wrong") {
        failFact(elapsed, next);
        return;
      }
      record(grade, elapsed, next);
      if (grade === "fast") sound.good();
      else sound.slow();
      setTick({ id: results.current.length, grade });
      advance();
    },
    [fact, advance, failFact, record, sound]
  );

  const handleBackspace = useCallback(() => {
    if (phaseRef.current !== "answering") return;
    if (!typedRef.current) return;
    sound.click();
    typedRef.current = typedRef.current.slice(0, -1);
    setTyped(typedRef.current);
  }, [sound]);

  // ✓ submits whatever is typed. A correct answer already advanced on its own,
  // so anything submitted here is graded as a miss.
  const handleSubmit = useCallback(() => {
    if (phaseRef.current !== "answering") return;
    if (!typedRef.current) return;
    sound.click();
    failFact(performance.now() - startedAt.current, typedRef.current);
  }, [failFact, sound]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleBackspace();
      else if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDigit, handleBackspace, handleSubmit]);

  const holding = phase === "wrongHold";

  return (
    <div className="flex flex-col px-5 pt-14 pb-6 max-w-md mx-auto min-h-dvh">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onAbandon} className="font-mono text-xs uppercase tracking-widest px-3 py-2 rounded-full" style={{ background: "rgba(26,37,55,0.08)" }}>
          ← Home
        </button>
        <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--dusty)" }}>
          {index + 1} of {facts.length}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div
          className={`font-display font-black leading-none text-center ${shaking ? "shake" : ""}`}
          style={{ fontSize: "clamp(56px, 17vw, 88px)", color: "var(--ink)" }}
          aria-live="polite"
          aria-atomic="true"
        >
          {fact.display[0]} × {fact.display[1]}
          {holding && (
            <span style={{ color: "var(--rust)" }}> = {fact.answer}</span>
          )}
        </div>

        <div className="relative mt-6 h-16 flex items-center justify-center font-mono font-bold text-5xl" style={{ color: holding ? "var(--rust)" : "var(--ink)" }}>
          {typed || (
            <span className="cursor" style={{ color: "var(--dusty)" }}>_</span>
          )}
          {typed && !holding && <span className="cursor" style={{ color: "var(--dusty)" }}>_</span>}
          {tick && (
            <span
              key={tick.id}
              className="tick absolute -right-12 text-4xl"
              style={{ color: tick.grade === "fast" ? "var(--teal)" : "var(--gold)" }}
              aria-hidden="true"
            >
              ✓
            </span>
          )}
        </div>

        <div className="timer-track w-full max-w-xs mt-5" aria-hidden="true">
          <div key={index} className={`timer-fill ${overFast ? "over" : ""}`} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mt-6" role="group" aria-label="Number pad">
        {KEYS.map((k) => {
          const isBack = k === "⌫";
          const isSubmit = k === "✓";
          return (
            <button
              key={k}
              type="button"
              className={`btn key ${isSubmit ? "key-submit" : ""}`}
              aria-label={isBack ? "Backspace" : isSubmit ? "Submit" : k}
              disabled={holding}
              style={holding ? { opacity: 0.6 } : undefined}
              onClick={() => {
                if (isBack) handleBackspace();
                else if (isSubmit) handleSubmit();
                else handleDigit(k);
              }}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── END SCREEN ──────────────────────────────────────────────────────────

function getStamp(summary, total) {
  if (summary.fastCount === total) return { text: "Lightning", tone: "" };
  if (summary.wrongCount === 0) return { text: "Solid", tone: "gold" };
  return { text: "Keep going", tone: "rust" };
}

function EndScreen({ results, newlyFast, onAgain, onHome }) {
  const summary = useMemo(() => summarizeRound(results), [results]);
  const stamp = getStamp(summary, results.length);
  const review = results.filter((r) => r.grade !== "fast");

  return (
    <div className="slide-up flex flex-col px-5 pt-16 pb-10 max-w-md mx-auto min-h-dvh">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--dusty)" }}>Round time</div>
        <div className="font-display font-black text-6xl leading-none mt-1">{formatTotal(summary.totalMs)}</div>
      </div>

      <div className="flex justify-center mt-5">
        <span className={`stamp ${stamp.tone} inline-block font-display font-bold text-lg uppercase px-4 py-1.5 rounded-md`}>
          {stamp.text}
        </span>
      </div>

      <div className="card mt-7 p-5 grid grid-cols-3 gap-2">
        <Stat label="Fast" value={summary.fastCount} tone="teal" />
        <Stat label="Slow" value={summary.slowCount} tone="gold" />
        <Stat label="Missed" value={summary.wrongCount} tone="rust" />
      </div>

      {newlyFast.length > 0 && (
        <div className="mt-4 text-center font-body font-semibold px-4 py-2.5 rounded-xl" style={{ background: "var(--teal)", color: "var(--paper)" }}>
          {newlyFast.length} new {newlyFast.length === 1 ? "fact" : "facts"} fast
        </div>
      )}

      {review.length > 0 && (
        <div className="mt-6">
          <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--dusty)" }}>Work on these</div>
          <ul className="flex flex-col gap-1.5">
            {review.map((r, i) => (
              <li key={`${r.key}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "rgba(26,37,55,0.06)" }}>
                <span className="font-display font-bold text-xl">
                  {r.display[0]} × {r.display[1]} = {r.answer}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-full"
                  style={{
                    background: r.grade === "wrong" ? "var(--rust)" : "var(--gold)",
                    color: r.grade === "wrong" ? "var(--paper)" : "var(--ink)",
                  }}
                >
                  {r.grade === "wrong" ? "missed" : `slow · ${formatMs(r.elapsedMs)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-8 flex flex-col gap-3">
        <button type="button" className="btn btn-primary w-full py-4 text-xl" onClick={onAgain}>Again</button>
        <button type="button" className="btn btn-paper w-full py-3.5 text-lg" onClick={onHome}>Home</button>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────

export default function JustTheFactsGame() {
  const [stats, setStats] = useState(loadStats);
  const [screen, setScreen] = useState("home"); // home | round | end
  const [round, setRound] = useState(null); // { facts, kind: { type, key? } }
  const [endData, setEndData] = useState(null);
  const [sheetKey, setSheetKey] = useState(null);

  const soundRef = useRef(!!stats.sound);
  soundRef.current = !!stats.sound;
  const sound = useMemo(() => createSound(soundRef), []);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  const startRound = useCallback(
    (kind) => {
      sound.unlock();
      const facts =
        kind.type === "drill"
          ? drillRound(stats, kind.key, DRILL_SIZE)
          : sampleRound(stats, ROUND_SIZE);
      setSheetKey(null);
      setRound({ facts, kind });
      setScreen("round");
    },
    [stats, sound]
  );

  const finishRound = useCallback(
    (results) => {
      const { stats: next, newlyFast } = applyRound(stats, results, stats.roundNumber + 1);
      setStats(next);
      setEndData({ results, newlyFast });
      setScreen("end");
    },
    [stats]
  );

  const goHome = useCallback(() => {
    setRound(null);
    setEndData(null);
    setScreen("home");
  }, []);

  const toggleSound = useCallback(() => {
    sound.unlock();
    setStats((s) => ({ ...s, sound: !s.sound }));
  }, [sound]);

  return (
    <div className="jtf grid-paper min-h-dvh">
      <GlobalStyles />
      {screen === "home" && (
        <Home
          stats={stats}
          onStart={() => startRound({ type: "adaptive" })}
          onSelectFact={setSheetKey}
          onToggleSound={toggleSound}
        />
      )}
      {screen === "round" && round && (
        <Round key={stats.roundNumber} facts={round.facts} onFinish={finishRound} onAbandon={goHome} sound={sound} />
      )}
      {screen === "end" && endData && (
        <EndScreen
          results={endData.results}
          newlyFast={endData.newlyFast}
          onAgain={() => startRound(round.kind)}
          onHome={goHome}
        />
      )}
      {sheetKey && screen === "home" && (
        <FactSheet
          stats={stats}
          factKeyValue={sheetKey}
          onClose={() => setSheetKey(null)}
          onDrill={(key) => startRound({ type: "drill", key })}
        />
      )}
    </div>
  );
}

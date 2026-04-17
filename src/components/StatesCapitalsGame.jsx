import React, { useState, useEffect, useRef, useMemo } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────
const STATES = [
  { s: "Alabama", c: "Montgomery", r: "South" },
  { s: "Alaska", c: "Juneau", r: "West" },
  { s: "Arizona", c: "Phoenix", r: "West" },
  { s: "Arkansas", c: "Little Rock", r: "South" },
  { s: "California", c: "Sacramento", r: "West" },
  { s: "Colorado", c: "Denver", r: "West" },
  { s: "Connecticut", c: "Hartford", r: "Northeast" },
  { s: "Delaware", c: "Dover", r: "Northeast" },
  { s: "Florida", c: "Tallahassee", r: "South" },
  { s: "Georgia", c: "Atlanta", r: "South" },
  { s: "Hawaii", c: "Honolulu", r: "West" },
  { s: "Idaho", c: "Boise", r: "West" },
  { s: "Illinois", c: "Springfield", r: "Midwest" },
  { s: "Indiana", c: "Indianapolis", r: "Midwest" },
  { s: "Iowa", c: "Des Moines", r: "Midwest" },
  { s: "Kansas", c: "Topeka", r: "Midwest" },
  { s: "Kentucky", c: "Frankfort", r: "South" },
  { s: "Louisiana", c: "Baton Rouge", r: "South" },
  { s: "Maine", c: "Augusta", r: "Northeast" },
  { s: "Maryland", c: "Annapolis", r: "Northeast" },
  { s: "Massachusetts", c: "Boston", r: "Northeast" },
  { s: "Michigan", c: "Lansing", r: "Midwest" },
  { s: "Minnesota", c: "Saint Paul", r: "Midwest" },
  { s: "Mississippi", c: "Jackson", r: "South" },
  { s: "Missouri", c: "Jefferson City", r: "Midwest" },
  { s: "Montana", c: "Helena", r: "West" },
  { s: "Nebraska", c: "Lincoln", r: "Midwest" },
  { s: "Nevada", c: "Carson City", r: "West" },
  { s: "New Hampshire", c: "Concord", r: "Northeast" },
  { s: "New Jersey", c: "Trenton", r: "Northeast" },
  { s: "New Mexico", c: "Santa Fe", r: "West" },
  { s: "New York", c: "Albany", r: "Northeast" },
  { s: "North Carolina", c: "Raleigh", r: "South" },
  { s: "North Dakota", c: "Bismarck", r: "Midwest" },
  { s: "Ohio", c: "Columbus", r: "Midwest" },
  { s: "Oklahoma", c: "Oklahoma City", r: "South" },
  { s: "Oregon", c: "Salem", r: "West" },
  { s: "Pennsylvania", c: "Harrisburg", r: "Northeast" },
  { s: "Rhode Island", c: "Providence", r: "Northeast" },
  { s: "South Carolina", c: "Columbia", r: "South" },
  { s: "South Dakota", c: "Pierre", r: "Midwest" },
  { s: "Tennessee", c: "Nashville", r: "South" },
  { s: "Texas", c: "Austin", r: "South" },
  { s: "Utah", c: "Salt Lake City", r: "West" },
  { s: "Vermont", c: "Montpelier", r: "Northeast" },
  { s: "Virginia", c: "Richmond", r: "South" },
  { s: "Washington", c: "Olympia", r: "West" },
  { s: "West Virginia", c: "Charleston", r: "South" },
  { s: "Wisconsin", c: "Madison", r: "Midwest" },
  { s: "Wyoming", c: "Cheyenne", r: "West" },
];

// ─── UTILS ───────────────────────────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const normalize = (s) =>
  s.toLowerCase().trim().replace(/\./g, "").replace(/\s+/g, " ").replace(/^st /, "saint ");

// ─── FONTS & GLOBAL STYLES ───────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;0,9..144,900;1,9..144,600&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

    :root {
      --cream: #F3E8D2;
      --paper: #EADFC6;
      --ink: #1A2537;
      --deep: #0E1726;
      --rust: #C14A33;
      --rust-dark: #9A3825;
      --gold: #D9A441;
      --sage: #6B8E6F;
      --dusty: #8A7E68;
    }

    * { -webkit-tap-highlight-color: transparent; }

    .font-display { font-family: 'Fraunces', serif; font-variation-settings: "SOFT" 50, "WONK" 1; }
    .font-body { font-family: 'Manrope', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }

    @keyframes shake {
      0%,100% { transform: translateX(0); }
      25% { transform: translateX(-6px); }
      75% { transform: translateX(6px); }
    }
    .shake { animation: shake 0.35s ease-in-out; }

    @keyframes pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    .pop { animation: pop 0.3s ease-out; }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .fade-in { animation: fadeIn 0.3s ease-out; }

    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(90px) scale(0.96); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-90px) scale(0.96); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    .paper-texture {
      background-color: var(--cream);
      background-image:
        radial-gradient(at 20% 30%, rgba(193, 74, 51, 0.06) 0px, transparent 50%),
        radial-gradient(at 80% 70%, rgba(217, 164, 65, 0.08) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(26, 37, 55, 0.04) 0px, transparent 50%);
    }

    .grain::before {
      content: "";
      position: absolute; inset: 0;
      pointer-events: none;
      opacity: 0.4;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E");
      mix-blend-mode: multiply;
    }

    .stamp {
      border: 2px solid var(--rust);
      color: var(--rust);
      transform: rotate(-4deg);
      letter-spacing: 0.15em;
    }
  `}</style>
);

// ─── SHARED UI BITS ──────────────────────────────────────────────────────
const Stat = ({ label, value, tone = "ink" }) => (
  <div className="text-center">
    <div
      className="font-mono text-xs uppercase tracking-widest opacity-60"
      style={{ color: "var(--ink)" }}
    >
      {label}
    </div>
    <div
      className="font-display font-bold text-3xl"
      style={{ color: `var(--${tone})` }}
    >
      {value}
    </div>
  </div>
);

const BackBtn = ({ onClick }) => (
  <button
    onClick={onClick}
    className="font-mono text-xs uppercase tracking-widest px-3 py-2 rounded-full transition hover:opacity-70"
    style={{ color: "var(--ink)", background: "rgba(26,37,55,0.06)" }}
  >
    ← Menu
  </button>
);

// ─── HOME SCREEN ─────────────────────────────────────────────────────────
const Home = ({ onPick, stats }) => {
  const modes = [
    {
      id: "quiz",
      title: "Quick Quiz",
      desc: "Four choices. Pick the right capital.",
      icon: "◆",
      color: "var(--rust)",
    },
    {
      id: "type",
      title: "Type It",
      desc: "No hints. Spell the capital yourself.",
      icon: "✎",
      color: "var(--ink)",
    },
    {
      id: "speed",
      title: "60-Second Dash",
      desc: "How many can you nail in a minute?",
      icon: "⚡",
      color: "var(--gold)",
    },
    {
      id: "study",
      title: "Flashcards",
      desc: "Flip through all 50 at your pace.",
      icon: "❋",
      color: "var(--sage)",
    },
  ];

  return (
    <div className="slide-up">
      {/* Header */}
      <div className="text-center mb-8 relative">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-2"
          style={{ color: "var(--dusty)" }}
        >
          ★ A GEOGRAPHY GAME ★
        </div>
        <h1
          className="font-display font-black leading-[0.9] mb-3"
          style={{
            fontSize: "clamp(2.5rem, 12vw, 4.5rem)",
            color: "var(--ink)",
            fontVariationSettings: '"SOFT" 80, "WONK" 1',
          }}
        >
          Fifty<br />
          <span
            style={{
              color: "var(--rust)",
              fontStyle: "italic",
              fontVariationSettings: '"SOFT" 100, "WONK" 1',
            }}
          >
            & Capitals
          </span>
        </h1>
        <div
          className="inline-block font-mono text-[9px] uppercase px-3 py-1 stamp"
        >
          Est. for Memorizers
        </div>
      </div>

      {/* Stats strip */}
      {stats.played > 0 && (
        <div
          className="flex justify-around py-3 px-4 mb-6 rounded-2xl"
          style={{ background: "rgba(26,37,55,0.05)" }}
        >
          <Stat label="Played" value={stats.played} />
          <div style={{ width: 1, background: "rgba(26,37,55,0.1)" }} />
          <Stat label="Best Streak" value={stats.bestStreak} tone="rust" />
          <div style={{ width: 1, background: "rgba(26,37,55,0.1)" }} />
          <Stat
            label="Accuracy"
            value={`${stats.played ? Math.round((stats.correct / stats.played) * 100) : 0}%`}
            tone="sage"
          />
        </div>
      )}

      {/* Mode cards */}
      <div className="space-y-3">
        {modes.map((m, i) => (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            className="w-full text-left rounded-2xl p-5 flex items-center gap-4 transition active:scale-[0.98] hover:translate-x-1"
            style={{
              background: "var(--paper)",
              border: `2px solid var(--ink)`,
              boxShadow: `4px 4px 0 var(--ink)`,
              animation: `slideUp 0.5s ${i * 0.08}s both cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          >
            <div
              className="font-display text-3xl font-bold w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: m.color, color: "var(--cream)" }}
            >
              {m.icon}
            </div>
            <div className="flex-1">
              <div
                className="font-display font-bold text-xl leading-tight"
                style={{ color: "var(--ink)" }}
              >
                {m.title}
              </div>
              <div
                className="font-body text-sm opacity-70"
                style={{ color: "var(--ink)" }}
              >
                {m.desc}
              </div>
            </div>
            <div
              className="font-mono text-xl"
              style={{ color: "var(--ink)" }}
            >
              →
            </div>
          </button>
        ))}
      </div>

      <div
        className="text-center mt-8 font-mono text-[10px] uppercase tracking-widest opacity-40"
        style={{ color: "var(--ink)" }}
      >
        50 states · 50 capitals · 1 goal
      </div>
    </div>
  );
};

// ─── QUIZ MODE ───────────────────────────────────────────────────────────
const Quiz = ({ onExit, recordResult }) => {
  const deck = useMemo(() => shuffle(STATES), []);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);

  const current = deck[idx];
  const options = useMemo(() => {
    const distractors = shuffle(STATES.filter((x) => x.c !== current.c))
      .slice(0, 3)
      .map((x) => x.c);
    return shuffle([current.c, ...distractors]);
  }, [idx]);

  const pick = (choice) => {
    if (selected) return;
    setSelected(choice);
    const right = choice === current.c;
    if (right) {
      setCorrect((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
    recordResult(right);
    setTimeout(() => {
      if (idx + 1 >= deck.length) {
        onExit({ correct: right ? correct + 1 : correct, total: deck.length });
      } else {
        setIdx((i) => i + 1);
        setSelected(null);
      }
    }, 1100);
  };

  const getOptionStyle = (opt) => {
    if (!selected) return { background: "var(--paper)", color: "var(--ink)" };
    if (opt === current.c) return { background: "var(--sage)", color: "var(--cream)" };
    if (opt === selected) return { background: "var(--rust)", color: "var(--cream)" };
    return { background: "var(--paper)", color: "var(--ink)", opacity: 0.4 };
  };

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={() => onExit(null)} />
        <div className="flex gap-3">
          <div
            className="font-mono text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(26,37,55,0.08)", color: "var(--ink)" }}
          >
            {idx + 1}/{deck.length}
          </div>
          {streak >= 3 && (
            <div
              className="font-mono text-xs px-3 py-1.5 rounded-full font-bold pop"
              style={{ background: "var(--gold)", color: "var(--ink)" }}
            >
              🔥 {streak}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 rounded-full mb-8 overflow-hidden"
        style={{ background: "rgba(26,37,55,0.1)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${((idx + 1) / deck.length) * 100}%`,
            background: "var(--rust)",
          }}
        />
      </div>

      {/* Question */}
      <div className="text-center mb-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Capital of
        </div>
        <h2
          className="font-display font-black leading-tight"
          style={{
            fontSize: "clamp(2rem, 9vw, 3.5rem)",
            color: "var(--ink)",
            fontVariationSettings: '"SOFT" 100, "WONK" 1',
          }}
        >
          {current.s}
        </h2>
        <div
          className="inline-block font-mono text-[9px] uppercase tracking-widest mt-2 px-2 py-0.5 rounded"
          style={{ background: "rgba(26,37,55,0.06)", color: "var(--dusty)" }}
        >
          {current.r}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => pick(opt)}
            disabled={!!selected}
            className={`w-full rounded-2xl p-4 font-display font-bold text-lg transition-all active:scale-[0.98] ${
              selected && opt === selected && opt !== current.c ? "shake" : ""
            } ${selected && opt === current.c ? "pop" : ""}`}
            style={{
              border: `2px solid var(--ink)`,
              boxShadow: selected ? "none" : "3px 3px 0 var(--ink)",
              transform: selected ? "translate(3px, 3px)" : "none",
              ...getOptionStyle(opt),
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── TYPE MODE ───────────────────────────────────────────────────────────
const TypeIt = ({ onExit, recordResult }) => {
  const deck = useMemo(() => shuffle(STATES), []);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null); // 'right' | 'wrong' | null
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const inputRef = useRef(null);

  const current = deck[idx];

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx]);

  const submit = () => {
    if (feedback) return;
    if (!input.trim()) return;
    const right = normalize(input) === normalize(current.c);
    setFeedback(right ? "right" : "wrong");
    recordResult(right);
    if (right) {
      setCorrect((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      setShowAnswer(true);
    }
    setTimeout(() => next(right), right ? 900 : 1800);
  };

  const skip = () => {
    if (feedback) return;
    setFeedback("wrong");
    setShowAnswer(true);
    setStreak(0);
    recordResult(false);
    setTimeout(() => next(false), 1500);
  };

  const next = (wasRight) => {
    if (idx + 1 >= deck.length) {
      onExit({ correct: wasRight ? correct + 1 : correct, total: deck.length });
    } else {
      setIdx((i) => i + 1);
      setInput("");
      setFeedback(null);
      setShowAnswer(false);
    }
  };

  const bg =
    feedback === "right"
      ? "var(--sage)"
      : feedback === "wrong"
      ? "var(--rust)"
      : "var(--paper)";

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={() => onExit(null)} />
        <div className="flex gap-3">
          <div
            className="font-mono text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(26,37,55,0.08)", color: "var(--ink)" }}
          >
            {idx + 1}/{deck.length}
          </div>
          {streak >= 3 && (
            <div
              className="font-mono text-xs px-3 py-1.5 rounded-full font-bold pop"
              style={{ background: "var(--gold)", color: "var(--ink)" }}
            >
              🔥 {streak}
            </div>
          )}
        </div>
      </div>

      <div
        className="h-1 rounded-full mb-8 overflow-hidden"
        style={{ background: "rgba(26,37,55,0.1)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${((idx + 1) / deck.length) * 100}%`,
            background: "var(--ink)",
          }}
        />
      </div>

      <div className="text-center mb-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Capital of
        </div>
        <h2
          className="font-display font-black leading-tight"
          style={{
            fontSize: "clamp(2rem, 9vw, 3.5rem)",
            color: "var(--ink)",
            fontVariationSettings: '"SOFT" 100, "WONK" 1',
          }}
        >
          {current.s}
        </h2>
      </div>

      <div
        className={`rounded-2xl p-5 mb-4 transition-colors duration-300 ${
          feedback === "wrong" ? "shake" : ""
        } ${feedback === "right" ? "pop" : ""}`}
        style={{
          background: bg,
          border: `2px solid var(--ink)`,
          boxShadow: `4px 4px 0 var(--ink)`,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={!!feedback}
          placeholder="Type the capital..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          className="w-full bg-transparent outline-none font-display font-bold text-2xl text-center"
          style={{
            color: feedback ? "var(--cream)" : "var(--ink)",
          }}
        />
        {showAnswer && (
          <div
            className="font-mono text-xs mt-2 text-center uppercase tracking-widest"
            style={{ color: "var(--cream)", opacity: 0.9 }}
          >
            Answer: {current.c}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={skip}
          disabled={!!feedback}
          className="flex-1 rounded-2xl p-4 font-mono text-xs uppercase tracking-widest transition active:scale-[0.98]"
          style={{
            background: "transparent",
            color: "var(--ink)",
            border: `2px solid var(--ink)`,
            opacity: feedback ? 0.4 : 1,
          }}
        >
          Show Answer
        </button>
        <button
          onClick={submit}
          disabled={!!feedback || !input.trim()}
          className="flex-[2] rounded-2xl p-4 font-display font-bold text-lg transition active:scale-[0.98]"
          style={{
            background: "var(--ink)",
            color: "var(--cream)",
            boxShadow: "3px 3px 0 var(--rust)",
            opacity: !input.trim() || feedback ? 0.5 : 1,
          }}
        >
          Check →
        </button>
      </div>
    </div>
  );
};

// ─── SPEED MODE ──────────────────────────────────────────────────────────
const Speed = ({ onExit, recordResult }) => {
  const [deck, setDeck] = useState(() => shuffle(STATES));
  const [idx, setIdx] = useState(0);
  const [time, setTime] = useState(60);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (time <= 0) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setTime((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [time, done]);

  const current = deck[idx % deck.length];
  const options = useMemo(() => {
    const distractors = shuffle(STATES.filter((x) => x.c !== current.c))
      .slice(0, 3)
      .map((x) => x.c);
    return shuffle([current.c, ...distractors]);
  }, [idx, current.c]);

  const pick = (choice) => {
    if (done || flash) return;
    const right = choice === current.c;
    setFlash(right ? "right" : "wrong");
    recordResult(right);
    if (right) setScore((s) => s + 1);
    setTimeout(() => {
      setFlash(null);
      setIdx((i) => i + 1);
    }, 220);
  };

  if (done) {
    return (
      <div className="fade-in text-center py-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Time's Up
        </div>
        <div
          className="font-display font-black leading-none mb-2"
          style={{ fontSize: "clamp(5rem, 25vw, 9rem)", color: "var(--rust)" }}
        >
          {score}
        </div>
        <div
          className="font-display italic text-xl mb-8"
          style={{ color: "var(--ink)" }}
        >
          capitals in 60 seconds
        </div>
        <div
          className="inline-block px-4 py-2 stamp font-mono text-xs"
          style={{ marginBottom: "2rem" }}
        >
          {score >= 30
            ? "★ EXTRAORDINARY ★"
            : score >= 20
            ? "★ SHARP ★"
            : score >= 10
            ? "★ SOLID ★"
            : "★ KEEP GOING ★"}
        </div>
        <div className="space-y-3">
          <button
            onClick={() => {
              setDeck(shuffle(STATES));
              setIdx(0);
              setTime(60);
              setScore(0);
              setDone(false);
            }}
            className="w-full rounded-2xl p-4 font-display font-bold text-lg"
            style={{
              background: "var(--rust)",
              color: "var(--cream)",
              border: `2px solid var(--ink)`,
              boxShadow: "3px 3px 0 var(--ink)",
            }}
          >
            Run It Back
          </button>
          <button
            onClick={() => onExit(null)}
            className="w-full rounded-2xl p-4 font-mono text-xs uppercase tracking-widest"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: `2px solid var(--ink)`,
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const flashBg =
    flash === "right" ? "var(--sage)" : flash === "wrong" ? "var(--rust)" : null;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={() => onExit(null)} />
        <div className="flex gap-2 items-center">
          <div
            className="font-mono text-sm px-3 py-1.5 rounded-full font-bold"
            style={{
              background: time <= 10 ? "var(--rust)" : "var(--ink)",
              color: "var(--cream)",
            }}
          >
            {time}s
          </div>
          <div
            className="font-mono text-sm px-3 py-1.5 rounded-full font-bold"
            style={{ background: "var(--gold)", color: "var(--ink)" }}
          >
            {score}
          </div>
        </div>
      </div>

      {/* Timer bar */}
      <div
        className="h-2 rounded-full mb-8 overflow-hidden"
        style={{ background: "rgba(26,37,55,0.1)" }}
      >
        <div
          className="h-full transition-all duration-1000 linear"
          style={{
            width: `${(time / 60) * 100}%`,
            background: time <= 10 ? "var(--rust)" : "var(--ink)",
          }}
        />
      </div>

      <div
        className="text-center mb-8 transition-colors duration-200 rounded-2xl py-6 px-4"
        style={{ background: flashBg || "transparent" }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-2"
          style={{ color: flashBg ? "var(--cream)" : "var(--dusty)" }}
        >
          Capital of
        </div>
        <h2
          className="font-display font-black leading-tight"
          style={{
            fontSize: "clamp(1.75rem, 8vw, 3rem)",
            color: flashBg ? "var(--cream)" : "var(--ink)",
            fontVariationSettings: '"SOFT" 100, "WONK" 1',
          }}
        >
          {current.s}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => pick(opt)}
            className="rounded-2xl p-4 font-display font-bold text-base transition active:scale-[0.96] min-h-[80px]"
            style={{
              background: "var(--paper)",
              color: "var(--ink)",
              border: `2px solid var(--ink)`,
              boxShadow: "2px 2px 0 var(--ink)",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── FLASHCARDS / STUDY ──────────────────────────────────────────────────
const Study = ({ onExit }) => {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState(() => STATES);
  const [direction, setDirection] = useState("next");

  const card = order[idx];

  const nav = (dir) => {
    setDirection(dir > 0 ? "next" : "prev");
    setFlipped(false);
    setIdx((i) => (i + dir + order.length) % order.length);
  };

  const slideAnim =
    direction === "next"
      ? "slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1)"
      : "slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={() => onExit(null)} />
        <div className="flex gap-2">
          <button
            onClick={() => {
              setOrder(shuffle(STATES));
              setIdx(0);
              setFlipped(false);
              setDirection("next");
            }}
            className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 rounded-full"
            style={{ background: "rgba(26,37,55,0.08)", color: "var(--ink)" }}
          >
            Shuffle
          </button>
          <div
            className="font-mono text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(26,37,55,0.08)", color: "var(--ink)" }}
          >
            {idx + 1}/{order.length}
          </div>
        </div>
      </div>

      {/* Perspective wrapper — slides in/out between cards */}
      <div
        key={idx}
        className="w-full mb-6"
        style={{
          perspective: "1600px",
          aspectRatio: "4 / 5",
          animation: slideAnim,
        }}
      >
        {/* Flip container — rotates between front/back */}
        <div
          onClick={() => setFlipped((f) => !f)}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transition: "transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            cursor: "pointer",
          }}
        >
          {/* FRONT — State */}
          <div
            className="rounded-3xl flex flex-col items-center justify-center"
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              background: "var(--paper)",
              border: "2px solid var(--ink)",
              boxShadow: "8px 8px 0 var(--rust)",
              overflow: "hidden",
            }}
          >
            <div
              className="absolute top-5 left-5 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--dusty)" }}
            >
              State · {card.r}
            </div>
            <div
              className="absolute top-5 right-5 font-mono text-[10px] font-bold"
              style={{ color: "var(--dusty)" }}
            >
              №{String(idx + 1).padStart(2, "0")}
            </div>

            {/* Corner decorations */}
            <div
              className="absolute bottom-5 left-5 font-display text-2xl"
              style={{ color: "var(--rust)", opacity: 0.3 }}
            >
              ✦
            </div>
            <div
              className="absolute bottom-5 right-5 font-display text-2xl"
              style={{ color: "var(--rust)", opacity: 0.3 }}
            >
              ✦
            </div>

            <div className="text-center px-6">
              <h2
                className="font-display font-black leading-[0.9]"
                style={{
                  fontSize: "clamp(2.75rem, 13vw, 5.5rem)",
                  color: "var(--ink)",
                  fontVariationSettings: '"SOFT" 100, "WONK" 1',
                }}
              >
                {card.s}
              </h2>
            </div>

            <div
              className="absolute bottom-12 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest whitespace-nowrap"
              style={{ color: "var(--dusty)", opacity: 0.7 }}
            >
              tap to reveal capital
            </div>
          </div>

          {/* BACK — Capital */}
          <div
            className="rounded-3xl flex flex-col items-center justify-center"
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "var(--ink)",
              border: "2px solid var(--ink)",
              boxShadow: "8px 8px 0 var(--rust)",
              overflow: "hidden",
            }}
          >
            <div
              className="absolute top-5 left-5 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--gold)" }}
            >
              Capital · {card.r}
            </div>
            <div
              className="absolute top-5 right-5 font-mono text-[10px] font-bold"
              style={{ color: "var(--gold)" }}
            >
              №{String(idx + 1).padStart(2, "0")}
            </div>

            <div
              className="absolute bottom-5 left-5 font-display text-2xl"
              style={{ color: "var(--gold)", opacity: 0.4 }}
            >
              ★
            </div>
            <div
              className="absolute bottom-5 right-5 font-display text-2xl"
              style={{ color: "var(--gold)", opacity: 0.4 }}
            >
              ★
            </div>

            <div className="text-center px-6">
              <div
                className="font-mono text-xs uppercase tracking-[0.2em] mb-4"
                style={{ color: "var(--gold)", opacity: 0.9 }}
              >
                {card.s}
              </div>
              <h2
                className="font-display font-black italic leading-[0.9]"
                style={{
                  fontSize: "clamp(2.75rem, 13vw, 5.5rem)",
                  color: "var(--cream)",
                  fontVariationSettings: '"SOFT" 100, "WONK" 1',
                }}
              >
                {card.c}
              </h2>
            </div>

            <div
              className="absolute bottom-12 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest whitespace-nowrap"
              style={{ color: "var(--gold)", opacity: 0.7 }}
            >
              tap to flip back
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => nav(-1)}
          className="flex-1 rounded-2xl p-4 font-display font-bold text-lg transition active:scale-[0.96]"
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            border: "2px solid var(--ink)",
            boxShadow: "2px 2px 0 var(--ink)",
          }}
        >
          ← Prev
        </button>
        <button
          onClick={() => nav(1)}
          className="flex-1 rounded-2xl p-4 font-display font-bold text-lg transition active:scale-[0.96]"
          style={{
            background: "var(--ink)",
            color: "var(--cream)",
            border: "2px solid var(--ink)",
            boxShadow: "2px 2px 0 var(--rust)",
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
};

// ─── RESULTS ─────────────────────────────────────────────────────────────
const Results = ({ result, onPlayAgain, onHome }) => {
  const pct = Math.round((result.correct / result.total) * 100);
  const msg =
    pct === 100
      ? "A perfect run."
      : pct >= 90
      ? "Remarkable."
      : pct >= 75
      ? "Strong work."
      : pct >= 50
      ? "Coming along."
      : "Keep studying.";

  return (
    <div className="fade-in text-center py-8">
      <div
        className="font-mono text-[10px] uppercase tracking-[0.3em] mb-3"
        style={{ color: "var(--dusty)" }}
      >
        Round Complete
      </div>
      <div
        className="font-display font-black leading-none mb-1"
        style={{
          fontSize: "clamp(5rem, 25vw, 9rem)",
          color: "var(--rust)",
          fontVariationSettings: '"SOFT" 100, "WONK" 1',
        }}
      >
        {pct}%
      </div>
      <div
        className="font-display italic text-2xl mb-2"
        style={{ color: "var(--ink)" }}
      >
        {msg}
      </div>
      <div
        className="font-mono text-sm mb-8"
        style={{ color: "var(--dusty)" }}
      >
        {result.correct} of {result.total} correct
      </div>

      <div className="space-y-3">
        <button
          onClick={onPlayAgain}
          className="w-full rounded-2xl p-4 font-display font-bold text-lg"
          style={{
            background: "var(--rust)",
            color: "var(--cream)",
            border: `2px solid var(--ink)`,
            boxShadow: "3px 3px 0 var(--ink)",
          }}
        >
          Play Again
        </button>
        <button
          onClick={onHome}
          className="w-full rounded-2xl p-4 font-mono text-xs uppercase tracking-widest"
          style={{
            background: "transparent",
            color: "var(--ink)",
            border: `2px solid var(--ink)`,
          }}
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home"); // home | quiz | type | speed | study | results
  const [lastMode, setLastMode] = useState(null);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({
    played: 0,
    correct: 0,
    bestStreak: 0,
    currentStreak: 0,
  });

  const recordResult = (right) => {
    setStats((s) => {
      const newStreak = right ? s.currentStreak + 1 : 0;
      return {
        played: s.played + 1,
        correct: s.correct + (right ? 1 : 0),
        bestStreak: Math.max(s.bestStreak, newStreak),
        currentStreak: newStreak,
      };
    });
  };

  const goHome = () => setScreen("home");

  const handleExit = (mode) => (roundResult) => {
    if (roundResult) {
      setLastMode(mode);
      setResult(roundResult);
      setScreen("results");
    } else {
      goHome();
    }
  };

  return (
    <div
      className="min-h-screen paper-texture grain relative font-body"
      style={{ color: "var(--ink)" }}
    >
      <GlobalStyles />
      <div className="max-w-lg mx-auto px-5 py-8 relative">
        {screen === "home" && (
          <Home
            stats={stats}
            onPick={(id) => {
              if (id === "quiz") setScreen("quiz");
              if (id === "type") setScreen("type");
              if (id === "speed") setScreen("speed");
              if (id === "study") setScreen("study");
            }}
          />
        )}
        {screen === "quiz" && (
          <Quiz onExit={handleExit("quiz")} recordResult={recordResult} />
        )}
        {screen === "type" && (
          <TypeIt onExit={handleExit("type")} recordResult={recordResult} />
        )}
        {screen === "speed" && (
          <Speed onExit={handleExit("speed")} recordResult={recordResult} />
        )}
        {screen === "study" && <Study onExit={handleExit("study")} />}
        {screen === "results" && result && (
          <Results
            result={result}
            onPlayAgain={() => setScreen(lastMode)}
            onHome={goHome}
          />
        )}
      </div>
    </div>
  );
}

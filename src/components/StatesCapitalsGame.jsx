import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import filter from "leo-profanity";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from "firebase/firestore";

// ─── FIREBASE ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const NICKNAME_KEY = "nifty-fifty-nickname";
const NICKNAMES_KEY = "nifty-fifty-nicknames";

// ─── NEW GAME PROMO ────────────────────────────────────────────────────
const NEWEST_GAME = {
  id: "reveal",
  title: "Letter by Letter",
  desc: "Blanks fill in over time. Type the answer before all the letters are revealed!",
  icon: "❧",
  releaseDate: "2026-04-20",
  newBadgeDays: 2,
};
const NEW_GAME_SEEN_KEY = `nifty-fifty-new-game-seen-${NEWEST_GAME.id}`;

const leaderboard = {
  async submit(name, score, category) {
    await addDoc(collection(db, "speed-scores"), {
      name,
      score,
      category,
      timestamp: serverTimestamp(),
    });
  },
  async getTop(category, max = 20, afterDoc = null) {
    const constraints = [
      collection(db, "speed-scores"),
      where("category", "==", category),
      orderBy("score", "desc"),
      orderBy("timestamp", "asc"),
    ];
    if (afterDoc) constraints.push(startAfter(afterDoc));
    constraints.push(limit(max));
    const q = query(...constraints);
    const snap = await getDocs(q);
    return { entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })), lastDoc: snap.docs[snap.docs.length - 1] || null };
  },
  async getRank(score, category) {
    const q = query(
      collection(db, "speed-scores"),
      where("category", "==", category),
      where("score", ">", score)
    );
    const snap = await getDocs(q);
    return snap.size + 1;
  },
  getNickname() {
    try { return localStorage.getItem(NICKNAME_KEY) || ""; }
    catch { return ""; }
  },
  setNickname(name) {
    localStorage.setItem(NICKNAME_KEY, name);
    this.addNickname(name);
  },
  getAllNicknames() {
    try {
      const raw = localStorage.getItem(NICKNAMES_KEY);
      if (raw) return JSON.parse(raw);
      // Migrate: if old single nickname exists, seed the list
      const single = this.getNickname();
      if (single) {
        localStorage.setItem(NICKNAMES_KEY, JSON.stringify([single]));
        return [single];
      }
      return [];
    } catch { return []; }
  },
  addNickname(name) {
    try {
      const list = this.getAllNicknames().filter((n) => n !== name);
      list.unshift(name); // most recent first
      localStorage.setItem(NICKNAMES_KEY, JSON.stringify(list.slice(0, 20)));
    } catch {}
  },
};

const revealLeaderboard = {
  async submit(name, score, category) {
    await addDoc(collection(db, "reveal-scores"), {
      name,
      score,
      category,
      timestamp: serverTimestamp(),
    });
  },
  async getTop(category, max = 20, afterDoc = null) {
    const constraints = [
      collection(db, "reveal-scores"),
      where("category", "==", category),
      orderBy("score", "desc"),
      orderBy("timestamp", "asc"),
    ];
    if (afterDoc) constraints.push(startAfter(afterDoc));
    constraints.push(limit(max));
    const q = query(...constraints);
    const snap = await getDocs(q);
    return { entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })), lastDoc: snap.docs[snap.docs.length - 1] || null };
  },
  async getRank(score, category) {
    const q = query(
      collection(db, "reveal-scores"),
      where("category", "==", category),
      where("score", ">", score)
    );
    const snap = await getDocs(q);
    return snap.size + 1;
  },
};

// ─── ANALYTICS ────────────────────────────────────────────────────────────
const ga = (event, params) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", event, params);
  }
};

// ─── DATA ────────────────────────────────────────────────────────────────
const STATES = [
  { s: "Alabama", c: "Montgomery", a: "AL", r: "South" },
  { s: "Alaska", c: "Juneau", a: "AK", r: "West" },
  { s: "Arizona", c: "Phoenix", a: "AZ", r: "West" },
  { s: "Arkansas", c: "Little Rock", a: "AR", r: "South" },
  { s: "California", c: "Sacramento", a: "CA", r: "West" },
  { s: "Colorado", c: "Denver", a: "CO", r: "West" },
  { s: "Connecticut", c: "Hartford", a: "CT", r: "Northeast" },
  { s: "Delaware", c: "Dover", a: "DE", r: "Northeast" },
  { s: "Florida", c: "Tallahassee", a: "FL", r: "South" },
  { s: "Georgia", c: "Atlanta", a: "GA", r: "South" },
  { s: "Hawaii", c: "Honolulu", a: "HI", r: "West" },
  { s: "Idaho", c: "Boise", a: "ID", r: "West" },
  { s: "Illinois", c: "Springfield", a: "IL", r: "Midwest" },
  { s: "Indiana", c: "Indianapolis", a: "IN", r: "Midwest" },
  { s: "Iowa", c: "Des Moines", a: "IA", r: "Midwest" },
  { s: "Kansas", c: "Topeka", a: "KS", r: "Midwest" },
  { s: "Kentucky", c: "Frankfort", a: "KY", r: "South" },
  { s: "Louisiana", c: "Baton Rouge", a: "LA", r: "South" },
  { s: "Maine", c: "Augusta", a: "ME", r: "Northeast" },
  { s: "Maryland", c: "Annapolis", a: "MD", r: "Northeast" },
  { s: "Massachusetts", c: "Boston", a: "MA", r: "Northeast" },
  { s: "Michigan", c: "Lansing", a: "MI", r: "Midwest" },
  { s: "Minnesota", c: "Saint Paul", a: "MN", r: "Midwest" },
  { s: "Mississippi", c: "Jackson", a: "MS", r: "South" },
  { s: "Missouri", c: "Jefferson City", a: "MO", r: "Midwest" },
  { s: "Montana", c: "Helena", a: "MT", r: "West" },
  { s: "Nebraska", c: "Lincoln", a: "NE", r: "Midwest" },
  { s: "Nevada", c: "Carson City", a: "NV", r: "West" },
  { s: "New Hampshire", c: "Concord", a: "NH", r: "Northeast" },
  { s: "New Jersey", c: "Trenton", a: "NJ", r: "Northeast" },
  { s: "New Mexico", c: "Santa Fe", a: "NM", r: "West" },
  { s: "New York", c: "Albany", a: "NY", r: "Northeast" },
  { s: "North Carolina", c: "Raleigh", a: "NC", r: "South" },
  { s: "North Dakota", c: "Bismarck", a: "ND", r: "Midwest" },
  { s: "Ohio", c: "Columbus", a: "OH", r: "Midwest" },
  { s: "Oklahoma", c: "Oklahoma City", a: "OK", r: "South" },
  { s: "Oregon", c: "Salem", a: "OR", r: "West" },
  { s: "Pennsylvania", c: "Harrisburg", a: "PA", r: "Northeast" },
  { s: "Rhode Island", c: "Providence", a: "RI", r: "Northeast" },
  { s: "South Carolina", c: "Columbia", a: "SC", r: "South" },
  { s: "South Dakota", c: "Pierre", a: "SD", r: "Midwest" },
  { s: "Tennessee", c: "Nashville", a: "TN", r: "South" },
  { s: "Texas", c: "Austin", a: "TX", r: "South" },
  { s: "Utah", c: "Salt Lake City", a: "UT", r: "West" },
  { s: "Vermont", c: "Montpelier", a: "VT", r: "Northeast" },
  { s: "Virginia", c: "Richmond", a: "VA", r: "South" },
  { s: "Washington", c: "Olympia", a: "WA", r: "West" },
  { s: "West Virginia", c: "Charleston", a: "WV", r: "South" },
  { s: "Wisconsin", c: "Madison", a: "WI", r: "Midwest" },
  { s: "Wyoming", c: "Cheyenne", a: "WY", r: "West" },
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

const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};

// ─── PERSISTENT STATS ───────────────────────────────────────────────────
const STATS_KEY = "nifty-fifty-stats";

const statsStore = {
  _read() {
    try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {}; }
    catch { return {}; }
  },
  _write(data) {
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  },
  _migrate(entry) {
    // Migrate old shape { correct, wrong } to new shape with status/history
    if (entry && typeof entry.status === "undefined") {
      const acc = (entry.correct + entry.wrong) > 0
        ? entry.correct / (entry.correct + entry.wrong) : 0;
      entry.status = (entry.correct + entry.wrong) > 0 ? (acc >= 0.5 ? "know" : "dontknow") : null;
      entry.history = [];
      entry.lastSeen = null;
    }
    return entry;
  },
  record(stateName, correct, mode) {
    const data = this._read();
    if (!data[stateName]) data[stateName] = { correct: 0, wrong: 0, status: null, history: [], lastSeen: null };
    this._migrate(data[stateName]);
    const s = data[stateName];
    if (correct) s.correct++;
    else s.wrong++;
    s.status = correct ? "know" : "dontknow";
    s.lastSeen = Date.now();
    s.history.unshift({ r: correct, m: mode || "?", t: Date.now() });
    if (s.history.length > 10) s.history.length = 10;
    this._write(data);
  },
  getAccuracy(stateName) {
    const data = this._read();
    const s = data[stateName];
    if (!s || (s.correct + s.wrong === 0)) return null;
    return s.correct / (s.correct + s.wrong);
  },
  getConfidence(stateName) {
    const data = this._read();
    const s = data[stateName];
    if (!s) return null;
    this._migrate(s);
    if (s.history && s.history.length > 0) {
      return s.history.filter((h) => h.r).length / s.history.length;
    }
    if (s.correct + s.wrong === 0) return null;
    return s.correct / (s.correct + s.wrong);
  },
  getStatus(stateName) {
    const data = this._read();
    const s = data[stateName];
    if (!s) return null;
    this._migrate(s);
    return s.status || null;
  },
  getHistory(stateName) {
    const data = this._read();
    const s = data[stateName];
    if (!s) return [];
    this._migrate(s);
    return s.history || [];
  },
  getAllStats() {
    const data = this._read();
    Object.values(data).forEach((s) => this._migrate(s));
    return data;
  },
  getWeakest(count) {
    const data = this._read();
    const entries = Object.entries(data)
      .filter(([, s]) => s.correct + s.wrong > 0)
      .map(([name, s]) => ({ name, accuracy: s.correct / (s.correct + s.wrong) }))
      .sort((a, b) => a.accuracy - b.accuracy);
    return entries.slice(0, count).map((e) => e.name);
  },
  hasEnoughHistory(min = 5) {
    const data = this._read();
    return Object.values(data).filter((s) => s.correct + s.wrong > 0).length >= min;
  },
};

const getQA = (state, category, direction) => {
  const answerField = category === "abbreviations" ? "a" : "c";
  const answerLabel = category === "abbreviations" ? "Abbreviation" : "Capital";
  if (direction === "forward") {
    return { question: state.s, answer: state[answerField], qLabel: "State", aLabel: answerLabel };
  }
  return { question: state[answerField], answer: state.s, qLabel: answerLabel, aLabel: "State" };
};

const getDistractors = (current, category, direction) => {
  const field = direction === "forward"
    ? (category === "abbreviations" ? "a" : "c")
    : "s";
  return shuffle(STATES.filter((x) => x !== current))
    .slice(0, 3)
    .map((x) => x[field]);
};

// ─── MATCHING GAME HELPERS ──────────────────────────────────────────────
const REGION_NAMES = ["South", "West", "Midwest", "Northeast"];

const buildMatchDeck = (cardCount, source, region, category) => {
  const pairCount = cardCount / 2;
  let pool;

  if (source === "region") {
    pool = STATES.filter((s) => s.r === region);
    if (pool.length < pairCount) {
      const extras = shuffle(STATES.filter((s) => s.r !== region));
      pool = [...pool, ...extras.slice(0, pairCount - pool.length)];
    }
  } else if (source === "weak") {
    const weakNames = statsStore.getWeakest(pairCount);
    pool = weakNames.map((name) => STATES.find((s) => s.s === name)).filter(Boolean);
    if (pool.length < pairCount) {
      const usedNames = new Set(pool.map((s) => s.s));
      const extras = shuffle(STATES.filter((s) => !usedNames.has(s.s)));
      pool = [...pool, ...extras.slice(0, pairCount - pool.length)];
    }
  } else {
    pool = [...STATES];
  }

  const selected = shuffle(pool).slice(0, pairCount);
  const answerField = category === "abbreviations" ? "a" : "c";
  const answerLabel = category === "abbreviations" ? "Abbreviation" : "Capital";

  const cards = [];
  selected.forEach((state, i) => {
    cards.push({ id: i * 2, pairId: i, type: "state", text: state.s, label: "State" });
    cards.push({ id: i * 2 + 1, pairId: i, type: "answer", text: state[answerField], label: answerLabel });
  });

  return shuffle(cards);
};

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

    @keyframes countdownPop {
      0% { opacity: 0; transform: scale(0.3); }
      50% { opacity: 1; transform: scale(1.15); }
      100% { opacity: 1; transform: scale(1); }
    }

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
const Home = ({ onPick, stats, category, setCategory, direction, setDirection }) => {
  const [topScore, setTopScore] = useState(null);
  const [showNewGamePopup, setShowNewGamePopup] = useState(() => {
    try { return !localStorage.getItem(NEW_GAME_SEEN_KEY); }
    catch { return false; }
  });

  const dismissPopup = () => {
    setShowNewGamePopup(false);
    try { localStorage.setItem(NEW_GAME_SEEN_KEY, "1"); } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    leaderboard.getTop(category, 1).then(({ entries }) => {
      if (!cancelled && entries.length > 0) setTopScore(entries[0]);
      else if (!cancelled) setTopScore(null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [category]);

  const catLabel = category === "abbreviations" ? "Abbreviation" : "Capital";
  const modes = [
    {
      id: "quiz",
      title: "Quick Quiz",
      desc: `Four choices. Pick the right ${catLabel.toLowerCase()}.`,
      icon: "◆",
      color: "var(--rust)",
    },
    {
      id: "type",
      title: "Type It",
      desc: `No hints. Spell the ${catLabel.toLowerCase()} yourself.`,
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
    {
      id: "match",
      title: "Match",
      desc: "Classic memory game. Flip and find pairs.",
      icon: "⬡",
      color: "var(--gold)",
    },
    {
      id: "escape",
      title: "Escape",
      desc: "Crack the 4-digit code to break free.",
      icon: "⚿",
      color: "var(--deep)",
    },
    {
      id: "reveal",
      title: "Letter by Letter",
      desc: "Blanks fill in over time. Answer before they do!",
      icon: "❧",
      color: "var(--sage)",
    },
  ];

  const forwardLabel = category === "abbreviations" ? "State → Abbr" : "State → Capital";
  const reverseLabel = category === "abbreviations" ? "Abbr → State" : "Capital → State";

  return (
    <div className="slide-up">
      {/* New game popup */}
      {showNewGamePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(26,37,55,0.5)", backdropFilter: "blur(4px)" }}
          onClick={dismissPopup}
        >
          <div
            className="rounded-2xl p-6 max-w-sm w-full text-center fade-in"
            style={{
              background: "var(--cream)",
              border: "3px solid var(--ink)",
              boxShadow: "6px 6px 0 var(--ink)",
              transform: "rotate(-1deg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="font-display text-4xl mb-3"
            >
              {NEWEST_GAME.icon}
            </div>
            <div
              className="inline-block px-3 py-1 mb-3 font-mono text-[9px] uppercase tracking-[0.3em] stamp"
            >
              New Game
            </div>
            <h3
              className="font-display font-black text-2xl mb-2"
              style={{ color: "var(--ink)", fontVariationSettings: '"SOFT" 100, "WONK" 1' }}
            >
              {NEWEST_GAME.title}
            </h3>
            <p
              className="font-body text-sm mb-6"
              style={{ color: "var(--dusty)" }}
            >
              {NEWEST_GAME.desc}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { dismissPopup(); onPick(NEWEST_GAME.id); }}
                className="w-full rounded-2xl p-3 font-display font-bold text-lg transition active:scale-[0.98]"
                style={{
                  background: "var(--sage)",
                  color: "var(--cream)",
                  border: "2px solid var(--ink)",
                  boxShadow: "3px 3px 0 var(--ink)",
                }}
              >
                Try It
              </button>
              <button
                onClick={dismissPopup}
                className="w-full rounded-2xl p-2.5 font-mono text-xs uppercase tracking-widest"
                style={{
                  background: "transparent",
                  color: "var(--ink)",
                  border: "2px solid rgba(26,37,55,0.15)",
                }}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
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
          Nifty<br />
          <span
            style={{
              color: "var(--rust)",
              fontStyle: "italic",
              fontVariationSettings: '"SOFT" 100, "WONK" 1',
            }}
          >
            Fifty
          </span>
        </h1>
        <div
          className="inline-block font-mono text-[9px] uppercase px-3 py-1 stamp"
        >
          Est. for Memorizers
        </div>
      </div>

      {/* Category tabs */}
      <div
        className="flex rounded-full mb-3 overflow-hidden"
        style={{ border: "2px solid var(--ink)" }}
      >
        {[
          { id: "capitals", label: "Capitals" },
          { id: "abbreviations", label: "Abbreviations" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className="flex-1 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors"
            style={{
              background: category === tab.id ? "var(--ink)" : "transparent",
              color: category === tab.id ? "var(--cream)" : "var(--ink)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Direction toggle */}
      <div
        className="flex rounded-full mb-6 overflow-hidden"
        style={{ border: "2px solid rgba(26,37,55,0.2)" }}
      >
        {[
          { id: "forward", label: forwardLabel },
          { id: "reverse", label: reverseLabel },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setDirection(opt.id)}
            className="flex-1 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors"
            style={{
              background: direction === opt.id ? "var(--rust)" : "transparent",
              color: direction === opt.id ? "var(--cream)" : "var(--ink)",
            }}
          >
            {opt.label}
          </button>
        ))}
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
        {modes.map((m, i) => {
          const isNewGame = m.id === NEWEST_GAME.id &&
            (Date.now() - new Date(NEWEST_GAME.releaseDate).getTime()) < NEWEST_GAME.newBadgeDays * 86400000;
          return (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            className="w-full text-left rounded-2xl p-5 flex items-center gap-4 transition active:scale-[0.98] hover:translate-x-1 relative"
            style={{
              background: "var(--paper)",
              border: `2px solid var(--ink)`,
              boxShadow: `4px 4px 0 var(--ink)`,
              animation: `slideUp 0.5s ${i * 0.08}s both cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          >
            {isNewGame && (
              <div
                className="absolute font-mono text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
                style={{
                  top: "-8px",
                  right: "12px",
                  background: "var(--rust)",
                  color: "var(--cream)",
                  border: "2px solid var(--ink)",
                  transform: "rotate(3deg)",
                }}
              >
                New
              </div>
            )}
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
              {m.id === "speed" && topScore && (
                <div
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] mt-2 px-2.5 py-1 rounded-lg font-bold"
                  style={{
                    background: "rgba(26,37,55,0.07)",
                    border: "1.5px solid rgba(26,37,55,0.12)",
                    color: "var(--ink)",
                  }}
                >
                  <span>{topScore.name}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: "var(--rust)", fontWeight: 800 }}>{topScore.score}</span>
                </div>
              )}
            </div>
            <div
              className="font-mono text-xl"
              style={{ color: "var(--ink)" }}
            >
              →
            </div>
          </button>
          );
        })}
      </div>

      {/* Leaderboard & Progress links */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => onPick("leaderboard")}
          className="flex-1 py-3 rounded-2xl font-mono text-xs uppercase tracking-widest transition hover:opacity-80 flex items-center justify-center gap-2"
          style={{
            background: "rgba(26,37,55,0.05)",
            color: "var(--ink)",
            border: "2px solid rgba(26,37,55,0.12)",
          }}
        >
          <span className="font-display text-sm" style={{ opacity: 0.6 }}>★</span> Leaderboard
        </button>
        <button
          onClick={() => onPick("progress")}
          className="flex-1 py-3 rounded-2xl font-mono text-xs uppercase tracking-widest transition hover:opacity-80 flex items-center justify-center gap-2"
          style={{
            background: "rgba(26,37,55,0.05)",
            color: "var(--ink)",
            border: "2px solid rgba(26,37,55,0.12)",
          }}
        >
          <span className="font-display text-sm" style={{ opacity: 0.6 }}>◎</span> My Progress
        </button>
      </div>

      <div
        className="text-center mt-4 font-mono text-[10px] uppercase tracking-widest opacity-40"
        style={{ color: "var(--ink)" }}
      >
        50 states · 50 capitals · 1 goal
      </div>
    </div>
  );
};

// ─── QUIZ MODE ───────────────────────────────────────────────────────────
const Quiz = ({ onExit, recordResult, category, direction: dir, subset }) => {
  const deck = useMemo(() => shuffle(subset || STATES), []);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);

  const current = deck[idx];
  const qa = getQA(current, category, dir);
  const options = useMemo(() => {
    const distractors = getDistractors(current, category, dir);
    return shuffle([qa.answer, ...distractors]);
  }, [idx]);

  const pick = (choice) => {
    if (selected) return;
    setSelected(choice);
    const right = choice === qa.answer;
    if (right) {
      setCorrect((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
    recordResult(right);
    statsStore.record(current.s, right, "quiz");
    setTimeout(() => {
      if (idx + 1 >= deck.length) {
        const finalCorrect = right ? correct + 1 : correct;
        ga("quiz_complete", { correct: finalCorrect, total: deck.length, pct: Math.round(finalCorrect / deck.length * 100) });
        onExit({ correct: finalCorrect, total: deck.length });
      } else {
        setIdx((i) => i + 1);
        setSelected(null);
      }
    }, 1100);
  };

  const getOptionStyle = (opt) => {
    if (!selected) return { background: "var(--paper)", color: "var(--ink)" };
    if (opt === qa.answer) return { background: "var(--sage)", color: "var(--cream)" };
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
          {qa.aLabel} of
        </div>
        <h2
          className="font-display font-black leading-tight"
          style={{
            fontSize: "clamp(2rem, 9vw, 3.5rem)",
            color: "var(--ink)",
            fontVariationSettings: '"SOFT" 100, "WONK" 1',
          }}
        >
          {qa.question}
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
              selected && opt === selected && opt !== qa.answer ? "shake" : ""
            } ${selected && opt === qa.answer ? "pop" : ""}`}
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
const TypeIt = ({ onExit, recordResult, category, direction: dir, subset }) => {
  const deck = useMemo(() => shuffle(subset || STATES), []);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null); // 'right' | 'close' | 'wrong' | null
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const inputRef = useRef(null);

  const current = deck[idx];
  const qa = getQA(current, category, dir);

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx]);

  const submit = () => {
    if (feedback) return;
    if (!input.trim()) return;
    const normed = normalize(input);
    const answer = normalize(qa.answer);
    const exact = normed === answer;
    const dist = exact ? 0 : levenshtein(normed, answer);
    const isAbbr = category === "abbreviations" && dir === "forward";
    const close = !exact && !isAbbr && dist <= 2;
    const right = exact || close;

    setFeedback(exact ? "right" : close ? "close" : "wrong");
    if (close) setShowAnswer(true); // show correct spelling
    recordResult(right);
    statsStore.record(current.s, right, "type");
    if (right) {
      setCorrect((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      setShowAnswer(true);
    }
    setTimeout(() => next(right), right ? (close ? 1400 : 900) : 1800);
  };

  const skip = () => {
    if (feedback) return;
    setFeedback("wrong");
    setShowAnswer(true);
    setStreak(0);
    recordResult(false);
    statsStore.record(current.s, false, "type");
    setTimeout(() => next(false), 1500);
  };

  const next = (wasRight) => {
    if (idx + 1 >= deck.length) {
      const finalCorrect = wasRight ? correct + 1 : correct;
      ga("typeit_complete", { correct: finalCorrect, total: deck.length, pct: Math.round(finalCorrect / deck.length * 100) });
      onExit({ correct: finalCorrect, total: deck.length });
    } else {
      setIdx((i) => i + 1);
      setInput("");
      setFeedback(null);
      setShowAnswer(false);
    }
  };

  const bg =
    feedback === "right" || feedback === "close"
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
          {qa.aLabel} of
        </div>
        <h2
          className="font-display font-black leading-tight"
          style={{
            fontSize: "clamp(2rem, 9vw, 3.5rem)",
            color: "var(--ink)",
            fontVariationSettings: '"SOFT" 100, "WONK" 1',
          }}
        >
          {qa.question}
        </h2>
      </div>

      <div
        className={`rounded-2xl p-5 mb-4 transition-colors duration-300 ${
          feedback === "wrong" ? "shake" : ""
        } ${feedback === "right" || feedback === "close" ? "pop" : ""}`}
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
          placeholder={`Type the ${qa.aLabel.toLowerCase()}...`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize={category === "abbreviations" && dir === "forward" ? "characters" : "words"}
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
            {feedback === "close" ? "Close enough! " : "Answer: "}
            {qa.answer}
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
const Speed = ({ onExit, recordResult, category, direction: dir, onViewLeaderboard }) => {
  const [deck, setDeck] = useState(() => shuffle(STATES));
  const [idx, setIdx] = useState(0);
  const [time, setTime] = useState(60);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState(null);
  const [done, setDone] = useState(false);

  // Countdown state: cycles through "Ready?", "3", "2", "1", "GO!", then null (playing)
  const [countdown, setCountdown] = useState("Ready?");

  useEffect(() => {
    if (countdown === null) return;
    const steps = { "Ready?": "3", "3": "2", "2": "1", "1": "GO!", "GO!": null };
    const delay = countdown === "Ready?" ? 1000 : countdown === "GO!" ? 600 : 800;
    const t = setTimeout(() => setCountdown(steps[countdown]), delay);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (countdown !== null || done) return;
    if (time <= 0 || idx >= deck.length) {
      setDone(true);
      ga("speed_complete", { score, category });
      return;
    }
    const t = setTimeout(() => setTime((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [time, done, countdown, idx]);

  const current = deck[idx < deck.length ? idx : deck.length - 1];
  const qa = getQA(current, category, dir);
  const options = useMemo(() => {
    const distractors = getDistractors(current, category, dir);
    return shuffle([qa.answer, ...distractors]);
  }, [idx, current]);

  const pick = (choice) => {
    if (done || flash) return;
    const right = choice === qa.answer;
    setFlash(right ? "right" : "wrong");
    recordResult(right);
    statsStore.record(current.s, right, "speed");
    if (right) setScore((s) => s + 1);
    setTimeout(() => {
      setFlash(null);
      setIdx((i) => i + 1);
    }, 220);
  };

  const aLabel = category === "abbreviations" ? "abbreviations" : "capitals";

  // Leaderboard submission state
  const [posted, setPosted] = useState(false);
  const [posting, setPosting] = useState(false);
  const [rank, setRank] = useState(null);
  const [nickInput, setNickInput] = useState("");
  const [showNickInput, setShowNickInput] = useState(false);
  const [profanityError, setProfanityError] = useState(false);

  const handlePost = async (name) => {
    if (posting || posted) return;
    if (filter.check(name)) {
      setProfanityError(true);
      setShowNickInput(true);
      setNickInput(name);
      return;
    }
    setProfanityError(false);
    setPosting(true);
    try {
      leaderboard.setNickname(name);
      await leaderboard.submit(name, score, category);
      const r = await leaderboard.getRank(score, category);
      setRank(r);
      setPosted(true);
      ga("leaderboard_submit", { score, category, rank: r });
    } catch (e) {
      console.error("Leaderboard submit failed:", e);
    }
    setPosting(false);
  };

  const savedNames = leaderboard.getAllNicknames().filter((n) => !filter.check(n));
  const [showNamePicker, setShowNamePicker] = useState(false);

  const startPost = () => {
    if (savedNames.length > 0) {
      setShowNamePicker(true);
    } else {
      setShowNickInput(true);
      setNickInput("");
    }
  };

  if (done) {
    const catLabel = category === "abbreviations" ? "Abbreviations" : "Capitals";

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
          {aLabel} in 60 seconds
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

        {/* Leaderboard submit */}
        {score > 0 && (
          <div className="mb-6">
            {posted ? (
              <div className="fade-in">
                <div
                  className="rounded-2xl p-4 mb-2"
                  style={{ background: "rgba(107,142,111,0.12)", border: "2px solid var(--sage)" }}
                >
                  <div
                    className="font-mono text-xs uppercase tracking-widest"
                    style={{ color: "var(--sage)" }}
                  >
                    ✓ Posted to Leaderboard
                  </div>
                  {rank && (
                    <div
                      className="font-display font-bold text-lg mt-1"
                      style={{ color: "var(--ink)" }}
                    >
                      You're #{rank} on {catLabel}
                    </div>
                  )}
                </div>
                <button
                  onClick={onViewLeaderboard}
                  className="w-full rounded-xl py-2.5 font-mono text-xs uppercase tracking-widest transition hover:opacity-70"
                  style={{ color: "var(--ink)", border: "2px solid rgba(26,37,55,0.15)" }}
                >
                  View Leaderboard
                </button>
              </div>
            ) : showNamePicker && savedNames.length > 0 ? (
              <div className="fade-in">
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--paper)", border: "2px solid var(--ink)" }}
                >
                  <div
                    className="font-mono text-[10px] uppercase tracking-widest mb-3"
                    style={{ color: "var(--dusty)" }}
                  >
                    Who's Playing?
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {savedNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => handlePost(name)}
                        disabled={posting}
                        className="rounded-xl px-4 py-2 font-display font-bold text-sm transition active:scale-[0.96]"
                        style={{
                          background: "var(--gold)",
                          color: "var(--ink)",
                          border: "2px solid var(--ink)",
                          boxShadow: "2px 2px 0 var(--ink)",
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setShowNamePicker(false); setShowNickInput(true); setNickInput(""); }}
                    className="font-mono text-[10px] uppercase tracking-widest transition hover:opacity-70"
                    style={{ color: "var(--dusty)" }}
                  >
                    Someone else? →
                  </button>
                </div>
              </div>
            ) : showNickInput ? (
              <div className="fade-in">
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--paper)", border: "2px solid var(--ink)" }}
                >
                  <div
                    className="font-mono text-[10px] uppercase tracking-widest mb-3"
                    style={{ color: "var(--dusty)" }}
                  >
                    Choose a Nickname
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nickInput}
                      onChange={(e) => { setNickInput(e.target.value.slice(0, 15)); setProfanityError(false); }}
                      placeholder="Your name..."
                      autoFocus
                      className="flex-1 rounded-xl px-3 py-2 font-body text-sm outline-none"
                      style={{
                        background: "rgba(26,37,55,0.06)",
                        color: "var(--ink)",
                        border: "2px solid rgba(26,37,55,0.15)",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && nickInput.trim().length >= 3)
                          handlePost(nickInput.trim());
                      }}
                    />
                    <button
                      onClick={() => handlePost(nickInput.trim())}
                      disabled={nickInput.trim().length < 3 || posting}
                      className="rounded-xl px-4 py-2 font-mono text-xs uppercase tracking-widest font-bold transition"
                      style={{
                        background: nickInput.trim().length >= 3 ? "var(--ink)" : "rgba(26,37,55,0.1)",
                        color: nickInput.trim().length >= 3 ? "var(--cream)" : "var(--dusty)",
                      }}
                    >
                      {posting ? "..." : "Post"}
                    </button>
                  </div>
                  {profanityError ? (
                    <div className="font-mono text-[10px] mt-1" style={{ color: "var(--rust)" }}>
                      Please choose an appropriate nickname
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] mt-1" style={{ color: "var(--dusty)" }}>
                      3-15 characters
                    </div>
                  )}
                  {savedNames.length > 0 && (
                    <button
                      onClick={() => { setShowNickInput(false); setShowNamePicker(true); }}
                      className="font-mono text-[10px] uppercase tracking-widest mt-2 transition hover:opacity-70"
                      style={{ color: "var(--dusty)" }}
                    >
                      ← Back to names
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={startPost}
                disabled={posting}
                className="w-full rounded-2xl p-4 font-display font-bold text-lg transition active:scale-[0.98]"
                style={{
                  background: "var(--gold)",
                  color: "var(--ink)",
                  border: "2px solid var(--ink)",
                  boxShadow: "3px 3px 0 var(--ink)",
                }}
              >
                {posting ? "Posting..." : "Post to Leaderboard"}
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => {
              setDeck(shuffle(STATES));
              setIdx(0);
              setTime(60);
              setScore(0);
              setDone(false);
              setCountdown("Ready?");
              setPosted(false);
              setRank(null);
              setShowNickInput(false);
              setShowNamePicker(false);
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

  if (countdown !== null) {
    const boxStyles = {
      "Ready?": { rotate: "-2deg", borderColor: "var(--ink)", background: "var(--cream)" },
      "3": { rotate: "3deg", borderColor: "var(--ink)", background: "var(--paper)" },
      "2": { rotate: "-4deg", borderColor: "var(--rust)", background: "var(--cream)" },
      "1": { rotate: "2.5deg", borderColor: "var(--gold)", background: "var(--paper)" },
      "GO!": { rotate: "-3deg", borderColor: "var(--rust)", background: "rgba(196,78,71,0.08)" },
    };
    const bs = boxStyles[countdown];
    return (
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div
          key={countdown}
          style={{
            border: `3px solid ${bs.borderColor}`,
            background: bs.background,
            boxShadow: "4px 4px 0 var(--ink)",
            borderRadius: "1rem",
            padding: countdown === "Ready?" ? "1.5rem 2.5rem" : "1rem 2.5rem",
            transform: `rotate(${bs.rotate})`,
            animation: "countdownPop 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            className="font-display font-black text-center"
            style={{
              fontSize: countdown === "Ready?" ? "clamp(2.5rem, 12vw, 4.5rem)" : countdown === "GO!" ? "clamp(4rem, 20vw, 8rem)" : "clamp(5rem, 25vw, 10rem)",
              color: countdown === "GO!" ? "var(--rust)" : "var(--ink)",
              fontVariationSettings: '"SOFT" 100, "WONK" 1',
              fontStyle: countdown === "GO!" ? "italic" : "normal",
              lineHeight: 1,
            }}
          >
            {countdown}
          </div>
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
          {qa.aLabel} of
        </div>
        <h2
          className="font-display font-black leading-tight"
          style={{
            fontSize: "clamp(1.75rem, 8vw, 3rem)",
            color: flashBg ? "var(--cream)" : "var(--ink)",
            fontVariationSettings: '"SOFT" 100, "WONK" 1',
          }}
        >
          {qa.question}
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
const Study = ({ onExit, category, direction: dir, subset }) => {
  const source = subset || STATES;
  const [deck, setDeck] = useState(() => shuffle(source));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [slideDir, setSlideDir] = useState("next");
  const [known, setKnown] = useState(new Set());
  const [missed, setMissed] = useState(new Set());
  const [firstPassMissed, setFirstPassMissed] = useState(new Set());
  const [pass, setPass] = useState(1);
  const [done, setDone] = useState(false);
  const [filter, setFilter] = useState("all"); // "all" | "missed"
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const swipingRef = useRef(false);
  const justSwipedRef = useRef(false);
  const SWIPE_THRESHOLD = 80;

  const viewDeck = filter === "missed"
    ? deck.filter((d) => missed.has(d.s))
    : deck;
  const viewIdx = Math.min(idx, viewDeck.length - 1);
  const card = viewDeck[viewIdx] || deck[0];
  const qa = card ? getQA(card, category, dir) : null;

  const applyFilter = (f) => {
    setFilter(f);
    setIdx(0);
    setFlipped(false);
  };

  const goPrev = () => {
    if (viewIdx > 0) {
      setSlideDir("prev");
      setFlipped(false);
      setIdx(viewIdx - 1);
    }
  };

  const goNext = () => {
    if (viewIdx + 1 < viewDeck.length) {
      setSlideDir("next");
      setFlipped(false);
      setIdx(viewIdx + 1);
    }
  };

  const advance = (knew) => {
    const key = card.s;
    statsStore.record(key, knew, "flash");
    if (knew) {
      setKnown((s) => new Set(s).add(key));
      setMissed((s) => { const n = new Set(s); n.delete(key); return n; });
    } else {
      setMissed((s) => new Set(s).add(key));
      if (pass === 1) setFirstPassMissed((s) => new Set(s).add(key));
    }

    setSlideDir("next");
    setFlipped(false);

    if (idx + 1 < deck.length) {
      setIdx((i) => i + 1);
    } else {
      // End of current deck — check for retry cards
      const retryKeys = new Set();
      deck.forEach((d) => {
        const k = d.s;
        if (!knew && k === key) retryKeys.add(k);
        else if (!known.has(k) && !knew) retryKeys.add(k);
        else if (missed.has(k) && k !== key) retryKeys.add(k);
      });
      // Recalculate: cards that were missed and not yet known
      const nextDeck = source.filter((st) => {
        if (st.s === key && knew) return false;
        if (known.has(st.s)) return false;
        if (missed.has(st.s)) return true;
        if (!knew && st.s === key) return true;
        return false;
      });

      if (nextDeck.length === 0) {
        setDone(true);
        ga("flashcards_complete", { known: known.size + (knew ? 1 : 0), total: source.length, passes: pass });
      } else {
        setDeck(shuffle(nextDeck));
        setIdx(0);
        setPass((p) => p + 1);
      }
    }
  };

  const onSwipeStart = (e) => {
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
    swipingRef.current = false;
  };

  const onSwipeMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    if (!swipingRef.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      swipingRef.current = true;
    }
    if (swipingRef.current) {
      e.preventDefault();
      setSwipeX(dx);
    }
  };

  const onSwipeEnd = () => {
    if (swipingRef.current) {
      justSwipedRef.current = true;
      setTimeout(() => { justSwipedRef.current = false; }, 50);
    }
    if (Math.abs(swipeX) > SWIPE_THRESHOLD) {
      const knew = swipeX > 0;
      setSwipeX(knew ? 500 : -500);
      setTimeout(() => {
        setSwipeX(0);
        advance(knew);
      }, 250);
    } else {
      setSwipeX(0);
    }
    swipingRef.current = false;
  };

  const handleFlipClick = () => {
    if (!justSwipedRef.current) setFlipped((f) => !f);
  };

  // Confidence tier for current card
  const cardStatus = card ? statsStore.getStatus(card.s) : null;
  const cardConfidence = card ? statsStore.getConfidence(card.s) : null;
  const cardTier = CONFIDENCE_TIERS.find((t) => t.check(cardStatus, cardConfidence)) || CONFIDENCE_TIERS[4];

  // Session judgment for current card
  const cardKnown = card ? known.has(card.s) : false;
  const cardMissed = card ? missed.has(card.s) : false;

  if (done) {
    const total = source.length;
    const firstPassKnew = total - firstPassMissed.size;
    const pct = Math.round((firstPassKnew / total) * 100);
    const msg =
      pct === 100
        ? "Flawless."
        : pct >= 90
        ? "Nearly perfect."
        : pct >= 75
        ? "Solid recall."
        : pct >= 50
        ? "Getting there."
        : "Keep at it.";

    return (
      <div className="fade-in text-center py-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-3"
          style={{ color: "var(--dusty)" }}
        >
          All Cards Reviewed
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
        <div className="flex justify-around py-3 px-4 mb-6 rounded-2xl"
          style={{ background: "rgba(26,37,55,0.05)" }}
        >
          <Stat label="First Try" value={firstPassKnew} tone="sage" />
          <div style={{ width: 1, background: "rgba(26,37,55,0.1)" }} />
          <Stat label="Needed Review" value={firstPassMissed.size} tone="rust" />
          <div style={{ width: 1, background: "rgba(26,37,55,0.1)" }} />
          <Stat label="Passes" value={pass} />
        </div>
        <div
          className="inline-block px-4 py-2 stamp font-mono text-xs mb-8"
        >
          {pct === 100
            ? "★ PERFECT RECALL ★"
            : pct >= 90
            ? "★ SHARP MIND ★"
            : pct >= 75
            ? "★ SOLID ★"
            : "★ KEEP STUDYING ★"}
        </div>
        <div className="space-y-3">
          <button
            onClick={() => {
              setDeck(shuffle(source));
              setIdx(0);
              setFlipped(false);
              setKnown(new Set());
              setMissed(new Set());
              setFirstPassMissed(new Set());
              setPass(1);
              setDone(false);
            }}
            className="w-full rounded-2xl p-4 font-display font-bold text-lg"
            style={{
              background: "var(--rust)",
              color: "var(--cream)",
              border: "2px solid var(--ink)",
              boxShadow: "3px 3px 0 var(--ink)",
            }}
          >
            Start Over
          </button>
          <button
            onClick={() => onExit(null)}
            className="w-full rounded-2xl p-4 font-mono text-xs uppercase tracking-widest"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "2px solid var(--ink)",
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const slideAnim =
    slideDir === "next"
      ? "slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1)"
      : "slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={() => onExit(null)} />
        <div className="flex gap-2">
          {pass > 1 && (
            <div
              className="font-mono text-xs px-3 py-1.5 rounded-full font-bold"
              style={{ background: "var(--gold)", color: "var(--ink)" }}
            >
              Pass {pass}
            </div>
          )}
          <div
            className="font-mono text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(26,37,55,0.08)", color: "var(--ink)" }}
          >
            {viewIdx + 1}/{viewDeck.length}
          </div>
        </div>
      </div>

      {/* Filter toggle */}
      <div
        className="flex rounded-full mb-4 overflow-hidden"
        style={{ border: "2px solid rgba(26,37,55,0.2)" }}
      >
        {[
          { id: "all", label: "All" },
          { id: "missed", label: "Don't Know Only" },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => applyFilter(opt.id)}
            disabled={opt.id === "missed" && missed.size === 0}
            className="flex-1 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors"
            style={{
              background: filter === opt.id ? "var(--ink)" : "transparent",
              color: filter === opt.id ? "var(--cream)" : "var(--ink)",
              opacity: opt.id === "missed" && missed.size === 0 ? 0.3 : 1,
            }}
          >
            {opt.label}{opt.id === "missed" && missed.size > 0 ? ` (${missed.size})` : ""}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div
        className="h-1 rounded-full mb-6 overflow-hidden"
        style={{ background: "rgba(26,37,55,0.1)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${((viewIdx + 1) / viewDeck.length) * 100}%`,
            background: "var(--sage)",
          }}
        />
      </div>

      {/* Card area with desktop chevrons */}
      <div className="relative flex items-center mb-6">
        {/* Left chevron — Previous card (desktop only) */}
        <button
          onClick={goPrev}
          disabled={viewIdx === 0}
          className="hidden md:flex absolute -left-12 z-10 w-10 h-10 items-center justify-center rounded-full transition hover:scale-110 active:scale-95"
          style={{
            background: "rgba(26,37,55,0.08)",
            color: "var(--ink)",
            border: "2px solid rgba(26,37,55,0.15)",
            opacity: viewIdx === 0 ? 0.3 : 1,
          }}
          aria-label="Previous card"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        {/* Card wrapper — swipeable */}
        <div
          key={`${pass}-${viewIdx}-${filter}`}
          className="w-full"
          style={{
            perspective: "1600px",
            aspectRatio: "4 / 5",
            animation: slideAnim,
            position: "relative",
            transform: `translateX(${swipeX}px) rotate(${swipeX * 0.05}deg)`,
            transition: swipingRef.current ? "none" : "transform 0.25s ease",
          }}
          onTouchStart={onSwipeStart}
          onTouchMove={onSwipeMove}
          onTouchEnd={onSwipeEnd}
        >
        {/* Flip container */}
        <div
          onClick={handleFlipClick}
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
          {/* FRONT — Question */}
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
              {qa.qLabel} · {card.r}
            </div>
            <div className="absolute top-5 right-5 flex items-center gap-2">
              {(cardKnown || cardMissed) && (
                <div
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: cardKnown ? "rgba(74,122,79,0.15)" : "rgba(193,74,51,0.15)",
                    color: cardKnown ? "#4A7A4F" : "#C14A33",
                  }}
                >
                  {cardKnown ? "✓ Know" : "✗ Don't Know"}
                </div>
              )}
              <div
                className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: `${cardTier.color}20`, color: cardTier.color }}
              >
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: cardTier.color }} />
                {cardTier.label}
              </div>
              <div className="font-mono text-[10px] font-bold" style={{ color: "var(--dusty)" }}>
                №{String(idx + 1).padStart(2, "0")}
              </div>
            </div>

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
                {qa.question}
              </h2>
            </div>

            <div
              className="absolute bottom-12 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest whitespace-nowrap"
              style={{ color: "var(--dusty)", opacity: 0.7 }}
            >
              tap to reveal {qa.aLabel.toLowerCase()}
            </div>
          </div>

          {/* BACK — Answer */}
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
              {qa.aLabel} · {card.r}
            </div>
            <div className="absolute top-5 right-5 flex items-center gap-2">
              {(cardKnown || cardMissed) && (
                <div
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: cardKnown ? "rgba(74,122,79,0.25)" : "rgba(193,74,51,0.25)",
                    color: cardKnown ? "#8DB891" : "#D4836A",
                  }}
                >
                  {cardKnown ? "✓ Know" : "✗ Don't Know"}
                </div>
              )}
              <div
                className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: `${cardTier.color}30`, color: cardTier.color }}
              >
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: cardTier.color }} />
                {cardTier.label}
              </div>
              <div className="font-mono text-[10px] font-bold" style={{ color: "var(--gold)" }}>
                №{String(idx + 1).padStart(2, "0")}
              </div>
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
                {qa.question}
              </div>
              <h2
                className="font-display font-black italic leading-[0.9]"
                style={{
                  fontSize: "clamp(2.75rem, 13vw, 5.5rem)",
                  color: "var(--cream)",
                  fontVariationSettings: '"SOFT" 100, "WONK" 1',
                }}
              >
                {qa.answer}
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

        {/* Swipe hint overlay */}
        {swipeX !== 0 && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "1.5rem",
                background: swipeX > 0 ? "var(--sage)" : "var(--rust)",
                opacity: Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1) * 0.25,
                pointerEvents: "none",
                zIndex: 10,
              }}
            />
            <div
              className="font-display font-bold text-xl"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 11,
                pointerEvents: "none",
                opacity: Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1),
                color: swipeX > 0 ? "var(--sage)" : "var(--rust)",
                textShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              {swipeX > 0 ? "Know It" : "Don't Know"}
            </div>
          </>
        )}
        </div>

        {/* Right chevron — Next card (desktop only) */}
        <button
          onClick={goNext}
          disabled={viewIdx + 1 >= viewDeck.length}
          className="hidden md:flex absolute -right-12 z-10 w-10 h-10 items-center justify-center rounded-full transition hover:scale-110 active:scale-95"
          style={{
            background: "rgba(26,37,55,0.08)",
            color: "var(--ink)",
            border: "2px solid rgba(26,37,55,0.15)",
            opacity: viewIdx + 1 >= viewDeck.length ? 0.3 : 1,
          }}
          aria-label="Next card"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div
        className="text-center mb-3 font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--dusty)", opacity: 0.5 }}
      >
        swipe left or right to judge
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => advance(false)}
          className="flex-1 rounded-2xl p-4 font-display font-bold text-lg transition active:scale-[0.96]"
          style={{
            background: "var(--rust)",
            color: "var(--cream)",
            border: "2px solid var(--ink)",
            boxShadow: "2px 2px 0 var(--ink)",
          }}
        >
          Don't Know
        </button>
        <button
          onClick={() => advance(true)}
          className="flex-1 rounded-2xl p-4 font-display font-bold text-lg transition active:scale-[0.96]"
          style={{
            background: "var(--sage)",
            color: "var(--cream)",
            border: "2px solid var(--ink)",
            boxShadow: "2px 2px 0 var(--ink)",
          }}
        >
          Know It
        </button>
      </div>
    </div>
  );
};

// ─── MATCH CONFIG ───────────────────────────────────────────────────────
const MatchConfig = ({ category, onStart, onBack }) => {
  const [cardCount, setCardCount] = useState(12);
  const [source, setSource] = useState("random");
  const [region, setRegion] = useState("South");
  const hasHistory = statsStore.hasEnoughHistory(5);

  const catLabel = category === "abbreviations" ? "abbreviations" : "capitals";

  return (
    <div className="slide-up">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={onBack} />
        <div
          className="font-mono text-xs px-3 py-1.5 rounded-full font-bold"
          style={{ background: "var(--gold)", color: "var(--ink)" }}
        >
          Match
        </div>
      </div>

      <div className="text-center mb-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-2"
          style={{ color: "var(--dusty)" }}
        >
          Memory Game
        </div>
        <h2
          className="font-display font-black text-3xl leading-tight mb-2"
          style={{ color: "var(--ink)", fontVariationSettings: '"SOFT" 100, "WONK" 1' }}
        >
          Set Up Your Board
        </h2>
        <div className="font-body text-sm" style={{ color: "var(--dusty)" }}>
          Match states with their {catLabel}
        </div>
      </div>

      {/* Card count */}
      <div className="mb-6">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Cards on Board
        </div>
        <div className="flex gap-2">
          {[8, 12, 16, 20].map((n) => (
            <button
              key={n}
              onClick={() => setCardCount(n)}
              className="flex-1 py-3 rounded-xl font-mono text-sm font-bold transition"
              style={{
                background: cardCount === n ? "var(--ink)" : "var(--paper)",
                color: cardCount === n ? "var(--cream)" : "var(--ink)",
                border: "2px solid var(--ink)",
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div
          className="font-mono text-[10px] mt-1 text-center"
          style={{ color: "var(--dusty)" }}
        >
          {cardCount / 2} pairs
        </div>
      </div>

      {/* Source */}
      <div className="mb-6">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Card Source
        </div>
        <div className="space-y-2">
          {[
            { id: "random", label: "Random", desc: "Random states from all 50" },
            { id: "region", label: "By Region", desc: "Focus on a specific region" },
            { id: "weak", label: "Weak Areas", desc: "States you struggle with most", disabled: !hasHistory },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => !opt.disabled && setSource(opt.id)}
              className="w-full text-left rounded-xl p-4 transition"
              style={{
                background: source === opt.id ? "var(--ink)" : "var(--paper)",
                color: source === opt.id ? "var(--cream)" : "var(--ink)",
                border: "2px solid var(--ink)",
                opacity: opt.disabled ? 0.35 : 1,
                cursor: opt.disabled ? "not-allowed" : "pointer",
              }}
            >
              <div className="font-display font-bold text-base">{opt.label}</div>
              <div
                className="font-mono text-[10px] uppercase tracking-widest mt-0.5"
                style={{ opacity: 0.7 }}
              >
                {opt.disabled ? "Need 5+ states with quiz history" : opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Region sub-options */}
      {source === "region" && (
        <div className="mb-6 fade-in">
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "var(--dusty)" }}
          >
            Region
          </div>
          <div className="grid grid-cols-2 gap-2">
            {REGION_NAMES.map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className="py-3 rounded-xl font-mono text-xs font-bold transition uppercase tracking-widest"
                style={{
                  background: region === r ? "var(--rust)" : "var(--paper)",
                  color: region === r ? "var(--cream)" : "var(--ink)",
                  border: "2px solid var(--ink)",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start */}
      <button
        onClick={() => onStart({ cardCount, source, region })}
        className="w-full rounded-2xl p-5 font-display font-bold text-xl transition active:scale-[0.98]"
        style={{
          background: "var(--gold)",
          color: "var(--ink)",
          border: "2px solid var(--ink)",
          boxShadow: "4px 4px 0 var(--ink)",
        }}
      >
        Start Matching →
      </button>
    </div>
  );
};

// ─── MATCH GAME ─────────────────────────────────────────────────────────
const MatchGame = ({ config, category, onExit }) => {
  const [cards] = useState(() =>
    buildMatchDeck(config.cardCount, config.source, config.region, category)
  );
  const [flippedIds, setFlippedIds] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [done, setDone] = useState(false);
  const [lockBoard, setLockBoard] = useState(false);
  const [animCards, setAnimCards] = useState({});

  const pairCount = config.cardCount / 2;

  // Timer
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  // Check for game complete
  useEffect(() => {
    if (matchedPairs.size === pairCount && pairCount > 0) {
      ga("match_complete", { pairs: pairCount, moves, time });
      setTimeout(() => setDone(true), 600);
    }
  }, [matchedPairs, pairCount]);

  const handleCardClick = (card) => {
    if (lockBoard || matchedPairs.has(card.pairId) || flippedIds.includes(card.id)) return;

    const newFlipped = [...flippedIds, card.id];
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      setLockBoard(true);

      const [first, second] = newFlipped.map((id) => cards.find((c) => c.id === id));

      if (first.pairId === second.pairId) {
        setAnimCards({ [first.id]: "match", [second.id]: "match" });
        setTimeout(() => {
          setMatchedPairs((s) => new Set(s).add(first.pairId));
          setFlippedIds([]);
          setLockBoard(false);
          setAnimCards({});
        }, 600);
      } else {
        setAnimCards({ [first.id]: "miss", [second.id]: "miss" });
        setTimeout(() => {
          setFlippedIds([]);
          setLockBoard(false);
          setAnimCards({});
        }, 1000);
      }
    }
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const gridCols = { 8: 4, 12: 4, 16: 4, 20: 5 }[config.cardCount] || 4;

  const getRating = () => {
    const ratio = moves / pairCount;
    if (ratio <= 1.3) return "★ EXTRAORDINARY ★";
    if (ratio <= 1.8) return "★ SHARP MIND ★";
    if (ratio <= 2.5) return "★ SOLID ★";
    return "★ KEEP PRACTICING ★";
  };

  if (done) {
    return (
      <div className="fade-in text-center py-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-3"
          style={{ color: "var(--dusty)" }}
        >
          All Pairs Found
        </div>
        <div
          className="font-display font-black leading-none mb-2"
          style={{
            fontSize: "clamp(4rem, 20vw, 7rem)",
            color: "var(--gold)",
            fontVariationSettings: '"SOFT" 100, "WONK" 1',
          }}
        >
          {moves}
        </div>
        <div
          className="font-display italic text-xl mb-1"
          style={{ color: "var(--ink)" }}
        >
          moves
        </div>
        <div
          className="font-mono text-sm mb-6"
          style={{ color: "var(--dusty)" }}
        >
          {formatTime(time)} elapsed · {pairCount} pairs
        </div>
        <div
          className="flex justify-around py-3 px-4 mb-6 rounded-2xl"
          style={{ background: "rgba(26,37,55,0.05)" }}
        >
          <Stat label="Moves" value={moves} />
          <div style={{ width: 1, background: "rgba(26,37,55,0.1)" }} />
          <Stat label="Time" value={formatTime(time)} tone="gold" />
          <div style={{ width: 1, background: "rgba(26,37,55,0.1)" }} />
          <Stat label="Pairs" value={pairCount} tone="sage" />
        </div>
        <div className="inline-block px-4 py-2 stamp font-mono text-xs mb-8">
          {getRating()}
        </div>
        <div className="space-y-3">
          <button
            onClick={() => onExit("restart")}
            className="w-full rounded-2xl p-4 font-display font-bold text-lg"
            style={{
              background: "var(--gold)",
              color: "var(--ink)",
              border: "2px solid var(--ink)",
              boxShadow: "3px 3px 0 var(--ink)",
            }}
          >
            Play Again
          </button>
          <button
            onClick={() => onExit("config")}
            className="w-full rounded-2xl p-4 font-mono text-xs uppercase tracking-widest"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "2px solid var(--ink)",
            }}
          >
            Change Settings
          </button>
          <button
            onClick={() => onExit("home")}
            className="w-full rounded-2xl p-4 font-mono text-xs uppercase tracking-widest"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "2px solid rgba(26,37,55,0.3)",
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-4">
        <BackBtn onClick={() => onExit("home")} />
        <div className="flex gap-2">
          <div
            className="font-mono text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(26,37,55,0.08)", color: "var(--ink)" }}
          >
            {moves} moves
          </div>
          <div
            className="font-mono text-xs px-3 py-1.5 rounded-full font-bold"
            style={{ background: "var(--gold)", color: "var(--ink)" }}
          >
            {formatTime(time)}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div
        className="h-1 rounded-full mb-4 overflow-hidden"
        style={{ background: "rgba(26,37,55,0.1)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${(matchedPairs.size / pairCount) * 100}%`,
            background: "var(--sage)",
          }}
        />
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
      >
        {cards.map((card) => {
          const isFlipped =
            flippedIds.includes(card.id) || matchedPairs.has(card.pairId);
          const isMatched = matchedPairs.has(card.pairId);
          const anim = animCards[card.id];

          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(card)}
              className={
                anim === "match" ? "pop" : anim === "miss" ? "shake" : ""
              }
              style={{
                perspective: "600px",
                aspectRatio: "3/4",
                cursor: isMatched ? "default" : "pointer",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  transformStyle: "preserve-3d",
                  transition: "transform 0.4s ease",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Face down */}
                <div
                  className="rounded-xl flex items-center justify-center"
                  style={{
                    position: "absolute",
                    inset: 0,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    background: "var(--paper)",
                    border: "2px solid var(--ink)",
                    boxShadow: "2px 2px 0 var(--ink)",
                  }}
                >
                  <span
                    className="font-display text-xl"
                    style={{ color: "var(--rust)", opacity: 0.3 }}
                  >
                    ★
                  </span>
                </div>

                {/* Face up */}
                <div
                  className="rounded-xl flex flex-col items-center justify-center p-1.5"
                  style={{
                    position: "absolute",
                    inset: 0,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background:
                      card.type === "state"
                        ? isMatched
                          ? "rgba(107,142,111,0.15)"
                          : "var(--paper)"
                        : isMatched
                        ? "rgba(107,142,111,0.9)"
                        : "var(--ink)",
                    border: `2px solid ${
                      isMatched ? "var(--sage)" : "var(--ink)"
                    }`,
                  }}
                >
                  <div
                    className="font-mono text-center leading-snug"
                    style={{
                      fontSize: "clamp(0.45rem, 1.8vw, 0.6rem)",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color:
                        card.type === "state"
                          ? "var(--dusty)"
                          : isMatched
                          ? "var(--cream)"
                          : "var(--gold)",
                      marginBottom: 2,
                    }}
                  >
                    {card.label}
                  </div>
                  <div
                    className="font-display font-bold text-center leading-tight"
                    style={{
                      fontSize: "clamp(0.6rem, 2.8vw, 0.9rem)",
                      color:
                        card.type === "state" ? "var(--ink)" : "var(--cream)",
                    }}
                  >
                    {card.text}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── ESCAPE CONFIG ──────────────────────────────────────────────────────
const EscapeConfig = ({ category, direction, onStart, onBack }) => {
  const [retries, setRetries] = useState(3);
  const [timed, setTimed] = useState(false);
  const [source, setSource] = useState("random");
  const [region, setRegion] = useState("South");
  const hasHistory = statsStore.hasEnoughHistory(5);

  const catLabel = category === "abbreviations" ? "abbreviations" : "capitals";

  return (
    <div className="slide-up">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={onBack} />
        <div
          className="font-mono text-xs px-3 py-1.5 rounded-full font-bold"
          style={{ background: "var(--deep)", color: "var(--cream)" }}
        >
          Escape
        </div>
      </div>

      <div className="text-center mb-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-2"
          style={{ color: "var(--dusty)" }}
        >
          Escape Room
        </div>
        <h2
          className="font-display font-black text-3xl leading-tight mb-2"
          style={{ color: "var(--ink)", fontVariationSettings: '"SOFT" 100, "WONK" 1' }}
        >
          Crack the Code
        </h2>
        <div className="font-body text-sm" style={{ color: "var(--dusty)" }}>
          Answer 4 questions to build a {catLabel} code
        </div>
      </div>

      {/* Retries */}
      <div className="mb-6">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Retries
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, Infinity].map((n) => (
            <button
              key={n}
              onClick={() => setRetries(n)}
              className="flex-1 py-3 rounded-xl font-mono text-sm font-bold transition"
              style={{
                background: retries === n ? "var(--ink)" : "var(--paper)",
                color: retries === n ? "var(--cream)" : "var(--ink)",
                border: "2px solid var(--ink)",
              }}
            >
              {n === Infinity ? "∞" : n}
            </button>
          ))}
        </div>
        <div
          className="font-mono text-[10px] mt-1 text-center"
          style={{ color: "var(--dusty)" }}
        >
          {retries === Infinity ? "unlimited attempts" : `${retries + 1} total attempts`}
        </div>
      </div>

      {/* Timer */}
      <div className="mb-6">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Timer
        </div>
        <div className="flex gap-2">
          {[
            { id: false, label: "Off" },
            { id: true, label: "5:00" },
          ].map((opt) => (
            <button
              key={String(opt.id)}
              onClick={() => setTimed(opt.id)}
              className="flex-1 py-3 rounded-xl font-mono text-sm font-bold transition"
              style={{
                background: timed === opt.id ? "var(--ink)" : "var(--paper)",
                color: timed === opt.id ? "var(--cream)" : "var(--ink)",
                border: "2px solid var(--ink)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Source */}
      <div className="mb-6">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Card Source
        </div>
        <div className="space-y-2">
          {[
            { id: "random", label: "Random", desc: "Random states from all 50" },
            { id: "region", label: "By Region", desc: "Focus on a specific region" },
            { id: "weak", label: "Weak Areas", desc: "States you struggle with most", disabled: !hasHistory },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => !opt.disabled && setSource(opt.id)}
              className="w-full text-left rounded-xl p-4 transition"
              style={{
                background: source === opt.id ? "var(--ink)" : "var(--paper)",
                color: source === opt.id ? "var(--cream)" : "var(--ink)",
                border: "2px solid var(--ink)",
                opacity: opt.disabled ? 0.35 : 1,
                cursor: opt.disabled ? "not-allowed" : "pointer",
              }}
            >
              <div className="font-display font-bold text-base">{opt.label}</div>
              <div
                className="font-mono text-[10px] uppercase tracking-widest mt-0.5"
                style={{ opacity: 0.7 }}
              >
                {opt.disabled ? "Need 5+ states with quiz history" : opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Region sub-options */}
      {source === "region" && (
        <div className="mb-6 fade-in">
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "var(--dusty)" }}
          >
            Region
          </div>
          <div className="grid grid-cols-2 gap-2">
            {REGION_NAMES.map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className="py-3 rounded-xl font-mono text-xs font-bold transition uppercase tracking-widest"
                style={{
                  background: region === r ? "var(--rust)" : "var(--paper)",
                  color: region === r ? "var(--cream)" : "var(--ink)",
                  border: "2px solid var(--ink)",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start */}
      <button
        onClick={() => onStart({ retries, timed, source, region })}
        className="w-full rounded-2xl p-5 font-display font-bold text-xl transition active:scale-[0.98]"
        style={{
          background: "var(--deep)",
          color: "var(--cream)",
          border: "2px solid var(--ink)",
          boxShadow: "4px 4px 0 var(--ink)",
        }}
      >
        Start Escape →
      </button>
    </div>
  );
};

// ─── ESCAPE GAME ────────────────────────────────────────────────────────
const buildEscapePuzzle = (source, region, category, direction) => {
  let pool;
  if (source === "region") {
    pool = STATES.filter((s) => s.r === region);
    if (pool.length < 4) {
      const extras = shuffle(STATES.filter((s) => s.r !== region));
      pool = [...pool, ...extras.slice(0, 4 - pool.length)];
    }
  } else if (source === "weak") {
    const weakNames = statsStore.getWeakest(4);
    pool = weakNames.map((name) => STATES.find((s) => s.s === name)).filter(Boolean);
    if (pool.length < 4) {
      const usedNames = new Set(pool.map((s) => s.s));
      const extras = shuffle(STATES.filter((s) => !usedNames.has(s.s)));
      pool = [...pool, ...extras.slice(0, 4 - pool.length)];
    }
  } else {
    pool = [...STATES];
  }

  const selected = shuffle(pool).slice(0, 4);

  return selected.map((state) => {
    const qa = getQA(state, category, direction);
    const distractors = getDistractors(state, category, direction);
    const allAnswers = shuffle([qa.answer, ...distractors]);

    // Assign unique random digits (0-9) to each option
    const digitPool = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const options = allAnswers.map((text, i) => ({
      text,
      digit: digitPool[i],
      isCorrect: text === qa.answer,
    }));

    const correctDigit = options.find((o) => o.isCorrect).digit;

    return {
      state,
      question: qa.question,
      qLabel: qa.qLabel,
      aLabel: qa.aLabel,
      options,
      correctDigit,
    };
  });
};

const EscapeGame = ({ config, category, direction, onExit }) => {
  const [puzzle] = useState(() =>
    buildEscapePuzzle(config.source, config.region, category, direction)
  );
  const [selections, setSelections] = useState([null, null, null, null]);
  const [attempt, setAttempt] = useState(1);
  const [feedback, setFeedback] = useState(null); // array of "green" | "white" per question
  const [showFeedback, setShowFeedback] = useState(false);
  const [done, setDone] = useState(false);
  const [escaped, setEscaped] = useState(false);
  const [time, setTime] = useState(config.timed ? 300 : 0);
  const [statsRecorded, setStatsRecorded] = useState(false);
  const maxAttempts = config.retries === Infinity ? Infinity : config.retries + 1;

  // Timer (pauses during feedback)
  const [timerPaused, setTimerPaused] = useState(false);
  useEffect(() => {
    if (!config.timed || done) return;
    if (timerPaused) return;
    if (time <= 0) {
      setDone(true);
      setEscaped(false);
      return;
    }
    const t = setTimeout(() => setTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [time, done, config.timed, timerPaused]);

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const selectOption = (qIdx, optIdx) => {
    if (done) return;
    setSelections((prev) => {
      const next = [...prev];
      next[qIdx] = optIdx;
      return next;
    });
    // Clear feedback when changing answers
    if (showFeedback) setShowFeedback(false);
  };

  const allAnswered = selections.every((s) => s !== null);

  const submitCode = () => {
    if (!allAnswered || done) return;

    const fb = puzzle.map((q, i) => {
      const selectedOpt = q.options[selections[i]];
      return selectedOpt.digit === q.correctDigit ? "green" : "white";
    });

    setFeedback(fb);
    setShowFeedback(true);

    // Record stats on first attempt only
    if (!statsRecorded) {
      puzzle.forEach((q, i) => {
        const correct = fb[i] === "green";
        statsStore.record(q.state.s, correct, "escape");
      });
      setStatsRecorded(true);
    }

    // Pause timer briefly
    if (config.timed) {
      setTimerPaused(true);
      setTimeout(() => setTimerPaused(false), 1000);
    }

    if (fb.every((f) => f === "green")) {
      ga("escape_complete", { escaped: true, attempts: attempt });
      setTimeout(() => {
        setDone(true);
        setEscaped(true);
      }, 600);
    } else if (attempt >= maxAttempts) {
      ga("escape_complete", { escaped: false, attempts: attempt });
      setTimeout(() => {
        setDone(true);
        setEscaped(false);
      }, 1000);
    } else {
      setAttempt((a) => a + 1);
    }
  };

  const getCode = () =>
    puzzle.map((q, i) =>
      selections[i] !== null ? q.options[selections[i]].digit : null
    );

  const code = getCode();

  const getRating = () => {
    if (attempt === 1) return "★ MASTERMIND ★";
    if (attempt === 2) return "★ SHARP ★";
    if (attempt === 3) return "★ SOLID ★";
    return "★ PERSISTENT ★";
  };

  // End screen
  if (done) {
    const elapsed = config.timed ? 300 - time : null;

    return (
      <div className="fade-in text-center py-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-3"
          style={{ color: "var(--dusty)" }}
        >
          {escaped ? "Code Accepted" : "Access Denied"}
        </div>
        <h2
          className="font-display font-black leading-tight mb-4"
          style={{
            fontSize: "clamp(2.5rem, 12vw, 4.5rem)",
            color: escaped ? "var(--sage)" : "var(--rust)",
            fontVariationSettings: '"SOFT" 100, "WONK" 1',
          }}
        >
          {escaped ? "Escaped!" : "Locked Out"}
        </h2>

        {escaped && (
          <div className="inline-block px-4 py-2 stamp font-mono text-xs mb-6">
            {getRating()}
          </div>
        )}

        <div
          className="flex justify-around py-3 px-4 mb-4 rounded-2xl"
          style={{ background: "rgba(26,37,55,0.05)" }}
        >
          <Stat label="Attempts" value={attempt} />
          {elapsed !== null && (
            <>
              <div style={{ width: 1, background: "rgba(26,37,55,0.1)" }} />
              <Stat label="Time" value={formatTime(elapsed)} tone="gold" />
            </>
          )}
        </div>

        {/* Show correct answers on failure */}
        {!escaped && (
          <div className="mb-6 text-left">
            <div
              className="font-mono text-[10px] uppercase tracking-widest mb-3 text-center"
              style={{ color: "var(--dusty)" }}
            >
              Correct Answers
            </div>
            <div className="space-y-2">
              {puzzle.map((q, i) => {
                const correctOpt = q.options.find((o) => o.isCorrect);
                return (
                  <div
                    key={i}
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: "rgba(26,37,55,0.05)" }}
                  >
                    <div
                      className="font-mono text-lg font-bold w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--sage)", color: "var(--cream)" }}
                    >
                      {correctOpt.digit}
                    </div>
                    <div>
                      <div
                        className="font-display font-bold text-sm"
                        style={{ color: "var(--ink)" }}
                      >
                        {q.question}
                      </div>
                      <div
                        className="font-mono text-[10px] uppercase tracking-widest"
                        style={{ color: "var(--dusty)" }}
                      >
                        {correctOpt.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className="font-mono text-xs text-center mt-3 font-bold tracking-widest"
              style={{ color: "var(--ink)" }}
            >
              Code: {puzzle.map((q) => q.correctDigit).join("")}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => onExit("restart")}
            className="w-full rounded-2xl p-4 font-display font-bold text-lg"
            style={{
              background: "var(--deep)",
              color: "var(--cream)",
              border: "2px solid var(--ink)",
              boxShadow: "3px 3px 0 var(--ink)",
            }}
          >
            Play Again
          </button>
          <button
            onClick={() => onExit("config")}
            className="w-full rounded-2xl p-4 font-mono text-xs uppercase tracking-widest"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "2px solid var(--ink)",
            }}
          >
            Change Settings
          </button>
          <button
            onClick={() => onExit("home")}
            className="w-full rounded-2xl p-4 font-mono text-xs uppercase tracking-widest"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "2px solid rgba(26,37,55,0.3)",
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <BackBtn onClick={() => onExit("home")} />
        <div className="flex gap-2">
          <div
            className="font-mono text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(26,37,55,0.08)", color: "var(--ink)" }}
          >
            {maxAttempts === Infinity
              ? `Attempt ${attempt}`
              : `Attempt ${attempt}/${maxAttempts}`}
          </div>
          {config.timed && (
            <div
              className="font-mono text-xs px-3 py-1.5 rounded-full font-bold"
              style={{
                background: time <= 60 ? "var(--rust)" : "var(--deep)",
                color: "var(--cream)",
              }}
            >
              {formatTime(time)}
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4 mb-6">
        {puzzle.map((q, qIdx) => {
          const dotColor =
            showFeedback && feedback
              ? feedback[qIdx] === "green"
                ? "var(--sage)"
                : "rgba(26,37,55,0.2)"
              : null;

          return (
            <div
              key={qIdx}
              className="rounded-2xl p-4"
              style={{
                background: "var(--paper)",
                border: `2px solid ${dotColor || "var(--ink)"}`,
                boxShadow: dotColor
                  ? `0 0 0 2px ${dotColor}`
                  : "2px 2px 0 var(--ink)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--dusty)" }}
                >
                  {q.aLabel} of
                </div>
                <div
                  className="font-display font-bold text-base"
                  style={{ color: "var(--ink)" }}
                >
                  {q.question}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((opt, oIdx) => {
                  const isSelected = selections[qIdx] === oIdx;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => selectOption(qIdx, oIdx)}
                      className="rounded-xl py-2.5 px-3 font-body text-sm transition active:scale-[0.97] text-left flex items-center gap-2"
                      style={{
                        background: isSelected ? "var(--ink)" : "transparent",
                        color: isSelected ? "var(--cream)" : "var(--ink)",
                        border: `2px solid ${isSelected ? "var(--ink)" : "rgba(26,37,55,0.2)"}`,
                      }}
                    >
                      <span
                        className="font-mono text-xs font-bold w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSelected
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(26,37,55,0.08)",
                        }}
                      >
                        {opt.digit}
                      </span>
                      <span className="leading-tight">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Code display */}
      <div className="flex justify-center gap-3 mb-4">
        {code.map((digit, i) => {
          const dotColor =
            showFeedback && feedback
              ? feedback[i] === "green"
                ? "var(--sage)"
                : "var(--rust)"
              : null;

          return (
            <div
              key={i}
              className={`w-14 h-16 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-2xl transition-all ${
                showFeedback && feedback && feedback[i] === "green" ? "pop" : ""
              } ${showFeedback && feedback && feedback[i] === "white" ? "shake" : ""}`}
              style={{
                background: dotColor || (digit !== null ? "var(--ink)" : "rgba(26,37,55,0.08)"),
                color: digit !== null ? "var(--cream)" : "var(--dusty)",
                border: `2px solid ${dotColor || "var(--ink)"}`,
              }}
            >
              <span>{digit !== null ? digit : "?"}</span>
              {showFeedback && feedback && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background:
                      feedback[i] === "green" ? "var(--cream)" : "var(--cream)",
                    opacity: feedback[i] === "green" ? 1 : 0.4,
                    marginTop: 2,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <button
        onClick={submitCode}
        disabled={!allAnswered}
        className="w-full rounded-2xl p-4 font-display font-bold text-lg transition active:scale-[0.98]"
        style={{
          background: allAnswered ? "var(--deep)" : "rgba(26,37,55,0.15)",
          color: allAnswered ? "var(--cream)" : "var(--dusty)",
          border: "2px solid var(--ink)",
          boxShadow: allAnswered ? "3px 3px 0 var(--ink)" : "none",
        }}
      >
        Try Code →
      </button>
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

// ─── LETTER BY LETTER (REVEAL) ──────────────────────────────────────────
const REVEAL_COUNT = 10;
const REVEAL_INTERVAL = 3000;
const REVEAL_MAX_POINTS = 10;

const Reveal = ({ onExit, recordResult, category, direction: dir, onViewLeaderboard }) => {
  const [deck] = useState(() => shuffle(STATES).slice(0, REVEAL_COUNT));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState(null);
  const inputRef = useRef(null);

  // Countdown state
  const [countdown, setCountdown] = useState("Ready?");

  useEffect(() => {
    if (countdown === null) return;
    const steps = { "Ready?": "3", "3": "2", "2": "1", "1": "GO!", "GO!": null };
    const delay = countdown === "Ready?" ? 1000 : countdown === "GO!" ? 600 : 800;
    const t = setTimeout(() => setCountdown(steps[countdown]), delay);
    return () => clearTimeout(t);
  }, [countdown]);

  // Per-question reveal state
  const current = deck[Math.min(idx, deck.length - 1)];
  const qa = getQA(current, category, dir);
  const answer = qa.answer;
  const answerLetters = answer.split("");

  // Track which letter indices have been revealed
  const [revealed, setRevealed] = useState([]);
  const [points, setPoints] = useState(REVEAL_MAX_POINTS);

  // Initialize revealed set: pre-reveal spaces, hyphens, dots
  useEffect(() => {
    if (done) return;
    const initial = [];
    answerLetters.forEach((ch, i) => {
      if (ch === " " || ch === "-" || ch === ".") initial.push(i);
    });
    setRevealed(initial);
    setPoints(REVEAL_MAX_POINTS);
    setInput("");
    if (inputRef.current) inputRef.current.focus();
  }, [idx, done]);

  // Reveal timer: reveal one random hidden letter every interval
  useEffect(() => {
    if (countdown !== null || done || flash) return;
    const hiddenIndices = answerLetters
      .map((_, i) => i)
      .filter((i) => !revealed.includes(i));
    if (hiddenIndices.length === 0) {
      // All revealed, score 0, move on
      setFlash("timeout");
      setRevealed(answerLetters.map((_, i) => i));
      recordResult(false);
      statsStore.record(current.s, false, "reveal");
      setTimeout(() => {
        setFlash(null);
        if (idx + 1 >= deck.length) {
          setDone(true);
          ga("reveal_complete", { score, category });
        } else {
          setIdx((i) => i + 1);
        }
      }, 1200);
      return;
    }
    const t = setTimeout(() => {
      const pick = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      setRevealed((r) => [...r, pick]);
      setPoints((p) => Math.max(0, p - 1));
    }, REVEAL_INTERVAL);
    return () => clearTimeout(t);
  }, [revealed, done, flash, idx, countdown]);

  const submit = () => {
    if (countdown !== null || done || flash || !input.trim()) return;
    const right = input.trim().toLowerCase() === answer.toLowerCase();
    if (!right) {
      // Wrong guess — flash "not quite" but keep playing
      setFlash("wrong");
      setInput("");
      setTimeout(() => {
        setFlash(null);
        if (inputRef.current) inputRef.current.focus();
      }, 600);
      return;
    }
    // Correct — reveal all letters, record, advance
    setFlash("right");
    setRevealed(answerLetters.map((_, i) => i));
    recordResult(true);
    statsStore.record(current.s, true, "reveal");
    setScore((s) => s + points);
    setTimeout(() => {
      setFlash(null);
      if (idx + 1 >= deck.length) {
        setDone(true);
        ga("reveal_complete", { score: score + points, category });
      } else {
        setIdx((i) => i + 1);
      }
    }, 800);
  };

  // Leaderboard submission state
  const [posted, setPosted] = useState(false);
  const [posting, setPosting] = useState(false);
  const [rank, setRank] = useState(null);
  const [nickInput, setNickInput] = useState("");
  const [showNickInput, setShowNickInput] = useState(false);
  const [profanityError, setProfanityError] = useState(false);
  const [showNamePicker, setShowNamePicker] = useState(false);

  const handlePost = async (name) => {
    if (posting || posted) return;
    if (filter.check(name)) {
      setProfanityError(true);
      setShowNickInput(true);
      setNickInput(name);
      return;
    }
    setProfanityError(false);
    setPosting(true);
    try {
      leaderboard.setNickname(name);
      await revealLeaderboard.submit(name, score, category);
      const r = await revealLeaderboard.getRank(score, category);
      setRank(r);
      setPosted(true);
      ga("reveal_leaderboard_submit", { score, category, rank: r });
    } catch (e) {
      console.error("Reveal leaderboard submit failed:", e);
    }
    setPosting(false);
  };

  const savedNames = leaderboard.getAllNicknames().filter((n) => !filter.check(n));

  const startPost = () => {
    if (savedNames.length > 0) {
      setShowNamePicker(true);
    } else {
      setShowNickInput(true);
      setNickInput("");
    }
  };

  const catLabel = category === "abbreviations" ? "Abbreviations" : "Capitals";

  if (done) {
    const maxScore = REVEAL_COUNT * REVEAL_MAX_POINTS;
    return (
      <div className="fade-in text-center py-8">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-3"
          style={{ color: "var(--dusty)" }}
        >
          Round Complete
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
          out of {maxScore}
        </div>
        <div
          className="inline-block px-4 py-2 stamp font-mono text-xs"
          style={{ marginBottom: "2rem" }}
        >
          {score >= maxScore
            ? "★ NIFTY FIFTY ★"
            : score >= 80
            ? "★ EXTRAORDINARY ★"
            : score >= 50
            ? "★ SHARP ★"
            : score >= 30
            ? "★ SOLID ★"
            : "★ KEEP GOING ★"}
        </div>

        {score > 0 && (
          <div className="mb-6">
            {posted ? (
              <div className="fade-in">
                <div
                  className="rounded-2xl p-4 mb-2"
                  style={{ background: "rgba(107,142,111,0.12)", border: "2px solid var(--sage)" }}
                >
                  <div
                    className="font-mono text-xs uppercase tracking-widest"
                    style={{ color: "var(--sage)" }}
                  >
                    ✓ Posted to Leaderboard
                  </div>
                  {rank && (
                    <div
                      className="font-display font-bold text-lg mt-1"
                      style={{ color: "var(--ink)" }}
                    >
                      You're #{rank} on {catLabel}
                    </div>
                  )}
                </div>
                <button
                  onClick={onViewLeaderboard}
                  className="w-full rounded-xl py-2.5 font-mono text-xs uppercase tracking-widest transition hover:opacity-70"
                  style={{ color: "var(--ink)", border: "2px solid rgba(26,37,55,0.15)" }}
                >
                  View Leaderboard
                </button>
              </div>
            ) : showNamePicker && savedNames.length > 0 ? (
              <div className="fade-in">
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--paper)", border: "2px solid var(--ink)" }}
                >
                  <div
                    className="font-mono text-[10px] uppercase tracking-widest mb-3"
                    style={{ color: "var(--dusty)" }}
                  >
                    Who's Playing?
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {savedNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => handlePost(name)}
                        disabled={posting}
                        className="rounded-xl px-4 py-2 font-display font-bold text-sm transition active:scale-[0.96]"
                        style={{
                          background: "var(--gold)",
                          color: "var(--ink)",
                          border: "2px solid var(--ink)",
                          boxShadow: "2px 2px 0 var(--ink)",
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setShowNamePicker(false); setShowNickInput(true); setNickInput(""); }}
                    className="font-mono text-[10px] uppercase tracking-widest transition hover:opacity-70"
                    style={{ color: "var(--dusty)" }}
                  >
                    Someone else? →
                  </button>
                </div>
              </div>
            ) : showNickInput ? (
              <div className="fade-in">
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--paper)", border: "2px solid var(--ink)" }}
                >
                  <div
                    className="font-mono text-[10px] uppercase tracking-widest mb-3"
                    style={{ color: "var(--dusty)" }}
                  >
                    Choose a Nickname
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nickInput}
                      onChange={(e) => { setNickInput(e.target.value.slice(0, 15)); setProfanityError(false); }}
                      placeholder="Your name..."
                      autoFocus
                      className="flex-1 rounded-xl px-3 py-2 font-body text-sm outline-none"
                      style={{
                        background: "rgba(26,37,55,0.06)",
                        color: "var(--ink)",
                        border: "2px solid rgba(26,37,55,0.15)",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && nickInput.trim().length >= 3)
                          handlePost(nickInput.trim());
                      }}
                    />
                    <button
                      onClick={() => handlePost(nickInput.trim())}
                      disabled={nickInput.trim().length < 3 || posting}
                      className="rounded-xl px-4 py-2 font-mono text-xs uppercase tracking-widest font-bold transition"
                      style={{
                        background: nickInput.trim().length >= 3 ? "var(--ink)" : "rgba(26,37,55,0.1)",
                        color: nickInput.trim().length >= 3 ? "var(--cream)" : "var(--dusty)",
                      }}
                    >
                      {posting ? "..." : "Post"}
                    </button>
                  </div>
                  {profanityError ? (
                    <div className="font-mono text-[10px] mt-1" style={{ color: "var(--rust)" }}>
                      Please choose an appropriate nickname
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] mt-1" style={{ color: "var(--dusty)" }}>
                      3-15 characters
                    </div>
                  )}
                  {savedNames.length > 0 && (
                    <button
                      onClick={() => { setShowNickInput(false); setShowNamePicker(true); }}
                      className="font-mono text-[10px] uppercase tracking-widest mt-2 transition hover:opacity-70"
                      style={{ color: "var(--dusty)" }}
                    >
                      ← Back to names
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={startPost}
                disabled={posting}
                className="w-full rounded-2xl p-4 font-display font-bold text-lg transition active:scale-[0.98]"
                style={{
                  background: "var(--gold)",
                  color: "var(--ink)",
                  border: "2px solid var(--ink)",
                  boxShadow: "3px 3px 0 var(--ink)",
                }}
              >
                {posting ? "Posting..." : "Post to Leaderboard"}
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => {
              setIdx(0);
              setScore(0);
              setDone(false);
              setCountdown("Ready?");
              setPosted(false);
              setRank(null);
              setShowNickInput(false);
              setShowNamePicker(false);
            }}
            className="w-full rounded-2xl p-4 font-display font-bold text-lg"
            style={{
              background: "var(--rust)",
              color: "var(--cream)",
              border: "2px solid var(--ink)",
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
              border: "2px solid var(--ink)",
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (countdown !== null) {
    const boxStyles = {
      "Ready?": { rotate: "-2deg", borderColor: "var(--ink)", background: "var(--cream)" },
      "3": { rotate: "3deg", borderColor: "var(--ink)", background: "var(--paper)" },
      "2": { rotate: "-4deg", borderColor: "var(--rust)", background: "var(--cream)" },
      "1": { rotate: "2.5deg", borderColor: "var(--gold)", background: "var(--paper)" },
      "GO!": { rotate: "-3deg", borderColor: "var(--rust)", background: "rgba(196,78,71,0.08)" },
    };
    const bs = boxStyles[countdown];
    return (
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div
          key={countdown}
          style={{
            border: `3px solid ${bs.borderColor}`,
            background: bs.background,
            boxShadow: "4px 4px 0 var(--ink)",
            borderRadius: "1rem",
            padding: countdown === "Ready?" ? "1.5rem 2.5rem" : "1rem 2.5rem",
            transform: `rotate(${bs.rotate})`,
            animation: "countdownPop 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            className="font-display font-black text-center"
            style={{
              fontSize: countdown === "Ready?" ? "clamp(2.5rem, 12vw, 4.5rem)" : countdown === "GO!" ? "clamp(4rem, 20vw, 8rem)" : "clamp(5rem, 25vw, 10rem)",
              color: countdown === "GO!" ? "var(--rust)" : "var(--ink)",
              fontVariationSettings: '"SOFT" 100, "WONK" 1',
              fontStyle: countdown === "GO!" ? "italic" : "normal",
              lineHeight: 1,
            }}
          >
            {countdown}
          </div>
        </div>
      </div>
    );
  }

  const darkFlash = flash === "right" || flash === "timeout";
  const flashBg =
    flash === "right" ? "var(--sage)" : flash === "timeout" ? "var(--rust)" : flash === "wrong" ? "rgba(196,78,71,0.15)" : null;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={() => onExit(null)} />
        <div className="flex gap-2 items-center">
          <div
            className="font-mono text-sm px-3 py-1.5 rounded-full font-bold"
            style={{ background: "var(--ink)", color: "var(--cream)" }}
          >
            {idx + 1}/{REVEAL_COUNT}
          </div>
          <div
            className="font-mono text-sm px-3 py-1.5 rounded-full font-bold"
            style={{ background: "var(--gold)", color: "var(--ink)" }}
          >
            {score}
          </div>
        </div>
      </div>

      {/* Points remaining for this question */}
      <div className="text-center mb-2">
        <div
          className="inline-block font-mono text-xs font-bold px-3 py-1 rounded-full"
          style={{
            background: points >= 7 ? "var(--gold)" : points >= 4 ? "rgba(217,164,65,0.3)" : "rgba(196,78,71,0.15)",
            color: points >= 7 ? "var(--ink)" : points >= 4 ? "var(--ink)" : "var(--rust)",
          }}
        >
          {points} {points === 1 ? "point" : "points"}
        </div>
      </div>

      {/* Question */}
      <div
        className="text-center mb-6 transition-colors duration-200 rounded-2xl py-6 px-4"
        style={{ background: flashBg || "transparent" }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-2"
          style={{ color: darkFlash ? "var(--cream)" : "var(--dusty)" }}
        >
          {qa.qLabel}
        </div>
        <div
          className="font-display font-black leading-tight mb-6"
          style={{
            fontSize: "clamp(1.8rem, 8vw, 2.8rem)",
            color: darkFlash ? "var(--cream)" : "var(--ink)",
          }}
        >
          {qa.question}
        </div>

        {/* Letter blanks */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-6">
          {(() => {
            // Group letters into words so words don't break across lines
            const words = [];
            let wordStart = 0;
            answerLetters.forEach((ch, i) => {
              if (ch === " ") {
                if (i > wordStart) words.push({ start: wordStart, end: i });
                words.push({ start: i, end: i + 1, isSpace: true });
                wordStart = i + 1;
              }
            });
            if (wordStart < answerLetters.length) words.push({ start: wordStart, end: answerLetters.length });

            return words.map((word, wi) => {
              if (word.isSpace) return <div key={`sp-${wi}`} style={{ width: "0.75rem" }} />;
              return (
                <span key={`w-${wi}`} className="inline-flex gap-1.5" style={{ flexWrap: "nowrap" }}>
                  {answerLetters.slice(word.start, word.end).map((ch, j) => {
                    const i = word.start + j;
                    const isRevealed = revealed.includes(i);
                    return (
                      <div
                        key={i}
                        className={`font-display font-bold text-lg flex items-center justify-center rounded-lg ${isRevealed && ![".", "-"].includes(ch) ? "pop" : ""}`}
                        style={{
                          width: "2rem",
                          height: "2.5rem",
                          background: isRevealed
                            ? darkFlash ? "rgba(255,255,255,0.2)" : "rgba(26,37,55,0.08)"
                            : darkFlash ? "rgba(255,255,255,0.1)" : "rgba(26,37,55,0.04)",
                          border: `2px solid ${isRevealed
                            ? darkFlash ? "rgba(255,255,255,0.3)" : "rgba(26,37,55,0.2)"
                            : darkFlash ? "rgba(255,255,255,0.15)" : "rgba(26,37,55,0.1)"}`,
                          color: darkFlash ? "var(--cream)" : "var(--ink)",
                        }}
                      >
                        {isRevealed ? ch.toUpperCase() : ""}
                      </div>
                    );
                  })}
                </span>
              );
            });
          })()}
        </div>

        {/* Flash feedback text */}
        {flash === "right" && (
          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--cream)" }}>
            +{points} points!
          </div>
        )}
        {flash === "wrong" && (
          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--rust)" }}>
            Not quite!
          </div>
        )}
        {flash === "timeout" && (
          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--cream)" }}>
            {answer}
          </div>
        )}
      </div>

      {/* Input */}
      {(!flash || flash === "wrong") && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Type the ${qa.aLabel.toLowerCase()}...`}
            autoFocus
            className="flex-1 rounded-xl px-4 py-3 font-body text-base outline-none"
            style={{
              background: "var(--paper)",
              color: "var(--ink)",
              border: "2px solid var(--ink)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <button
            onClick={submit}
            disabled={!input.trim()}
            className="rounded-xl px-5 py-3 font-mono text-xs uppercase tracking-widest font-bold transition"
            style={{
              background: input.trim() ? "var(--ink)" : "rgba(26,37,55,0.1)",
              color: input.trim() ? "var(--cream)" : "var(--dusty)",
            }}
          >
            Go
          </button>
        </div>
      )}
    </div>
  );
};

// ─── LEADERBOARD ────────────────────────────────────────────────────────
const timeAgo = (timestamp) => {
  if (!timestamp) return "";
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const PAGE_SIZE = 20;

const Leaderboard = ({ onBack }) => {
  const [mode, setMode] = useState("dash"); // dash | reveal
  const [cat, setCat] = useState("capitals");
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [nickname, setNickname] = useState(() => leaderboard.getNickname());
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState(nickname);
  const [nickError, setNickError] = useState(false);

  const lb = mode === "reveal" ? revealLeaderboard : leaderboard;
  const perfectScore = mode === "reveal" ? 100 : 50;

  const fetchScores = useCallback(async (category, board) => {
    setLoading(true);
    try {
      const { entries, lastDoc: last } = await board.getTop(category, PAGE_SIZE);
      setScores(entries);
      setLastDoc(last);
      setHasMore(entries.length === PAGE_SIZE);
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
      setScores([]);
      setLastDoc(null);
      setHasMore(false);
    }
    setLoading(false);
  }, []);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const { entries, lastDoc: last } = await lb.getTop(cat, PAGE_SIZE, lastDoc);
      setScores((prev) => [...prev, ...entries]);
      setLastDoc(last);
      setHasMore(entries.length === PAGE_SIZE);
    } catch (e) {
      console.error("Failed to load more:", e);
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchScores(cat, lb);
  }, [cat, mode, fetchScores]);

  const saveNickname = () => {
    const name = nickInput.trim();
    if (name.length < 3) return;
    if (filter.check(name)) {
      setNickError(true);
      return;
    }
    setNickError(false);
    leaderboard.setNickname(name);
    setNickname(name);
    setEditingNick(false);
  };

  const rankColor = (i) => {
    if (i === 0) return "var(--gold)";
    if (i === 1) return "var(--dusty)";
    if (i === 2) return "var(--rust)";
    return "var(--ink)";
  };

  return (
    <div className="slide-up">
      <div className="flex items-center justify-between mb-6">
        <BackBtn onClick={onBack} />
        <div
          className="font-mono text-xs px-3 py-1.5 rounded-full font-bold"
          style={{ background: "var(--ink)", color: "var(--cream)" }}
        >
          Leaderboard
        </div>
      </div>

      <div className="text-center mb-4">
        <h2
          className="font-display font-black text-3xl leading-tight mb-1"
          style={{ color: "var(--ink)", fontVariationSettings: '"SOFT" 100, "WONK" 1' }}
        >
          {mode === "dash" ? "60-Second Dash" : "Letter by Letter"}
        </h2>
        <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--dusty)" }}>
          Top scores
        </div>
      </div>

      {/* Game mode tabs */}
      <div
        className="flex rounded-full mb-4 overflow-hidden"
        style={{ border: "2px solid var(--ink)" }}
      >
        {[
          { id: "dash", label: "Dash" },
          { id: "reveal", label: "Letter" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className="flex-1 py-2 font-mono text-xs uppercase tracking-widest transition-colors"
            style={{
              background: mode === tab.id ? "var(--ink)" : "transparent",
              color: mode === tab.id ? "var(--cream)" : "var(--ink)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div
        className="flex rounded-full mb-6 overflow-hidden"
        style={{ border: "2px solid var(--ink)" }}
      >
        {[
          { id: "capitals", label: "Capitals" },
          { id: "abbreviations", label: "Abbreviations" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCat(tab.id)}
            className="flex-1 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors"
            style={{
              background: cat === tab.id ? "var(--ink)" : "transparent",
              color: cat === tab.id ? "var(--cream)" : "var(--ink)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scores list */}
      {loading ? (
        <div className="text-center py-12">
          <div
            className="font-mono text-xs uppercase tracking-widest"
            style={{ color: "var(--dusty)" }}
          >
            Loading...
          </div>
        </div>
      ) : scores.length === 0 ? (
        <div className="text-center py-12">
          <div
            className="font-display text-4xl mb-3"
            style={{ color: "var(--dusty)", opacity: 0.3 }}
          >
            🏆
          </div>
          <div
            className="font-display font-bold text-lg mb-1"
            style={{ color: "var(--ink)" }}
          >
            No scores yet
          </div>
          <div
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--dusty)" }}
          >
            Be the first! Play {mode === "dash" ? "60-Second Dash" : "Letter by Letter"}.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {scores.map((entry, i) => {
            const isYou = nickname && entry.name === nickname;
            const isPerfect = entry.score >= perfectScore;
            return (
              <div
                key={entry.id}
                className="rounded-xl p-3 flex items-center gap-3 transition"
                style={{
                  background: isPerfect ? "rgba(217,164,65,0.12)" : isYou ? "rgba(217,164,65,0.1)" : "var(--paper)",
                  border: `2px solid ${isPerfect ? "var(--gold)" : isYou ? "var(--gold)" : "rgba(26,37,55,0.1)"}`,
                  boxShadow: isPerfect ? "3px 3px 0 rgba(217,164,65,0.3)" : "none",
                }}
              >
                <div
                  className="font-mono text-sm font-bold w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: i < 3 ? rankColor(i) : "rgba(26,37,55,0.08)",
                    color: i < 3 ? "var(--cream)" : "var(--ink)",
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-display font-bold text-sm truncate"
                    style={{ color: "var(--ink)" }}
                  >
                    {entry.name}
                    {isYou && (
                      <span
                        className="font-mono text-[10px] uppercase tracking-widest ml-2"
                        style={{ color: "var(--gold)" }}
                      >
                        you
                      </span>
                    )}
                  </div>
                  <div
                    className="font-mono text-[10px] uppercase tracking-widest"
                    style={{ color: "var(--dusty)" }}
                  >
                    {timeAgo(entry.timestamp)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isPerfect && (
                    <div
                      className="font-mono text-[8px] uppercase tracking-widest font-bold px-2 py-1 rounded stamp"
                      style={{
                        color: "var(--gold)",
                        border: "1.5px solid var(--gold)",
                        transform: "rotate(-4deg)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Nifty Fifty
                    </div>
                  )}
                  <div
                    className="font-display font-black text-2xl"
                    style={{ color: isPerfect ? "var(--gold)" : rankColor(i) }}
                  >
                    {entry.score}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {hasMore && !loading && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full mt-4 py-3 rounded-2xl font-mono text-xs uppercase tracking-widest transition hover:opacity-80"
          style={{
            background: "rgba(26,37,55,0.05)",
            color: "var(--ink)",
            border: "2px solid rgba(26,37,55,0.12)",
          }}
        >
          {loadingMore ? "Loading..." : "Load More"}
        </button>
      )}

      {/* Nickname management */}
      <div className="mt-6 text-center">
        {editingNick ? (
          <>
            <div className="flex gap-2 justify-center">
              <input
                type="text"
                value={nickInput}
                onChange={(e) => { setNickInput(e.target.value.slice(0, 15)); setNickError(false); }}
                autoFocus
                className="rounded-xl px-3 py-2 font-body text-sm outline-none w-40"
                style={{
                  background: "rgba(26,37,55,0.06)",
                  color: "var(--ink)",
                  border: "2px solid rgba(26,37,55,0.15)",
                }}
                onKeyDown={(e) => e.key === "Enter" && saveNickname()}
              />
              <button
                onClick={saveNickname}
                disabled={nickInput.trim().length < 3}
                className="rounded-xl px-3 py-2 font-mono text-xs uppercase tracking-widest"
                style={{
                  background: "var(--ink)",
                  color: "var(--cream)",
                }}
              >
                Save
              </button>
              <button
                onClick={() => { setEditingNick(false); setNickInput(nickname); setNickError(false); }}
                className="rounded-xl px-3 py-2 font-mono text-xs uppercase tracking-widest"
                style={{ color: "var(--ink)", border: "2px solid rgba(26,37,55,0.15)" }}
              >
                Cancel
              </button>
            </div>
            {nickError && (
              <div className="font-mono text-[10px] mt-1" style={{ color: "var(--rust)" }}>
                Please choose an appropriate nickname
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => setEditingNick(true)}
            className="font-mono text-[10px] uppercase tracking-widest transition hover:opacity-70"
            style={{ color: "var(--dusty)" }}
          >
            {nickname ? `Playing as "${nickname}" · Edit` : "Set Nickname"}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── PROGRESS MAP ───────────────────────────────────────────────────────

// Abbreviation to state name lookup
const ABBR_TO_STATE = {};
STATES.forEach(({ s, a }) => { ABBR_TO_STATE[a] = s; });

const CONFIDENCE_TIERS = [
  { label: "Solid", color: "#4A7A4F", check: (s, c) => s === "know" && c >= 0.8 },
  { label: "Shaky", color: "#8DB891", check: (s, c) => s === "know" && c < 0.8 },
  { label: "Getting There", color: "#D4836A", check: (s, c) => s === "dontknow" && c >= 0.3 },
  { label: "Weak", color: "#C14A33", check: (s, c) => s === "dontknow" && c < 0.3 },
  { label: "Not Tested", color: "#DDD4BE", check: (s, c) => s === null },
];

const getStateColor = (stateName) => {
  const status = statsStore.getStatus(stateName);
  const confidence = statsStore.getConfidence(stateName);
  for (const tier of CONFIDENCE_TIERS) {
    if (tier.check(status, confidence)) return tier.color;
  }
  return "#DDD4BE";
};

const relativeTime = (ts) => {
  if (!ts) return "Never";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const getStateTier = (stateName) => {
  const status = statsStore.getStatus(stateName);
  const confidence = statsStore.getConfidence(stateName);
  return CONFIDENCE_TIERS.find((t) => t.check(status, confidence)) || CONFIDENCE_TIERS[4];
};

const ProgressMap = ({ onBack, onPractice }) => {
  const [selected, setSelected] = useState(null);
  const [selectedTiers, setSelectedTiers] = useState(new Set());
  const [svgLoaded, setSvgLoaded] = useState(false);
  const mapRef = useRef(null);

  const toggleTier = (label) => {
    setSelectedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Compute subset of states matching selected tiers
  const practiceSubset = selectedTiers.size > 0
    ? STATES.filter((st) => selectedTiers.has(getStateTier(st.s).label))
    : [];

  // Fetch and inject the SVG map
  useEffect(() => {
    let cancelled = false;
    fetch("/us-map.svg")
      .then((r) => r.text())
      .then((svgText) => {
        if (cancelled || !mapRef.current) return;
        // Parse the SVG
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) return;

        // Clean up and style the SVG
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.display = "block";

        // Color each state path and add click handlers
        const validAbbrs = new Set(STATES.map((st) => st.a));
        svg.querySelectorAll("path[id]").forEach((path) => {
          const abbr = path.getAttribute("id");
          if (!validAbbrs.has(abbr)) return;
          const stateName = ABBR_TO_STATE[abbr];
          if (!stateName) return;
          path.style.fill = getStateColor(stateName);
          path.style.stroke = "rgba(26,37,55,0.3)";
          path.style.strokeWidth = "0.8";
          path.style.cursor = "pointer";
          path.style.transition = "fill 0.2s, stroke-width 0.2s";
        });

        mapRef.current.innerHTML = "";
        mapRef.current.appendChild(svg);
        setSvgLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Update colors, selection highlight, and tier dimming
  useEffect(() => {
    if (!mapRef.current || !svgLoaded) return;
    const svg = mapRef.current.querySelector("svg");
    if (!svg) return;
    const validAbbrs = new Set(STATES.map((st) => st.a));
    const hasTierFilter = selectedTiers.size > 0;

    svg.querySelectorAll("path[id]").forEach((path) => {
      const abbr = path.getAttribute("id");
      if (!validAbbrs.has(abbr)) return;
      const stateName = ABBR_TO_STATE[abbr];
      if (!stateName) return;
      const tier = getStateTier(stateName);
      const dimmed = hasTierFilter && !selectedTiers.has(tier.label);
      path.style.fill = dimmed ? "#E8E4DC" : getStateColor(stateName);
      path.style.opacity = dimmed ? "0.4" : "1";
      const isSelected = selected === abbr;
      path.style.stroke = isSelected ? "var(--ink)" : "rgba(26,37,55,0.3)";
      path.style.strokeWidth = isSelected ? "2.5" : "0.8";
    });
  }, [selected, svgLoaded, selectedTiers]);

  // Attach click handlers (separate effect to avoid stale closure)
  useEffect(() => {
    if (!mapRef.current || !svgLoaded) return;
    const svg = mapRef.current.querySelector("svg");
    if (!svg) return;
    const validAbbrs = new Set(STATES.map((st) => st.a));

    const handlers = [];
    svg.querySelectorAll("path[id]").forEach((path) => {
      const abbr = path.getAttribute("id");
      if (!validAbbrs.has(abbr)) return;
      const handler = () => setSelected((prev) => prev === abbr ? null : abbr);
      path.addEventListener("click", handler);
      handlers.push({ path, handler });
    });

    return () => {
      handlers.forEach(({ path, handler }) => path.removeEventListener("click", handler));
    };
  }, [svgLoaded]);

  // Summary counts
  const allStats = statsStore.getAllStats();
  let tested = 0, know = 0, dontKnow = 0;
  STATES.forEach(({ s }) => {
    const status = statsStore.getStatus(s);
    if (status === "know") { tested++; know++; }
    else if (status === "dontknow") { tested++; dontKnow++; }
  });
  const unseen = 50 - tested;

  const selectedState = selected ? STATES.find((st) => st.a === selected) : null;
  const selectedStats = selectedState ? allStats[selectedState.s] : null;
  const selectedHistory = selectedState ? statsStore.getHistory(selectedState.s) : [];

  return (
    <div style={{ animation: "fadeIn 0.35s ease-out" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm transition hover:opacity-70"
          style={{ background: "rgba(26,37,55,0.08)", color: "var(--ink)" }}
        >
          ←
        </button>
        <h2 className="font-display font-black text-2xl" style={{ color: "var(--ink)" }}>
          My Progress
        </h2>
      </div>

      {/* Summary strip */}
      <div
        className="rounded-2xl px-4 py-3 mb-5 font-mono text-xs flex flex-wrap gap-x-4 gap-y-1 justify-center"
        style={{ background: "rgba(26,37,55,0.06)", color: "var(--ink)" }}
      >
        <span><strong>{tested}</strong>/50 tested</span>
        <span style={{ color: "#4A7A4F" }}><strong>{know}</strong> know</span>
        <span style={{ color: "#C14A33" }}><strong>{dontKnow}</strong> don't know</span>
        <span style={{ opacity: 0.5 }}><strong>{unseen}</strong> unseen</span>
      </div>

      {/* SVG Map */}
      <div
        ref={mapRef}
        className="relative w-full mb-4"
        style={{ minHeight: 200 }}
      />

      {/* Legend — tappable tier pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-4 font-mono text-[10px] uppercase tracking-wider">
        {CONFIDENCE_TIERS.map((tier) => {
          const active = selectedTiers.has(tier.label);
          return (
            <button
              key={tier.label}
              onClick={() => toggleTier(tier.label)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition"
              style={{
                background: active ? `${tier.color}25` : "rgba(26,37,55,0.04)",
                color: active ? tier.color : "var(--ink)",
                border: `2px solid ${active ? tier.color : "rgba(26,37,55,0.1)"}`,
                fontWeight: active ? 700 : 400,
              }}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: tier.color }}
              />
              {tier.label}
            </button>
          );
        })}
      </div>

      {/* Practice bar */}
      {practiceSubset.length > 0 && (
        <div
          className="rounded-2xl px-4 py-4 mb-4"
          style={{
            background: "rgba(26,37,55,0.06)",
            border: "2px solid rgba(26,37,55,0.1)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            className="font-mono text-xs mb-3 text-center"
            style={{ color: "var(--ink)" }}
          >
            <strong>{practiceSubset.length}</strong> state{practiceSubset.length !== 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPractice(practiceSubset, "quiz")}
              className="flex-1 rounded-xl py-2.5 font-display font-bold text-sm transition active:scale-[0.96]"
              style={{
                background: "var(--rust)",
                color: "var(--cream)",
                border: "2px solid var(--ink)",
                boxShadow: "2px 2px 0 var(--ink)",
              }}
            >
              Quiz
            </button>
            <button
              onClick={() => onPractice(practiceSubset, "study")}
              className="flex-1 rounded-xl py-2.5 font-display font-bold text-sm transition active:scale-[0.96]"
              style={{
                background: "var(--gold)",
                color: "var(--ink)",
                border: "2px solid var(--ink)",
                boxShadow: "2px 2px 0 var(--ink)",
              }}
            >
              Flashcards
            </button>
            <button
              onClick={() => onPractice(practiceSubset, "type")}
              className="flex-1 rounded-xl py-2.5 font-display font-bold text-sm transition active:scale-[0.96]"
              style={{
                background: "var(--sage)",
                color: "var(--cream)",
                border: "2px solid var(--ink)",
                boxShadow: "2px 2px 0 var(--ink)",
              }}
            >
              Type It
            </button>
          </div>
        </div>
      )}

      {/* Detail card */}
      {selectedState && (
        <div
          className="rounded-2xl p-5 mt-2"
          style={{
            background: "rgba(26,37,55,0.06)",
            border: "2px solid rgba(26,37,55,0.1)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-display font-black text-lg" style={{ color: "var(--ink)" }}>
                {selectedState.s}
              </h3>
              <div className="font-mono text-xs opacity-60">
                {selectedState.c} · {selectedState.a}
              </div>
            </div>
            {/* Status badge */}
            <span
              className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full font-bold"
              style={{
                background: statsStore.getStatus(selectedState.s) === "know"
                  ? "rgba(74,122,79,0.15)" : statsStore.getStatus(selectedState.s) === "dontknow"
                  ? "rgba(193,74,51,0.15)" : "rgba(26,37,55,0.08)",
                color: statsStore.getStatus(selectedState.s) === "know"
                  ? "#4A7A4F" : statsStore.getStatus(selectedState.s) === "dontknow"
                  ? "#C14A33" : "var(--ink)",
              }}
            >
              {statsStore.getStatus(selectedState.s) === "know" ? "Know" : statsStore.getStatus(selectedState.s) === "dontknow" ? "Don't Know" : "Not Tested"}
            </span>
          </div>

          {selectedStats && (selectedStats.correct > 0 || selectedStats.wrong > 0) ? (
            <>
              {/* Accuracy */}
              <div className="font-mono text-xs mb-2" style={{ color: "var(--ink)" }}>
                {selectedStats.correct} correct, {selectedStats.wrong} wrong
                {(selectedStats.correct + selectedStats.wrong) > 0 && (
                  <span className="opacity-60">
                    {" "}({Math.round(selectedStats.correct / (selectedStats.correct + selectedStats.wrong) * 100)}%)
                  </span>
                )}
              </div>

              {/* Last seen */}
              <div className="font-mono text-[10px] opacity-50 mb-3">
                Last seen: {relativeTime(selectedStats.lastSeen)}
              </div>

              {/* Recent trend */}
              {selectedHistory.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider opacity-50 mr-2">Recent:</span>
                  {selectedHistory.slice(0, 5).map((h, i) => (
                    <span
                      key={i}
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: h.r ? "#4A7A4F" : "#C14A33" }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="font-mono text-xs opacity-40">
              No data yet — play some rounds!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── SPLASH SCREEN ──────────────────────────────────────────────────────
const Splash = ({ onDone }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 2200);
    const t2 = setTimeout(onDone, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center transition-opacity duration-500"
      style={{
        background: "var(--ink)",
        opacity: fading ? 0 : 1,
      }}
    >
      <div
        className="text-center"
        style={{ animation: "fadeIn 0.8s ease-out" }}
      >
        <h1
          className="font-display font-black leading-[0.9] mb-4"
          style={{
            fontSize: "clamp(3rem, 14vw, 5.5rem)",
            color: "var(--cream)",
            fontVariationSettings: '"SOFT" 80, "WONK" 1',
          }}
        >
          Nifty<br />
          <span
            style={{
              color: "var(--rust)",
              fontStyle: "italic",
              fontVariationSettings: '"SOFT" 100, "WONK" 1',
            }}
          >
            Fifty
          </span>
        </h1>
        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] mb-8"
          style={{ color: "var(--gold)", opacity: 0.8 }}
        >
          ★ A Geography Game ★
        </div>
        <div
          style={{
            width: 40,
            height: 1,
            background: "var(--dusty)",
            margin: "0 auto 16px",
            opacity: 0.4,
          }}
        />
        <div
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--dusty)", opacity: 0.6 }}
        >
          brought to you by
        </div>
        <div
          className="font-body text-sm font-semibold mt-1"
          style={{ color: "var(--cream)", opacity: 0.8 }}
        >
          Franzke Technologies
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("splash"); // splash | home | quiz | type | speed | study | matchConfig | match | results
  const [lastMode, setLastMode] = useState(null);
  const [result, setResult] = useState(null);
  const [category, setCategory] = useState("capitals"); // capitals | abbreviations
  const [direction, setDirection] = useState("forward"); // forward | reverse
  const [matchConfig, setMatchConfig] = useState(null);
  const [matchKey, setMatchKey] = useState(0);
  const [escapeConfig, setEscapeConfig] = useState(null);
  const [escapeKey, setEscapeKey] = useState(0);
  const [progressSubset, setProgressSubset] = useState(null);
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

  const handleProgressExit = (mode) => () => {
    setProgressSubset(null);
    setScreen("progress");
  };

  const handlePractice = (subset, mode) => {
    setProgressSubset(subset);
    setScreen(mode === "study" ? "study" : mode);
  };

  const modeProps = { category, direction };

  if (screen === "splash") {
    return (
      <div className="font-body" style={{ color: "var(--ink)" }}>
        <GlobalStyles />
        <Splash onDone={() => setScreen("home")} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen paper-texture grain relative font-body"
      style={{ color: "var(--ink)" }}
    >
      <GlobalStyles />
      <div className="max-w-lg mx-auto px-5 pt-14 pb-8 relative">
        {screen === "home" && (
          <Home
            stats={stats}
            category={category}
            setCategory={setCategory}
            direction={direction}
            setDirection={setDirection}
            onPick={(id) => {
              if (["quiz", "type", "speed", "study", "match", "escape", "reveal"].includes(id)) {
                ga("game_mode_start", { mode: id, category, direction });
              }
              if (id === "quiz") setScreen("quiz");
              if (id === "type") setScreen("type");
              if (id === "speed") setScreen("speed");
              if (id === "study") setScreen("study");
              if (id === "match") setScreen("matchConfig");
              if (id === "escape") setScreen("escapeConfig");
              if (id === "reveal") setScreen("reveal");
              if (id === "leaderboard") setScreen("leaderboard");
              if (id === "progress") setScreen("progress");
            }}
          />
        )}
        {screen === "quiz" && (
          <Quiz
            onExit={progressSubset ? handleProgressExit("quiz") : handleExit("quiz")}
            recordResult={recordResult}
            subset={progressSubset}
            {...modeProps}
          />
        )}
        {screen === "type" && (
          <TypeIt
            onExit={progressSubset ? handleProgressExit("type") : handleExit("type")}
            recordResult={recordResult}
            subset={progressSubset}
            {...modeProps}
          />
        )}
        {screen === "speed" && (
          <Speed onExit={handleExit("speed")} recordResult={recordResult} onViewLeaderboard={() => setScreen("leaderboard")} {...modeProps} />
        )}
        {screen === "reveal" && (
          <Reveal onExit={handleExit("reveal")} recordResult={recordResult} onViewLeaderboard={() => setScreen("leaderboard")} {...modeProps} />
        )}
        {screen === "study" && (
          <Study
            onExit={progressSubset ? handleProgressExit("study") : handleExit("study")}
            subset={progressSubset}
            {...modeProps}
          />
        )}
        {screen === "matchConfig" && (
          <MatchConfig
            category={category}
            onBack={goHome}
            onStart={(cfg) => {
              setMatchConfig(cfg);
              setMatchKey((k) => k + 1);
              setScreen("match");
            }}
          />
        )}
        {screen === "match" && matchConfig && (
          <MatchGame
            key={matchKey}
            config={matchConfig}
            category={category}
            onExit={(action) => {
              if (action === "restart") setMatchKey((k) => k + 1);
              else if (action === "config") setScreen("matchConfig");
              else goHome();
            }}
          />
        )}
        {screen === "escapeConfig" && (
          <EscapeConfig
            category={category}
            direction={direction}
            onBack={goHome}
            onStart={(cfg) => {
              setEscapeConfig(cfg);
              setEscapeKey((k) => k + 1);
              setScreen("escape");
            }}
          />
        )}
        {screen === "escape" && escapeConfig && (
          <EscapeGame
            key={escapeKey}
            config={escapeConfig}
            category={category}
            direction={direction}
            onExit={(action) => {
              if (action === "restart") setEscapeKey((k) => k + 1);
              else if (action === "config") setScreen("escapeConfig");
              else goHome();
            }}
          />
        )}
        {screen === "progress" && <ProgressMap onBack={goHome} onPractice={handlePractice} />}
        {screen === "leaderboard" && <Leaderboard onBack={goHome} />}
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

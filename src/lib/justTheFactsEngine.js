// Just the Facts — pure game engine.
// No DOM, no React, no storage. Every function takes stats in and returns
// new values out; randomness is injected so tests can seed it.

export const FAST_MS = 3000;
export const TIMEOUT_MS = 6000;
export const ROUND_SIZE = 20;
export const DRILL_SIZE = 10;
export const WRONG_HOLD_MS = 1200;
export const EMA_ALPHA = 0.3;
export const FAST_STREAK = 3;
export const STRUGGLING_RATE = 0.6;
export const PREV_ROUND_DAMPING = 0.5;
export const WEIGHTS = { struggling: 8, unseen: 5, slow: 3, fast: 1 };

export const MIN_FACTOR = 1;
export const MAX_FACTOR = 12;

export function factKey(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}×${hi}`;
}

function buildFacts() {
  const facts = [];
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    for (let b = a; b <= MAX_FACTOR; b++) {
      facts.push({ a, b, key: factKey(a, b), answer: a * b });
    }
  }
  return facts;
}

export const ALL_FACTS = Object.freeze(buildFacts());
const FACT_BY_KEY = new Map(ALL_FACTS.map((f) => [f.key, f]));

export function getFact(key) {
  return FACT_BY_KEY.get(key) || null;
}

export function emptyStats() {
  return { roundNumber: 0, sound: false, facts: {} };
}

const ZERO_RECORD = Object.freeze({
  attempts: 0,
  correct: 0,
  fastCorrect: 0,
  avgMs: null,
  lastRound: null,
  streak: 0,
  lastResult: null,
});

export function getRecord(stats, key) {
  return (stats && stats.facts && stats.facts[key]) || ZERO_RECORD;
}

export function classify(record) {
  if (!record || record.attempts === 0) return "unseen";
  if (record.lastResult === "wrong") return "struggling";
  if (record.correct / record.attempts < STRUGGLING_RATE) return "struggling";
  if (record.streak >= FAST_STREAK) return "fast";
  return "slow";
}

export function weightFor(record, roundNumber) {
  let w = WEIGHTS[classify(record)];
  if (record && record.lastRound !== null && record.lastRound === roundNumber - 1) {
    w *= PREV_ROUND_DAMPING;
  }
  return w;
}

// ─── Sampling ───────────────────────────────────────────────────────

function weightedDraw(items, weights, random) {
  let total = 0;
  for (const w of weights) total += w;
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return items.length - 1;
}

function withDisplay(fact, random) {
  const flip = random() < 0.5;
  return { ...fact, display: flip ? [fact.b, fact.a] : [fact.a, fact.b] };
}

export function sampleRound(stats, count = ROUND_SIZE, random = Math.random) {
  const roundNumber = (stats && stats.roundNumber) || 0;
  const nextRound = roundNumber + 1;

  const nonFast = [];
  const fast = [];
  for (const fact of ALL_FACTS) {
    const record = getRecord(stats, fact.key);
    const entry = { fact, weight: weightFor(record, nextRound) };
    if (classify(record) === "fast") fast.push(entry);
    else nonFast.push(entry);
  }

  const picked = [];
  const drawFrom = (pool) => {
    while (pool.length > 0 && picked.length < count) {
      const idx = weightedDraw(pool, pool.map((e) => e.weight), random);
      picked.push(withDisplay(pool[idx].fact, random));
      pool.splice(idx, 1);
    }
  };

  drawFrom(nonFast);
  drawFrom(fast);
  return picked;
}

export function drillRound(stats, key, count = DRILL_SIZE, random = Math.random) {
  const target = getFact(key);
  if (!target) return [];

  const family = ALL_FACTS.filter(
    (f) =>
      f.key !== key &&
      (f.a === target.a || f.b === target.a || f.a === target.b || f.b === target.b)
  );
  shuffle(family, random);

  const picked = [target, ...family.slice(0, Math.max(0, count - 1))];
  shuffle(picked, random);
  return picked.map((f) => withDisplay(f, random));
}

function shuffle(arr, random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Grading ────────────────────────────────────────────────────────

export function checkTyped(answer, typed) {
  const target = String(answer);
  const t = String(typed || "");
  if (t === target) return "match";
  if (t.length < target.length && target.startsWith(t)) return "prefix";
  return "wrong";
}

export function gradeAnswer(elapsedMs, typedResult) {
  if (typedResult === "wrong") return "wrong";
  if (elapsedMs >= TIMEOUT_MS) return "wrong";
  if (elapsedMs <= FAST_MS) return "fast";
  return "slow";
}

export function summarizeRound(results) {
  const summary = { fastCount: 0, slowCount: 0, wrongCount: 0, totalMs: 0 };
  for (const r of results) {
    if (r.grade === "fast") summary.fastCount++;
    else if (r.grade === "slow") summary.slowCount++;
    else summary.wrongCount++;
    summary.totalMs += r.elapsedMs || 0;
  }
  return summary;
}

// ─── Applying results ───────────────────────────────────────────────

export function applyRound(stats, results, roundNumber) {
  const facts = { ...((stats && stats.facts) || {}) };
  const newlyFast = [];

  for (const r of results) {
    const prev = facts[r.key] || ZERO_RECORD;
    const wasFast = classify(prev) === "fast";
    const isCorrect = r.grade !== "wrong";
    const isFast = r.grade === "fast";

    let avgMs = prev.avgMs;
    if (isCorrect) {
      avgMs = avgMs === null ? r.elapsedMs : EMA_ALPHA * r.elapsedMs + (1 - EMA_ALPHA) * avgMs;
    }

    const next = {
      attempts: prev.attempts + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      fastCorrect: prev.fastCorrect + (isFast ? 1 : 0),
      avgMs,
      lastRound: roundNumber,
      streak: isFast ? prev.streak + 1 : 0,
      lastResult: r.grade,
    };
    facts[r.key] = next;

    if (!wasFast && classify(next) === "fast" && !newlyFast.includes(r.key)) {
      newlyFast.push(r.key);
    }
  }

  return {
    stats: { ...stats, roundNumber, facts },
    newlyFast,
  };
}

export function countByClass(stats) {
  const counts = { unseen: 0, struggling: 0, slow: 0, fast: 0 };
  for (const fact of ALL_FACTS) {
    counts[classify(getRecord(stats, fact.key))]++;
  }
  return counts;
}

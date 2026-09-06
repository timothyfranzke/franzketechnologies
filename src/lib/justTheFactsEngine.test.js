import { describe, it, expect } from "vitest";
import {
  ALL_FACTS,
  FAST_MS,
  TIMEOUT_MS,
  WEIGHTS,
  factKey,
  emptyStats,
  getRecord,
  classify,
  weightFor,
  sampleRound,
  drillRound,
  checkTyped,
  gradeAnswer,
  summarizeRound,
  applyRound,
  countByClass,
} from "./justTheFactsEngine.js";

// Deterministic LCG so sampling tests are repeatable.
function seeded(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function record(overrides) {
  return {
    attempts: 0,
    correct: 0,
    fastCorrect: 0,
    avgMs: null,
    lastRound: null,
    streak: 0,
    lastResult: null,
    ...overrides,
  };
}

function statsWith(entries, roundNumber = 0) {
  const stats = emptyStats();
  stats.roundNumber = roundNumber;
  for (const [key, rec] of Object.entries(entries)) stats.facts[key] = record(rec);
  return stats;
}

const FAST = { attempts: 5, correct: 5, fastCorrect: 5, avgMs: 1500, streak: 3, lastResult: "fast" };
const STRUGGLING = { attempts: 4, correct: 1, avgMs: 4000, streak: 0, lastResult: "wrong" };

function allFastStats() {
  const entries = {};
  for (const f of ALL_FACTS) entries[f.key] = FAST;
  return statsWith(entries);
}

// ─── Facts ──────────────────────────────────────────────────────────

describe("ALL_FACTS", () => {
  it("has 78 canonical facts with unique keys", () => {
    expect(ALL_FACTS).toHaveLength(78);
    expect(new Set(ALL_FACTS.map((f) => f.key)).size).toBe(78);
    for (const f of ALL_FACTS) {
      expect(f.a).toBeLessThanOrEqual(f.b);
      expect(f.answer).toBe(f.a * f.b);
    }
  });

  it("factKey is order independent", () => {
    expect(factKey(8, 7)).toBe(factKey(7, 8));
    expect(factKey(7, 8)).toBe("7×8");
  });
});

// ─── classify ───────────────────────────────────────────────────────

describe("classify", () => {
  it("unseen with no attempts", () => {
    expect(classify(getRecord(emptyStats(), "7×8"))).toBe("unseen");
  });

  it("struggling when the last answer was wrong", () => {
    expect(classify(record({ attempts: 5, correct: 4, streak: 0, lastResult: "wrong" }))).toBe("struggling");
  });

  it("struggling below 60% accuracy, slow at exactly 60%", () => {
    expect(classify(record({ attempts: 5, correct: 2, lastResult: "fast" }))).toBe("struggling");
    expect(classify(record({ attempts: 5, correct: 3, lastResult: "fast" }))).toBe("slow");
  });

  it("slow with streak under 3, fast at 3", () => {
    expect(classify(record({ attempts: 5, correct: 5, streak: 2, lastResult: "fast" }))).toBe("slow");
    expect(classify(record({ attempts: 5, correct: 5, streak: 3, lastResult: "fast" }))).toBe("fast");
  });
});

// ─── weightFor ──────────────────────────────────────────────────────

describe("weightFor", () => {
  it("uses the class weight", () => {
    expect(weightFor(record(), 5)).toBe(WEIGHTS.unseen);
    expect(weightFor(record(STRUGGLING), 5)).toBe(WEIGHTS.struggling);
    expect(weightFor(record(FAST), 5)).toBe(WEIGHTS.fast);
  });

  it("halves when seen in the previous round only", () => {
    expect(weightFor(record({ ...STRUGGLING, lastRound: 4 }), 5)).toBe(WEIGHTS.struggling / 2);
    expect(weightFor(record({ ...STRUGGLING, lastRound: 3 }), 5)).toBe(WEIGHTS.struggling);
  });
});

// ─── sampleRound ────────────────────────────────────────────────────

describe("sampleRound", () => {
  it("returns count unique facts with a display order", () => {
    const random = seeded(1);
    for (let i = 0; i < 200; i++) {
      const round = sampleRound(emptyStats(), 20, random);
      expect(round).toHaveLength(20);
      expect(new Set(round.map((f) => f.key)).size).toBe(20);
      for (const f of round) {
        expect(f.display.slice().sort((x, y) => x - y)).toEqual([f.a, f.b]);
      }
    }
  });

  it("strongly favors a struggling fact over fast ones", () => {
    const stats = allFastStats();
    stats.facts["7×8"] = record(STRUGGLING);
    const random = seeded(7);
    let hits = 0;
    for (let i = 0; i < 100; i++) {
      if (sampleRound(stats, 20, random).some((f) => f.key === "7×8")) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(95);
  });

  it("fills from fast facts when everything is fast", () => {
    const round = sampleRound(allFastStats(), 20, seeded(3));
    expect(round).toHaveLength(20);
    expect(new Set(round.map((f) => f.key)).size).toBe(20);
  });

  it("puts non-fast facts first when there are fewer than count", () => {
    const stats = allFastStats();
    stats.facts["3×4"] = record(STRUGGLING);
    stats.facts["9×9"] = record({ attempts: 0 });
    const round = sampleRound(stats, 20, seeded(9));
    const keys = round.map((f) => f.key);
    expect(keys.slice(0, 2).sort()).toEqual(["3×4", "9×9"]);
  });
});

// ─── drillRound ─────────────────────────────────────────────────────

describe("drillRound", () => {
  it("includes the target and only same-family facts", () => {
    const round = drillRound(emptyStats(), "7×8", 10, seeded(5));
    expect(round).toHaveLength(10);
    expect(round.some((f) => f.key === "7×8")).toBe(true);
    for (const f of round) {
      expect([f.a, f.b].some((n) => n === 7 || n === 8)).toBe(true);
    }
    expect(new Set(round.map((f) => f.key)).size).toBe(10);
  });

  it("returns empty for an unknown key", () => {
    expect(drillRound(emptyStats(), "13×2", 10, seeded(5))).toEqual([]);
  });
});

// ─── checkTyped / gradeAnswer ───────────────────────────────────────

describe("checkTyped", () => {
  it("classifies typed input against the answer", () => {
    expect(checkTyped(56, "")).toBe("prefix");
    expect(checkTyped(56, "5")).toBe("prefix");
    expect(checkTyped(56, "56")).toBe("match");
    expect(checkTyped(56, "6")).toBe("wrong");
    expect(checkTyped(56, "55")).toBe("wrong");
    expect(checkTyped(7, "8")).toBe("wrong");
    expect(checkTyped(7, "7")).toBe("match");
  });
});

describe("gradeAnswer", () => {
  it("grades by elapsed time and typed result", () => {
    expect(gradeAnswer(2999, "match")).toBe("fast");
    expect(gradeAnswer(FAST_MS, "match")).toBe("fast");
    expect(gradeAnswer(FAST_MS + 1, "match")).toBe("slow");
    expect(gradeAnswer(TIMEOUT_MS, "match")).toBe("wrong");
    expect(gradeAnswer(1000, "wrong")).toBe("wrong");
  });
});

// ─── summarizeRound ─────────────────────────────────────────────────

describe("summarizeRound", () => {
  it("counts grades and sums time", () => {
    const summary = summarizeRound([
      { grade: "fast", elapsedMs: 1000 },
      { grade: "slow", elapsedMs: 4000 },
      { grade: "wrong", elapsedMs: 6000 },
      { grade: "fast", elapsedMs: 2000 },
    ]);
    expect(summary).toEqual({ fastCount: 2, slowCount: 1, wrongCount: 1, totalMs: 13000 });
  });
});

// ─── applyRound ─────────────────────────────────────────────────────

describe("applyRound", () => {
  it("does not mutate the input stats", () => {
    const stats = emptyStats();
    const frozen = JSON.stringify(stats);
    applyRound(stats, [{ key: "7×8", grade: "fast", elapsedMs: 1000 }], 1);
    expect(JSON.stringify(stats)).toBe(frozen);
  });

  it("updates counts, streak, moving average, and round number", () => {
    let { stats } = applyRound(emptyStats(), [{ key: "7×8", grade: "fast", elapsedMs: 1000 }], 1);
    let rec = getRecord(stats, "7×8");
    expect(rec).toMatchObject({ attempts: 1, correct: 1, fastCorrect: 1, avgMs: 1000, streak: 1, lastRound: 1, lastResult: "fast" });
    expect(stats.roundNumber).toBe(1);

    ({ stats } = applyRound(stats, [{ key: "7×8", grade: "slow", elapsedMs: 2000 }], 2));
    rec = getRecord(stats, "7×8");
    expect(rec.avgMs).toBeCloseTo(0.3 * 2000 + 0.7 * 1000);
    expect(rec.streak).toBe(0);
    expect(rec.correct).toBe(2);

    ({ stats } = applyRound(stats, [{ key: "7×8", grade: "wrong", elapsedMs: 6000 }], 3));
    rec = getRecord(stats, "7×8");
    expect(rec.avgMs).toBeCloseTo(0.3 * 2000 + 0.7 * 1000); // unchanged on wrong
    expect(rec.attempts).toBe(3);
    expect(rec.correct).toBe(2);
    expect(rec.lastResult).toBe("wrong");
  });

  it("reports newlyFast only on the transition to fast", () => {
    let stats = emptyStats();
    let out;
    for (let round = 1; round <= 3; round++) {
      out = applyRound(stats, [{ key: "6×9", grade: "fast", elapsedMs: 1200 }], round);
      stats = out.stats;
      expect(out.newlyFast).toEqual(round === 3 ? ["6×9"] : []);
    }
    out = applyRound(stats, [{ key: "6×9", grade: "fast", elapsedMs: 1200 }], 4);
    expect(out.newlyFast).toEqual([]);
  });
});

// ─── countByClass ───────────────────────────────────────────────────

describe("countByClass", () => {
  it("totals to 78 and reflects records", () => {
    const stats = statsWith({ "7×8": FAST, "3×4": STRUGGLING });
    const counts = countByClass(stats);
    expect(counts.fast).toBe(1);
    expect(counts.struggling).toBe(1);
    expect(counts.unseen).toBe(76);
    expect(counts.fast + counts.struggling + counts.slow + counts.unseen).toBe(78);
  });
});

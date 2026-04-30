import { describe, it, expect } from "vitest";
import {
  createGameState,
  startRound,
  advanceWatch,
  generateOptions,
  submitAnswer,
  nextRound,
  getRating,
  _testing,
} from "./simonStatesEngine.js";

const MOCK_STATES = [
  { s: "Kansas", c: "Topeka", a: "KS", r: "Midwest" },
  { s: "Texas", c: "Austin", a: "TX", r: "South" },
  { s: "Ohio", c: "Columbus", a: "OH", r: "Midwest" },
  { s: "Maine", c: "Augusta", a: "ME", r: "Northeast" },
  { s: "Idaho", c: "Boise", a: "ID", r: "West" },
  { s: "Florida", c: "Tallahassee", a: "FL", r: "South" },
];

// ─── createGameState ────────────────────────────────────────────────

describe("createGameState", () => {
  it("returns correct initial values", () => {
    const state = createGameState("capitals");
    expect(state.status).toBe("ready");
    expect(state.phase).toBe("watching");
    expect(state.round).toBe(0);
    expect(state.sequence).toEqual([]);
    expect(state.currentIndex).toBe(0);
    expect(state.category).toBe("capitals");
    expect(state.highestRound).toBe(0);
    expect(state.failedItem).toBeNull();
    expect(state.selectedAnswer).toBeNull();
    expect(state.correctAnswer).toBeNull();
  });

  it("defaults to capitals category", () => {
    const state = createGameState();
    expect(state.category).toBe("capitals");
  });

  it("accepts abbreviations category", () => {
    const state = createGameState("abbreviations");
    expect(state.category).toBe("abbreviations");
  });
});

// ─── startRound ─────────────────────────────────────────────────────

describe("startRound", () => {
  it("increments round and adds a state to sequence", () => {
    const state = createGameState("capitals");
    const next = startRound(state, MOCK_STATES);
    expect(next.round).toBe(1);
    expect(next.sequence.length).toBe(1);
    expect(next.status).toBe("playing");
    expect(next.phase).toBe("watching");
    expect(next.currentIndex).toBe(0);
  });

  it("adds unique states across rounds", () => {
    let state = createGameState("capitals");
    const seen = new Set();
    for (let i = 0; i < MOCK_STATES.length; i++) {
      state = startRound(state, MOCK_STATES);
      // After startRound, prepare for next by setting phase
      state = { ...state, phase: "roundComplete" };
      state = nextRound(state);
    }
    // All states in sequence should be unique
    const stateNames = state.sequence.map((s) => s.state);
    const unique = new Set(stateNames);
    expect(unique.size).toBe(stateNames.length);
  });

  it("never adds a duplicate state", () => {
    let state = createGameState("capitals");
    for (let i = 0; i < MOCK_STATES.length; i++) {
      state = startRound(state, MOCK_STATES);
    }
    const stateNames = state.sequence.map((s) => s.state);
    expect(new Set(stateNames).size).toBe(MOCK_STATES.length);
  });

  it("sets status to gameOver when all states are used", () => {
    let state = createGameState("capitals");
    // Use all mock states
    for (let i = 0; i < MOCK_STATES.length; i++) {
      state = startRound(state, MOCK_STATES);
    }
    // Try one more
    const final = startRound(state, MOCK_STATES);
    expect(final.status).toBe("gameOver");
  });

  it("stores state, capital, and abbreviation in sequence items", () => {
    const state = createGameState("capitals");
    const next = startRound(state, MOCK_STATES);
    const item = next.sequence[0];
    expect(item).toHaveProperty("state");
    expect(item).toHaveProperty("capital");
    expect(item).toHaveProperty("abbreviation");
    // Verify it matches a mock state
    const match = MOCK_STATES.find((s) => s.s === item.state);
    expect(match).toBeDefined();
    expect(item.capital).toBe(match.c);
    expect(item.abbreviation).toBe(match.a);
  });
});

// ─── advanceWatch ───────────────────────────────────────────────────

describe("advanceWatch", () => {
  it("increments currentIndex during watching", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES);
    state = startRound(state, MOCK_STATES); // round 2, 2 items in sequence
    expect(state.currentIndex).toBe(0);
    state = advanceWatch(state);
    expect(state.currentIndex).toBe(1);
  });

  it("transitions to recalling phase after last item", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES); // 1 item
    state = advanceWatch(state);
    expect(state.phase).toBe("recalling");
    expect(state.currentIndex).toBe(0);
  });

  it("transitions to recalling after multi-item sequence", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES); // 1 item
    state = startRound(state, MOCK_STATES); // 2 items
    state = startRound(state, MOCK_STATES); // 3 items
    // Advance through all 3
    state = advanceWatch(state); // index 1
    expect(state.phase).toBe("watching");
    state = advanceWatch(state); // index 2
    expect(state.phase).toBe("watching");
    state = advanceWatch(state); // past end → recalling
    expect(state.phase).toBe("recalling");
    expect(state.currentIndex).toBe(0);
  });
});

// ─── generateOptions ────────────────────────────────────────────────

describe("generateOptions", () => {
  it("returns exactly 4 options", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES);
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const options = generateOptions(state, MOCK_STATES);
    expect(options.length).toBe(4);
  });

  it("includes the correct answer for capitals", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES);
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const options = generateOptions(state, MOCK_STATES);
    const correct = state.sequence[0].capital;
    expect(options).toContain(correct);
  });

  it("includes the correct answer for abbreviations", () => {
    let state = createGameState("abbreviations");
    state = startRound(state, MOCK_STATES);
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const options = generateOptions(state, MOCK_STATES);
    const correct = state.sequence[0].abbreviation;
    expect(options).toContain(correct);
  });

  it("distractors are not from the current sequence", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES);
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const options = generateOptions(state, MOCK_STATES);
    const correct = state.sequence[0].capital;
    const sequenceCapitals = state.sequence.map((s) => s.capital);
    const distractors = options.filter((o) => o !== correct);
    for (const d of distractors) {
      expect(sequenceCapitals).not.toContain(d);
    }
  });

  it("returns unique options", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES);
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const options = generateOptions(state, MOCK_STATES);
    expect(new Set(options).size).toBe(options.length);
  });
});

// ─── submitAnswer ───────────────────────────────────────────────────

describe("submitAnswer", () => {
  it("correct answer mid-sequence advances currentIndex", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES);
    state = startRound(state, MOCK_STATES); // 2 items
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const correct = state.sequence[0].capital;
    const { state: next, correct: isCorrect } = submitAnswer(state, correct);
    expect(isCorrect).toBe(true);
    expect(next.currentIndex).toBe(1);
    expect(next.phase).toBe("recalling"); // still recalling, more items left
  });

  it("correct answer on last item sets phase to roundComplete", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES); // 1 item
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const correct = state.sequence[0].capital;
    const { state: next, correct: isCorrect } = submitAnswer(state, correct);
    expect(isCorrect).toBe(true);
    expect(next.phase).toBe("roundComplete");
    expect(next.highestRound).toBe(1);
  });

  it("wrong answer sets gameOver with failedItem", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES); // 1 item
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const wrong = "Wrong Answer";
    const { state: next, correct: isCorrect } = submitAnswer(state, wrong);
    expect(isCorrect).toBe(false);
    expect(next.status).toBe("gameOver");
    expect(next.failedItem).toEqual(state.sequence[0]);
    expect(next.selectedAnswer).toBe("Wrong Answer");
    expect(next.correctAnswer).toBe(state.sequence[0].capital);
    expect(next.highestRound).toBe(1); // reached round 1
  });

  it("works with abbreviations category", () => {
    let state = createGameState("abbreviations");
    state = startRound(state, MOCK_STATES);
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const correct = state.sequence[0].abbreviation;
    const { state: next, correct: isCorrect } = submitAnswer(state, correct);
    expect(isCorrect).toBe(true);
  });

  it("wrong answer in abbreviations mode records correct abbreviation", () => {
    let state = createGameState("abbreviations");
    state = startRound(state, MOCK_STATES);
    state = { ...state, phase: "recalling", currentIndex: 0 };
    const { state: next } = submitAnswer(state, "XX");
    expect(next.correctAnswer).toBe(state.sequence[0].abbreviation);
  });
});

// ─── nextRound ──────────────────────────────────────────────────────

describe("nextRound", () => {
  it("resets phase to watching and currentIndex to 0", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES);
    state = { ...state, phase: "roundComplete", currentIndex: 1 };
    const next = nextRound(state);
    expect(next.phase).toBe("watching");
    expect(next.currentIndex).toBe(0);
  });

  it("preserves round and sequence", () => {
    let state = createGameState("capitals");
    state = startRound(state, MOCK_STATES);
    const round = state.round;
    const seqLen = state.sequence.length;
    const next = nextRound(state);
    expect(next.round).toBe(round);
    expect(next.sequence.length).toBe(seqLen);
  });
});

// ─── getRating ──────────────────────────────────────────────────────

describe("getRating", () => {
  it("returns Keep Going for rounds 0-3", () => {
    expect(getRating(0)).toBe("Keep Going");
    expect(getRating(1)).toBe("Keep Going");
    expect(getRating(3)).toBe("Keep Going");
  });

  it("returns Getting There for rounds 4-7", () => {
    expect(getRating(4)).toBe("Getting There");
    expect(getRating(7)).toBe("Getting There");
  });

  it("returns Sharp Mind for rounds 8-12", () => {
    expect(getRating(8)).toBe("Sharp Mind");
    expect(getRating(12)).toBe("Sharp Mind");
  });

  it("returns Memory Master for rounds 13-19", () => {
    expect(getRating(13)).toBe("Memory Master");
    expect(getRating(19)).toBe("Memory Master");
  });

  it("returns Legendary for rounds 20+", () => {
    expect(getRating(20)).toBe("Legendary");
    expect(getRating(50)).toBe("Legendary");
  });
});

// ─── _testing constants ─────────────────────────────────────────────

describe("_testing", () => {
  it("exports expected constants", () => {
    expect(_testing.FLASH_DURATION_MS).toBe(1500);
    expect(_testing.FLASH_GAP_MS).toBe(400);
    expect(_testing.OPTIONS_COUNT).toBe(4);
  });
});

// ─── Integration: multi-round game simulation ───────────────────────

describe("multi-round integration", () => {
  it("plays through multiple rounds correctly", () => {
    let state = createGameState("capitals");

    // Round 1
    state = startRound(state, MOCK_STATES);
    expect(state.round).toBe(1);
    expect(state.sequence.length).toBe(1);

    // Watch phase: advance past the single item
    state = advanceWatch(state);
    expect(state.phase).toBe("recalling");
    expect(state.currentIndex).toBe(0);

    // Recall: answer correctly
    const options1 = generateOptions(state, MOCK_STATES);
    expect(options1).toContain(state.sequence[0].capital);
    const { state: s1 } = submitAnswer(state, state.sequence[0].capital);
    state = s1;
    expect(state.phase).toBe("roundComplete");
    expect(state.highestRound).toBe(1);

    // Round 2
    state = nextRound(state);
    state = startRound(state, MOCK_STATES);
    expect(state.round).toBe(2);
    expect(state.sequence.length).toBe(2);

    // Watch phase: advance past both items
    state = advanceWatch(state); // index 1
    state = advanceWatch(state); // past end → recalling
    expect(state.phase).toBe("recalling");
    expect(state.currentIndex).toBe(0);

    // Recall: answer both correctly
    const { state: s2a } = submitAnswer(state, state.sequence[0].capital);
    state = s2a;
    expect(state.currentIndex).toBe(1);

    const { state: s2b } = submitAnswer(state, state.sequence[1].capital);
    state = s2b;
    expect(state.phase).toBe("roundComplete");
    expect(state.highestRound).toBe(2);

    // Round 3 — fail on purpose
    state = nextRound(state);
    state = startRound(state, MOCK_STATES);
    expect(state.round).toBe(3);

    // Watch
    state = advanceWatch(state);
    state = advanceWatch(state);
    state = advanceWatch(state);
    expect(state.phase).toBe("recalling");

    // Fail on first recall
    const { state: s3, correct } = submitAnswer(state, "WRONG");
    state = s3;
    expect(correct).toBe(false);
    expect(state.status).toBe("gameOver");
    expect(state.highestRound).toBe(3); // reached round 3
    expect(state.failedItem).toBeDefined();
    expect(state.selectedAnswer).toBe("WRONG");
  });
});

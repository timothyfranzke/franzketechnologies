// ─── SIMON STATES ENGINE ────────────────────────────────────────────
// Pure game logic — no React, no DOM, no side effects.
// Every function takes state in and returns new state out.

// ─── CONSTANTS ──────────────────────────────────────────────────────

const FLASH_DURATION_MS = 1500;
const FLASH_GAP_MS = 400;
const OPTIONS_COUNT = 4;

// ─── CREATE GAME STATE ──────────────────────────────────────────────

export function createGameState(category = "capitals") {
  return {
    status: "ready", // ready | countdown | playing | gameOver
    phase: "watching", // watching | recalling | roundComplete
    round: 0,
    sequence: [], // { state, capital, abbreviation }[]
    currentIndex: 0,
    category,
    highestRound: 0,
    failedItem: null,
    selectedAnswer: null,
    correctAnswer: null,
  };
}

// ─── START ROUND ────────────────────────────────────────────────────

export function startRound(state, statesData) {
  const usedStates = new Set(state.sequence.map((s) => s.state));
  const available = statesData.filter((s) => !usedStates.has(s.s));
  if (available.length === 0) {
    // All 50 states used — victory
    return {
      ...state,
      status: "gameOver",
      highestRound: state.round,
    };
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  const newItem = { state: pick.s, capital: pick.c, abbreviation: pick.a };
  const newRound = state.round + 1;
  return {
    ...state,
    status: "playing",
    phase: "watching",
    round: newRound,
    sequence: [...state.sequence, newItem],
    currentIndex: 0,
  };
}

// ─── ADVANCE WATCH ──────────────────────────────────────────────────

export function advanceWatch(state) {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.sequence.length) {
    // Done watching — transition to recalling
    return {
      ...state,
      phase: "recalling",
      currentIndex: 0,
    };
  }
  return {
    ...state,
    currentIndex: nextIndex,
  };
}

// ─── GENERATE OPTIONS ───────────────────────────────────────────────

export function generateOptions(state, statesData) {
  const currentItem = state.sequence[state.currentIndex];
  const correctAnswer =
    state.category === "abbreviations" ? currentItem.abbreviation : currentItem.capital;

  // Get distractor pool: states NOT in the current sequence
  const sequenceStates = new Set(state.sequence.map((s) => s.state));
  const pool = statesData.filter((s) => !sequenceStates.has(s.s));

  // Shuffle pool and pick distractors
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const distractors = shuffled
    .slice(0, OPTIONS_COUNT - 1)
    .map((s) => (state.category === "abbreviations" ? s.a : s.c));

  // Combine and shuffle
  const options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
  return options;
}

// ─── SUBMIT ANSWER ──────────────────────────────────────────────────

export function submitAnswer(state, answerId) {
  const currentItem = state.sequence[state.currentIndex];
  const correctAnswer =
    state.category === "abbreviations" ? currentItem.abbreviation : currentItem.capital;

  const correct = answerId === correctAnswer;

  if (!correct) {
    return {
      state: {
        ...state,
        status: "gameOver",
        failedItem: currentItem,
        selectedAnswer: answerId,
        correctAnswer,
        highestRound: state.round,
      },
      correct: false,
    };
  }

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.sequence.length) {
    // Completed the full sequence for this round
    return {
      state: {
        ...state,
        phase: "roundComplete",
        currentIndex: nextIndex,
        highestRound: state.round,
      },
      correct: true,
    };
  }

  // More items to recall
  return {
    state: {
      ...state,
      currentIndex: nextIndex,
    },
    correct: true,
  };
}

// ─── NEXT ROUND ─────────────────────────────────────────────────────

export function nextRound(state) {
  return {
    ...state,
    phase: "watching",
    currentIndex: 0,
  };
}

// ─── GET RATING ─────────────────────────────────────────────────────

export function getRating(round) {
  if (round >= 20) return "Legendary";
  if (round >= 13) return "Memory Master";
  if (round >= 8) return "Sharp Mind";
  if (round >= 4) return "Getting There";
  return "Keep Going";
}

// ─── EXPORTS FOR TESTING ────────────────────────────────────────────

export const _testing = {
  FLASH_DURATION_MS,
  FLASH_GAP_MS,
  OPTIONS_COUNT,
};

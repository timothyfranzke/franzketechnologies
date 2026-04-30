// ─── LIGHTNING MATCH ENGINE ──────────────────────────────────────────
// Pure game logic — no React, no DOM, no side effects.
// Every function takes state in and returns new state out.

let _tileCounter = 0;
const nextTileId = () => `tile-${++_tileCounter}`;

// ─── CONSTANTS ──────────────────────────────────────────────────────

const BASE_SCORE = 100;
const GAME_DURATION = 60;
const NUM_LANES = 4;
const LANE_JITTER = 12; // ±px
const MAX_ACTIVE_TILES = 12;
const SELECTION_LOCK_MS = 300;
const STAGGER_MIN = 1;
const STAGGER_MAX = 3;

const DIFFICULTY_TABLE = [
  { threshold: 0, fallDurationMs: 6000, spawnIntervalMs: 2000 },
  { threshold: 15, fallDurationMs: 5000, spawnIntervalMs: 1700 },
  { threshold: 30, fallDurationMs: 4000, spawnIntervalMs: 1400 },
  { threshold: 45, fallDurationMs: 3500, spawnIntervalMs: 1200 },
];

// ─── DIFFICULTY ─────────────────────────────────────────────────────

export function getDifficultyParams(elapsedSeconds) {
  let params = DIFFICULTY_TABLE[0];
  for (const row of DIFFICULTY_TABLE) {
    if (elapsedSeconds >= row.threshold) params = row;
  }
  return { fallDurationMs: params.fallDurationMs, spawnIntervalMs: params.spawnIntervalMs };
}

// ─── COMBO MULTIPLIER ───────────────────────────────────────────────

export function getComboMultiplier(combo) {
  if (combo >= 6) return 3;
  if (combo >= 4) return 2;
  if (combo >= 2) return 1.5;
  return 1;
}

// ─── CREATE GAME STATE ──────────────────────────────────────────────

export function createGameState() {
  _tileCounter = 0;
  return {
    status: "ready", // ready | playing | gameOver
    score: 0,
    combo: 0,
    maxCombo: 0,
    timeRemaining: GAME_DURATION,
    activeTiles: [],
    selectedTileIds: [],
    matchesCorrect: 0,
    matchesIncorrect: 0,
    missedTiles: 0,
    activePairIds: [],
    pendingSpawns: [], // { pairIndex, side: "right", spawnsUntil: number }
    selectionLocked: false,
    spawnCount: 0, // tracks spawn cycles for stagger timing
  };
}

// ─── BUILD PAIR FROM STATE DATA ─────────────────────────────────────

function buildPair(stateData, category) {
  const left = stateData.s;
  const right = category === "abbreviations" ? stateData.a : stateData.c;
  return { left, right };
}

// ─── PICK LANE ──────────────────────────────────────────────────────

function pickLane(activeTiles) {
  // Prefer lanes with fewer active tiles
  const laneCounts = Array(NUM_LANES).fill(0);
  for (const tile of activeTiles) {
    laneCounts[tile.lane]++;
  }
  const minCount = Math.min(...laneCounts);
  const candidates = [];
  for (let i = 0; i < NUM_LANES; i++) {
    if (laneCounts[i] === minCount) candidates.push(i);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function laneToX(lane) {
  // Returns a percentage-based x position (0-100) with jitter
  const laneWidth = 100 / NUM_LANES;
  const center = lane * laneWidth + laneWidth / 2;
  const jitter = (Math.random() * 2 - 1) * LANE_JITTER * (100 / 400); // normalize jitter to percentage
  return Math.max(2, Math.min(98, center + jitter));
}

// ─── SPAWN TILE ─────────────────────────────────────────────────────

export function spawnTile(state, statesData, category) {
  if (state.status !== "playing") return { state, newTiles: [] };

  const activeFallingCount = state.activeTiles.filter(
    (t) => t.state === "falling" || t.state === "selected"
  ).length;

  if (activeFallingCount >= MAX_ACTIVE_TILES) return { state, newTiles: [] };

  let newState = { ...state, spawnCount: state.spawnCount + 1 };
  const newTiles = [];
  const elapsed = GAME_DURATION - state.timeRemaining;
  const { fallDurationMs } = getDifficultyParams(elapsed);

  // Check if any pending spawns are due
  const stillPending = [];
  for (const pending of newState.pendingSpawns) {
    if (newState.spawnCount >= pending.spawnsUntil) {
      // Spawn the second half
      const pair = buildPair(statesData[pending.pairIndex], category);
      const text = pending.side === "right" ? pair.right : pair.left;
      const lane = pickLane(newState.activeTiles);
      const tile = {
        id: nextTileId(),
        text,
        matchId: `pair-${pending.pairIndex}`,
        pairSide: pending.side,
        lane,
        x: laneToX(lane),
        fallDurationMs,
        state: "falling",
      };
      newState = {
        ...newState,
        activeTiles: [...newState.activeTiles, tile],
      };
      newTiles.push(tile);
    } else {
      stillPending.push(pending);
    }
  }
  newState = { ...newState, pendingSpawns: stillPending };

  // Spawn a new pair's first half (if we have room and not too many active pairs)
  const updatedFallingCount = newState.activeTiles.filter(
    (t) => t.state === "falling" || t.state === "selected"
  ).length;

  if (updatedFallingCount < MAX_ACTIVE_TILES) {
    // Find a pair not currently active
    const available = [];
    for (let i = 0; i < statesData.length; i++) {
      if (!newState.activePairIds.includes(`pair-${i}`)) {
        available.push(i);
      }
    }

    if (available.length > 0) {
      const pairIndex = available[Math.floor(Math.random() * available.length)];
      const pair = buildPair(statesData[pairIndex], category);
      const lane = pickLane(newState.activeTiles);
      const matchId = `pair-${pairIndex}`;

      const tile = {
        id: nextTileId(),
        text: pair.left,
        matchId,
        pairSide: "left",
        lane,
        x: laneToX(lane),
        fallDurationMs,
        state: "falling",
      };

      // Schedule the second half 1-3 spawn cycles later
      const staggerDelay = STAGGER_MIN + Math.floor(Math.random() * (STAGGER_MAX - STAGGER_MIN + 1));

      newState = {
        ...newState,
        activeTiles: [...newState.activeTiles, tile],
        activePairIds: [...newState.activePairIds, matchId],
        pendingSpawns: [
          ...newState.pendingSpawns,
          {
            pairIndex,
            side: "right",
            spawnsUntil: newState.spawnCount + staggerDelay,
          },
        ],
      };
      newTiles.push(tile);
    }
  }

  return { state: newState, newTiles };
}

// ─── SELECT TILE ────────────────────────────────────────────────────

export function selectTile(state, tileId) {
  if (state.status !== "playing" || state.selectionLocked) {
    return { state, result: null };
  }

  const tile = state.activeTiles.find((t) => t.id === tileId);
  if (!tile || tile.state === "matched" || tile.state === "missed") {
    return { state, result: null };
  }

  // Toggle: deselect if already selected
  if (state.selectedTileIds.includes(tileId)) {
    return {
      state: {
        ...state,
        selectedTileIds: state.selectedTileIds.filter((id) => id !== tileId),
        activeTiles: state.activeTiles.map((t) =>
          t.id === tileId ? { ...t, state: "falling" } : t
        ),
      },
      result: null,
    };
  }

  // If we already have 2 selected, ignore
  if (state.selectedTileIds.length >= 2) {
    return { state, result: null };
  }

  // Select the tile
  let newState = {
    ...state,
    selectedTileIds: [...state.selectedTileIds, tileId],
    activeTiles: state.activeTiles.map((t) =>
      t.id === tileId ? { ...t, state: "selected" } : t
    ),
  };

  // If we now have 2 selected, evaluate the match
  if (newState.selectedTileIds.length === 2) {
    return evaluateMatch(newState);
  }

  return { state: newState, result: null };
}

// ─── EVALUATE MATCH ─────────────────────────────────────────────────

export function evaluateMatch(state) {
  const [id1, id2] = state.selectedTileIds;
  const tile1 = state.activeTiles.find((t) => t.id === id1);
  const tile2 = state.activeTiles.find((t) => t.id === id2);

  if (!tile1 || !tile2) {
    return {
      state: { ...state, selectedTileIds: [], selectionLocked: false },
      result: null,
    };
  }

  const isMatch = tile1.matchId === tile2.matchId && tile1.pairSide !== tile2.pairSide;

  if (isMatch) {
    const newCombo = state.combo + 1;
    const multiplier = getComboMultiplier(newCombo);
    const awarded = Math.round(BASE_SCORE * multiplier);

    return {
      state: {
        ...state,
        activeTiles: state.activeTiles.map((t) =>
          t.id === id1 || t.id === id2 ? { ...t, state: "matched" } : t
        ),
        selectedTileIds: [],
        score: state.score + awarded,
        combo: newCombo,
        maxCombo: Math.max(state.maxCombo, newCombo),
        matchesCorrect: state.matchesCorrect + 1,
        selectionLocked: true,
      },
      result: "correct",
      awarded,
      multiplier,
    };
  } else {
    return {
      state: {
        ...state,
        activeTiles: state.activeTiles.map((t) =>
          t.id === id1 || t.id === id2 ? { ...t, state: "falling" } : t
        ),
        selectedTileIds: [],
        combo: 0,
        matchesIncorrect: state.matchesIncorrect + 1,
        selectionLocked: true,
      },
      result: "incorrect",
    };
  }
}

// ─── HANDLE MISSED TILE ─────────────────────────────────────────────

export function handleMissedTile(state, tileId) {
  const tile = state.activeTiles.find((t) => t.id === tileId);
  if (!tile || tile.state === "matched") return state;

  const matchId = tile.matchId;

  // Check if the partner tile is still active
  const partnerStillActive = state.activeTiles.some(
    (t) => t.id !== tileId && t.matchId === matchId && t.state !== "matched" && t.state !== "missed"
  );

  return {
    ...state,
    activeTiles: state.activeTiles.map((t) =>
      t.id === tileId ? { ...t, state: "missed" } : t
    ),
    selectedTileIds: state.selectedTileIds.filter((id) => id !== tileId),
    combo: 0,
    missedTiles: state.missedTiles + 1,
    // Remove pair from active if no tiles from this pair remain
    activePairIds: partnerStillActive
      ? state.activePairIds
      : state.activePairIds.filter((id) => id !== matchId),
  };
}

// ─── REMOVE COMPLETED TILES ─────────────────────────────────────────

export function cleanupTiles(state) {
  const remaining = state.activeTiles.filter(
    (t) => t.state !== "matched" && t.state !== "missed"
  );

  // Recalculate activePairIds from remaining tiles
  const activePairIds = [...new Set(remaining.map((t) => t.matchId))];

  return {
    ...state,
    activeTiles: remaining,
    activePairIds,
  };
}

// ─── TICK ───────────────────────────────────────────────────────────

export function tick(state, deltaSeconds) {
  if (state.status !== "playing") return state;

  const newTime = Math.max(0, state.timeRemaining - deltaSeconds);

  if (newTime <= 0) {
    return {
      ...state,
      timeRemaining: 0,
      status: "gameOver",
    };
  }

  return {
    ...state,
    timeRemaining: newTime,
  };
}

// ─── START GAME ─────────────────────────────────────────────────────

export function startGame(state) {
  return {
    ...state,
    status: "playing",
  };
}

// ─── UNLOCK SELECTION ───────────────────────────────────────────────

export function unlockSelection(state) {
  return {
    ...state,
    selectionLocked: false,
  };
}

// ─── EXPORTS FOR TESTING ────────────────────────────────────────────

export const _testing = {
  BASE_SCORE,
  GAME_DURATION,
  NUM_LANES,
  MAX_ACTIVE_TILES,
  SELECTION_LOCK_MS,
  DIFFICULTY_TABLE,
  buildPair,
  pickLane,
  resetTileCounter: () => { _tileCounter = 0; },
};

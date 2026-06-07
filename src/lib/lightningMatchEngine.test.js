import { describe, it, expect, beforeEach } from "vitest";
import {
  createGameState,
  getDifficultyParams,
  getComboMultiplier,
  startGame,
  spawnTile,
  selectTile,
  handleMissedTile,
  cleanupTiles,
  tick,
  unlockSelection,
  _testing,
} from "./lightningMatchEngine.js";

const MOCK_STATES = [
  { s: "Kansas", c: "Topeka", a: "KS", r: "Midwest" },
  { s: "Texas", c: "Austin", a: "TX", r: "South" },
  { s: "Ohio", c: "Columbus", a: "OH", r: "Midwest" },
  { s: "Maine", c: "Augusta", a: "ME", r: "Northeast" },
  { s: "Idaho", c: "Boise", a: "ID", r: "West" },
];

beforeEach(() => {
  _testing.resetTileCounter();
});

// ─── createGameState ────────────────────────────────────────────────

describe("createGameState", () => {
  it("returns correct initial values", () => {
    const state = createGameState();
    expect(state.status).toBe("ready");
    expect(state.score).toBe(0);
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(0);
    expect(state.timeRemaining).toBe(60);
    expect(state.activeTiles).toEqual([]);
    expect(state.selectedTileIds).toEqual([]);
    expect(state.matchesCorrect).toBe(0);
    expect(state.matchesIncorrect).toBe(0);
    expect(state.missedTiles).toBe(0);
    expect(state.selectionLocked).toBe(false);
  });
});

// ─── getComboMultiplier ─────────────────────────────────────────────

describe("getComboMultiplier", () => {
  it("returns x1 for combo 0", () => {
    expect(getComboMultiplier(0)).toBe(1);
  });

  it("returns x1 for combo 1", () => {
    expect(getComboMultiplier(1)).toBe(1);
  });

  it("returns x1.5 for combo 2-3", () => {
    expect(getComboMultiplier(2)).toBe(1.5);
    expect(getComboMultiplier(3)).toBe(1.5);
  });

  it("returns x2 for combo 4-5", () => {
    expect(getComboMultiplier(4)).toBe(2);
    expect(getComboMultiplier(5)).toBe(2);
  });

  it("returns x3 for combo 6+", () => {
    expect(getComboMultiplier(6)).toBe(3);
    expect(getComboMultiplier(10)).toBe(3);
    expect(getComboMultiplier(100)).toBe(3);
  });
});

// ─── getDifficultyParams ────────────────────────────────────────────

describe("getDifficultyParams", () => {
  it("returns slowest params at 0 seconds", () => {
    const p = getDifficultyParams(0);
    expect(p.fallDurationMs).toBe(6000);
    expect(p.spawnIntervalMs).toBe(2000);
  });

  it("returns level 2 params at 15 seconds", () => {
    const p = getDifficultyParams(15);
    expect(p.fallDurationMs).toBe(5000);
    expect(p.spawnIntervalMs).toBe(1700);
  });

  it("returns level 3 params at 30 seconds", () => {
    const p = getDifficultyParams(30);
    expect(p.fallDurationMs).toBe(4000);
    expect(p.spawnIntervalMs).toBe(1400);
  });

  it("returns fastest params at 45 seconds", () => {
    const p = getDifficultyParams(45);
    expect(p.fallDurationMs).toBe(3500);
    expect(p.spawnIntervalMs).toBe(1200);
  });

  it("returns level 2 params at 20 seconds (between thresholds)", () => {
    const p = getDifficultyParams(20);
    expect(p.fallDurationMs).toBe(5000);
    expect(p.spawnIntervalMs).toBe(1700);
  });
});

// ─── spawnTile ──────────────────────────────────────────────────────

describe("spawnTile", () => {
  it("does not spawn when game is not playing", () => {
    const state = createGameState();
    const { state: newState, newTiles } = spawnTile(state, MOCK_STATES, "capitals");
    expect(newTiles).toEqual([]);
  });

  it("spawns a tile when game is playing", () => {
    let state = startGame(createGameState());
    const { state: newState, newTiles } = spawnTile(state, MOCK_STATES, "capitals");
    expect(newTiles.length).toBe(1);
    expect(newState.activeTiles.length).toBe(1);
    expect(newState.pendingSpawns.length).toBe(1); // second half is pending
  });

  it("spawns the second half after stagger delay", () => {
    let state = startGame(createGameState());

    // First spawn: creates left tile + pending
    let result = spawnTile(state, MOCK_STATES, "capitals");
    state = result.state;
    const firstMatchId = result.newTiles[0].matchId;

    // Keep spawning until the pending spawn fires
    let secondHalfSpawned = false;
    for (let i = 0; i < 5; i++) {
      result = spawnTile(state, MOCK_STATES, "capitals");
      state = result.state;
      if (result.newTiles.some((t) => t.matchId === firstMatchId && t.pairSide === "right")) {
        secondHalfSpawned = true;
        break;
      }
    }
    expect(secondHalfSpawned).toBe(true);
  });

  it("avoids duplicate active pairs", () => {
    let state = startGame(createGameState());

    // Spawn several times
    for (let i = 0; i < 10; i++) {
      const result = spawnTile(state, MOCK_STATES, "capitals");
      state = result.state;
    }

    // Check no duplicate matchIds among active pairs
    const uniquePairIds = new Set(state.activePairIds);
    expect(uniquePairIds.size).toBe(state.activePairIds.length);
  });

  it("respects active tile cap", () => {
    let state = startGame(createGameState());

    // Manually fill up with tiles
    const fakeTiles = [];
    for (let i = 0; i < _testing.MAX_ACTIVE_TILES; i++) {
      fakeTiles.push({
        id: `fake-${i}`,
        text: "Test",
        matchId: `fake-pair-${i}`,
        pairSide: "left",
        lane: i % _testing.NUM_LANES,
        x: 25,
        fallDurationMs: 6000,
        state: "falling",
      });
    }
    state = { ...state, activeTiles: fakeTiles };

    const { newTiles } = spawnTile(state, MOCK_STATES, "capitals");
    expect(newTiles).toEqual([]);
  });

  it("uses category for tile text", () => {
    let state = startGame(createGameState());
    const { newTiles } = spawnTile(state, MOCK_STATES, "abbreviations");
    // The first tile should be a state name (left side)
    const stateNames = MOCK_STATES.map((s) => s.s);
    expect(stateNames).toContain(newTiles[0].text);
  });
});

// ─── selectTile ─────────────────────────────────────────────────────

describe("selectTile", () => {
  function setupWithTwoPairTiles(category = "capitals") {
    let state = startGame(createGameState());
    // Manually add a matching pair
    state = {
      ...state,
      activeTiles: [
        { id: "t1", text: "Kansas", matchId: "pair-0", pairSide: "left", lane: 0, x: 12.5, fallDurationMs: 6000, state: "falling" },
        { id: "t2", text: "Topeka", matchId: "pair-0", pairSide: "right", lane: 1, x: 37.5, fallDurationMs: 6000, state: "falling" },
        { id: "t3", text: "Texas", matchId: "pair-1", pairSide: "left", lane: 2, x: 62.5, fallDurationMs: 6000, state: "falling" },
        { id: "t4", text: "Austin", matchId: "pair-1", pairSide: "right", lane: 3, x: 87.5, fallDurationMs: 6000, state: "falling" },
      ],
      activePairIds: ["pair-0", "pair-1"],
    };
    return state;
  }

  it("selects a tile on first tap", () => {
    const state = setupWithTwoPairTiles();
    const { state: newState, result } = selectTile(state, "t1");
    expect(result).toBeNull();
    expect(newState.selectedTileIds).toEqual(["t1"]);
    expect(newState.activeTiles.find((t) => t.id === "t1").state).toBe("selected");
  });

  it("deselects on second tap of same tile", () => {
    let state = setupWithTwoPairTiles();
    let result;
    ({ state, result } = selectTile(state, "t1"));
    ({ state, result } = selectTile(state, "t1"));
    expect(result).toBeNull();
    expect(state.selectedTileIds).toEqual([]);
    expect(state.activeTiles.find((t) => t.id === "t1").state).toBe("falling");
  });

  it("returns correct for matching pair", () => {
    let state = setupWithTwoPairTiles();
    let result;
    ({ state, result } = selectTile(state, "t1"));
    ({ state, result } = selectTile(state, "t2"));
    expect(result).toBe("correct");
    expect(state.matchesCorrect).toBe(1);
    expect(state.combo).toBe(1);
    expect(state.score).toBe(100); // combo 1 → x1 multiplier
    expect(state.selectedTileIds).toEqual([]);
    expect(state.activeTiles.find((t) => t.id === "t1").state).toBe("matched");
    expect(state.activeTiles.find((t) => t.id === "t2").state).toBe("matched");
  });

  it("returns incorrect for non-matching pair", () => {
    let state = setupWithTwoPairTiles();
    let result;
    ({ state, result } = selectTile(state, "t1"));
    ({ state, result } = selectTile(state, "t3"));
    expect(result).toBe("incorrect");
    expect(state.matchesIncorrect).toBe(1);
    expect(state.combo).toBe(0);
    expect(state.score).toBe(0);
    expect(state.selectedTileIds).toEqual([]);
    expect(state.activeTiles.find((t) => t.id === "t1").state).toBe("falling");
  });

  it("rejects same-side pair tiles as incorrect", () => {
    let state = setupWithTwoPairTiles();
    // Add two left-side tiles with same matchId (shouldn't happen normally, but test defense)
    state = {
      ...state,
      activeTiles: [
        ...state.activeTiles,
        { id: "t5", text: "Kansas", matchId: "pair-0", pairSide: "left", lane: 0, x: 12.5, fallDurationMs: 6000, state: "falling" },
      ],
    };
    let result;
    ({ state, result } = selectTile(state, "t1"));
    ({ state, result } = selectTile(state, "t5"));
    expect(result).toBe("incorrect");
  });

  it("ignores taps on matched tiles", () => {
    let state = setupWithTwoPairTiles();
    state = {
      ...state,
      activeTiles: state.activeTiles.map((t) =>
        t.id === "t1" ? { ...t, state: "matched" } : t
      ),
    };
    const { state: newState, result } = selectTile(state, "t1");
    expect(result).toBeNull();
    expect(newState.selectedTileIds).toEqual([]);
  });

  it("ignores taps when selection is locked", () => {
    let state = setupWithTwoPairTiles();
    state = { ...state, selectionLocked: true };
    const { result } = selectTile(state, "t1");
    expect(result).toBeNull();
  });

  it("combo builds across consecutive correct matches", () => {
    let state = setupWithTwoPairTiles();
    let result;

    // First correct match
    ({ state, result } = selectTile(state, "t1"));
    state = unlockSelection(state);
    ({ state, result } = selectTile(state, "t2"));
    expect(state.combo).toBe(1);
    expect(state.score).toBe(100); // x1

    state = unlockSelection(state);

    // Second correct match
    ({ state, result } = selectTile(state, "t3"));
    state = unlockSelection(state);
    ({ state, result } = selectTile(state, "t4"));
    expect(state.combo).toBe(2);
    expect(state.score).toBe(250); // 100 + 150 (x1.5)
  });

  it("combo resets after incorrect match", () => {
    let state = setupWithTwoPairTiles();
    let result;

    // Build combo with first correct match
    ({ state, result } = selectTile(state, "t1"));
    state = unlockSelection(state);
    ({ state, result } = selectTile(state, "t2"));
    expect(state.combo).toBe(1);

    state = unlockSelection(state);

    // Incorrect match: t3 (Texas/pair-1) + t4 is correct, so use t3 + a new unrelated tile
    state = {
      ...state,
      activeTiles: [
        ...state.activeTiles,
        { id: "t6", text: "Ohio", matchId: "pair-2", pairSide: "left", lane: 0, x: 12.5, fallDurationMs: 6000, state: "falling" },
      ],
    };
    ({ state, result } = selectTile(state, "t3"));
    state = unlockSelection(state);
    ({ state, result } = selectTile(state, "t6"));
    expect(result).toBe("incorrect");
    expect(state.combo).toBe(0);
  });
});

// ─── handleMissedTile ───────────────────────────────────────────────

describe("handleMissedTile", () => {
  it("marks tile as missed and resets combo", () => {
    let state = startGame(createGameState());
    state = {
      ...state,
      combo: 3,
      activeTiles: [
        { id: "t1", text: "Kansas", matchId: "pair-0", pairSide: "left", lane: 0, x: 12.5, fallDurationMs: 6000, state: "falling" },
        { id: "t2", text: "Topeka", matchId: "pair-0", pairSide: "right", lane: 1, x: 37.5, fallDurationMs: 6000, state: "falling" },
      ],
      activePairIds: ["pair-0"],
    };

    state = handleMissedTile(state, "t1");
    expect(state.activeTiles.find((t) => t.id === "t1").state).toBe("missed");
    expect(state.combo).toBe(0);
    expect(state.missedTiles).toBe(1);
    // Pair still active because partner exists
    expect(state.activePairIds).toContain("pair-0");
  });

  it("removes pair from activePairIds when both tiles are gone", () => {
    let state = startGame(createGameState());
    state = {
      ...state,
      activeTiles: [
        { id: "t1", text: "Kansas", matchId: "pair-0", pairSide: "left", lane: 0, x: 12.5, fallDurationMs: 6000, state: "missed" },
        { id: "t2", text: "Topeka", matchId: "pair-0", pairSide: "right", lane: 1, x: 37.5, fallDurationMs: 6000, state: "falling" },
      ],
      activePairIds: ["pair-0"],
    };

    state = handleMissedTile(state, "t2");
    expect(state.activePairIds).not.toContain("pair-0");
  });

  it("deselects the tile if it was selected", () => {
    let state = startGame(createGameState());
    state = {
      ...state,
      activeTiles: [
        { id: "t1", text: "Kansas", matchId: "pair-0", pairSide: "left", lane: 0, x: 12.5, fallDurationMs: 6000, state: "selected" },
      ],
      selectedTileIds: ["t1"],
      activePairIds: ["pair-0"],
    };

    state = handleMissedTile(state, "t1");
    expect(state.selectedTileIds).not.toContain("t1");
  });

  it("ignores already matched tiles", () => {
    let state = startGame(createGameState());
    state = {
      ...state,
      activeTiles: [
        { id: "t1", text: "Kansas", matchId: "pair-0", pairSide: "left", lane: 0, x: 12.5, fallDurationMs: 6000, state: "matched" },
      ],
      activePairIds: ["pair-0"],
      missedTiles: 0,
    };

    const newState = handleMissedTile(state, "t1");
    expect(newState.missedTiles).toBe(0);
  });
});

// ─── tick ───────────────────────────────────────────────────────────

describe("tick", () => {
  it("decrements timeRemaining", () => {
    let state = startGame(createGameState());
    state = tick(state, 1);
    expect(state.timeRemaining).toBe(59);
  });

  it("triggers gameOver when time reaches 0", () => {
    let state = startGame(createGameState());
    state = { ...state, timeRemaining: 1 };
    state = tick(state, 1);
    expect(state.timeRemaining).toBe(0);
    expect(state.status).toBe("gameOver");
  });

  it("does not go below 0", () => {
    let state = startGame(createGameState());
    state = { ...state, timeRemaining: 0.5 };
    state = tick(state, 1);
    expect(state.timeRemaining).toBe(0);
    expect(state.status).toBe("gameOver");
  });

  it("does nothing when game is not playing", () => {
    const state = createGameState(); // status: "ready"
    const newState = tick(state, 1);
    expect(newState.timeRemaining).toBe(60);
  });
});

// ─── cleanupTiles ───────────────────────────────────────────────────

describe("cleanupTiles", () => {
  it("removes matched and missed tiles", () => {
    let state = startGame(createGameState());
    state = {
      ...state,
      activeTiles: [
        { id: "t1", text: "Kansas", matchId: "pair-0", pairSide: "left", lane: 0, x: 12.5, fallDurationMs: 6000, state: "matched" },
        { id: "t2", text: "Topeka", matchId: "pair-0", pairSide: "right", lane: 1, x: 37.5, fallDurationMs: 6000, state: "matched" },
        { id: "t3", text: "Texas", matchId: "pair-1", pairSide: "left", lane: 2, x: 62.5, fallDurationMs: 6000, state: "falling" },
        { id: "t4", text: "Ohio", matchId: "pair-2", pairSide: "left", lane: 3, x: 87.5, fallDurationMs: 6000, state: "missed" },
      ],
      activePairIds: ["pair-0", "pair-1", "pair-2"],
    };

    state = cleanupTiles(state);
    expect(state.activeTiles.length).toBe(1);
    expect(state.activeTiles[0].id).toBe("t3");
    expect(state.activePairIds).toEqual(["pair-1"]);
  });
});

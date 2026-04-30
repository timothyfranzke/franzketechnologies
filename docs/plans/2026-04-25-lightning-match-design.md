# Lightning Match — Design Document

**Date:** 2026-04-25
**Status:** Approved
**Game:** Nifty Fifty (50 States & Capitals)

## Overview

Lightning Match is a new arcade-style game mode for the Nifty Fifty app. Words fall from the top of the screen as tiles. The player taps two falling tiles to match related pairs (e.g., "Kansas" + "Topeka"). Correct matches score points with a combo multiplier. Tiles that reach the bottom are lost. The game is timed at 60 seconds.

## Architecture & File Structure

### New file

- `src/lib/lightningMatchEngine.js` — Pure game logic (no React, no DOM)

### Modified files

- `src/components/StatesCapitalsGame.jsx` — Lightning Match UI components, leaderboard service, menu entry, Leaderboard screen update

### Separation of concerns

The engine exports pure functions that take state in and return new state out — no side effects. The React component owns the intervals/timers and calls engine functions.

**Engine responsibilities:**
- Game state management (create, update, tick)
- Tile spawning logic (lane selection, pair tracking, timing)
- Match evaluation (select tile, check pair)
- Scoring & combo math
- Difficulty scaling (speed + spawn rate every 15s)
- Game-over detection (timer expiry)

**Component responsibilities:**
- Render tiles with CSS fall animations
- Handle tap/click selection
- Display HUD (score, combo, timer)
- End screen + leaderboard submit flow
- Animation feedback (match success, match fail, tile missed)

## Game Engine API (`lightningMatchEngine.js`)

### Core functions

```
createGameState(category) → GameState
  - Initializes: score 0, combo 0, timeRemaining 60, 4 lanes, difficulty level 1

spawnTile(state, statesData) → { state, newTile }
  - Picks a word pair, determines lane (random of 4 with jitter)
  - Tracks which pairs are active to ensure a matchable pair exists
  - Returns both halves staggered (second half spawns 1-3 tiles later)
  - Avoids duplicate active pairs

selectTile(state, tileId) → { state, result }
  - Adds tile to selectedTileIds (max 2)
  - When 2 selected: evaluates match
  - result: null | "correct" | "incorrect"

evaluateMatch(state) → { state, matched, awarded }
  - Correct: removes tiles, awards baseScore * multiplier, increments combo
  - Incorrect: deselects both, resets combo to 0

handleMissedTile(state, tileId) → state
  - Removes tile, resets combo

tick(state, deltaSeconds) → state
  - Decrements timeRemaining
  - Checks game-over condition

getDifficultyParams(elapsedSeconds) → { fallDurationMs, spawnIntervalMs }
  - 0-15s:  fallDuration 6000ms, spawnInterval 2000ms
  - 15-30s: fallDuration 5000ms, spawnInterval 1700ms
  - 30-45s: fallDuration 4000ms, spawnInterval 1400ms
  - 45-60s: fallDuration 3500ms, spawnInterval 1200ms

getComboMultiplier(combo) → number
  - 0-1: x1, 2-3: x1.5, 4-5: x2, 6+: x3
```

### GameState shape

```
status          "ready" | "playing" | "gameOver"
score           number
combo           number
maxCombo        number
timeRemaining   number (seconds)
activeTiles     WordTile[]
selectedTileIds string[] (max 2)
matchesCorrect  number
matchesIncorrect number
missedTiles     number
usedPairIds     string[]
activePairIds   string[]
pendingSpawns   { pairId, side, spawnsUntil }[]
selectionLocked boolean
```

### WordTile shape

```
id          string
text        string
matchId     string (shared by both halves of a pair)
pairSide    "left" | "right"
lane        number (0-3)
x           number (lane center + jitter)
fallDuration number (ms, set at spawn time)
state       "falling" | "selected" | "matched" | "missed"
spawnedAt   number (timestamp for animation sync)
```

## Tile Spawning & CSS Animation

### Lanes

- Play area divided into 4 lanes
- Each tile assigned a lane index (0-3)
- X position = lane center + random jitter of ±12px
- Tile width sized to fit comfortably in a lane with gutters (~22% of play area width)

### Spawning logic

- A spawn interval fires based on current difficulty params
- Each spawn cycle picks a pair from STATES not currently active on screen
- First spawn: one side of the pair (e.g., "Kansas")
- 1-3 spawn cycles later: the other side (e.g., "Topeka")
- This guarantees a matchable pair is always available shortly after both halves appear
- Track `activePairIds` to prevent the same pair appearing twice simultaneously

### CSS falling animation

```css
@keyframes fall {
  from { transform: translateY(-60px); }
  to   { transform: translateY(calc(var(--play-height) + 60px)); }
}
```

- Each tile gets `animation: fall <duration>ms linear forwards`
- Duration comes from `getDifficultyParams()` (6000ms to 3500ms over 60s)
- `animationend` event triggers `handleMissedTile` — tile reached bottom
- Tiles use `position: absolute` within a relative play area container

### Tile visual states

- **Falling** — default appearance, paper-colored with ink text
- **Selected** — gold border/background highlight
- **Matched** — pop animation + fade out (reuse existing `.pop` keyframe)
- **Incorrect** — shake animation (reuse existing `.shake` keyframe), then deselect

Tiles are `<button>` elements for accessibility and tap handling.

## Categories

- **Capitals** — Tiles are state names and capital names (e.g., "Kansas" ↔ "Topeka")
- **Abbreviations** — Tiles are state names and abbreviations (e.g., "Kansas" ↔ "KS")
- Separate leaderboard categories, matching existing Speed and Reveal pattern
- Category selected on Home screen before starting

## UI Components & Screens

### New screen components

**`LightningConfig`** — Pre-game screen
- Game explanation: "Match falling word pairs before time runs out!"
- Category already selected from Home screen
- "Start" button
- "← Menu" back button

**`LightningGame`** — Main gameplay screen
- **HUD bar (top):** Score (left), Combo with multiplier badge (center), Timer countdown (right)
- **Play area:** Relative container, full remaining height. Falling tile buttons inside.
- **Timer bar:** Thin animated bar across top of play area, depletes over 60s. Turns rust at ≤10s.
- **Combo popup:** Brief floating "+150 x2" text near matched tiles on correct match, fades out
- **Countdown intro:** Reuse the existing "3-2-1-GO" countdown animation from Speed mode

**`LightningEnd`** — Game over screen
- Final score (large, display font)
- Rating stamp (reuse existing stamp pattern)
- Stats strip: Correct / Incorrect / Missed / Max Combo
- Leaderboard submit flow (reuse existing pattern: saved nicknames picker → input → profanity filter → submit to `lightning-scores`)
- "Run It Back" button (restart same category)
- "← Menu" button

### Modified screens

**Home** — Add "Lightning Match" card to Games section with brief description

**Leaderboard** — Replace two-tab toggle with dropdown: "60-Second Dash" / "Letter by Letter" / "Lightning Match"

## Scoring

- Base score per correct match: 100 points
- Combo increments by 1 after each correct match
- Multiplier tiers: 0-1 → x1, 2-3 → x1.5, 4-5 → x2, 6+ → x3
- Awarded = 100 * multiplier (max 300 per match at 6+ combo)
- Incorrect match: combo resets to 0, no point penalty
- Missed tile: combo resets to 0, no point penalty
- Track `maxCombo` throughout for end screen display

## Difficulty Ramp

Every 15 seconds, difficulty increases. New tiles use current params at spawn time. Already-falling tiles keep their original speed.

| Elapsed | Fall duration | Spawn interval |
|---------|--------------|----------------|
| 0-15s   | 6000ms       | 2000ms         |
| 15-30s  | 5000ms       | 1700ms         |
| 30-45s  | 4000ms       | 1400ms         |
| 45-60s  | 3500ms       | 1200ms         |

## Edge Cases

- **Selecting a matched/animating tile:** Ignore taps on tiles in "matched" or "missed" state
- **Selecting the same tile twice:** Deselect it (toggle behavior)
- **Rapid tapping during evaluation:** Lock selection briefly (~300ms) while match/fail animation plays
- **No valid match on screen:** Spawning logic ensures the second half of at least one pair is always queued. If only orphan tiles exist, force-spawn the missing half next cycle.
- **Screen full of tiles:** Cap active tiles at ~12. If at cap, skip spawning until tiles clear.
- **Category handling:** Capitals pairs = state name ↔ capital name. Abbreviations pairs = state name ↔ abbreviation.

## Leaderboard

- New Firestore collection: `lightning-scores`
- Document shape: `{ name, score, category, timestamp }` (matches existing pattern)
- New `lightningLeaderboard` service object following existing `leaderboard` / `revealLeaderboard` pattern
- Submit flow reuses existing nickname picker + profanity filter + duplicate submission prevention

## Testing

### Unit tests for `lightningMatchEngine.js`

- `createGameState` returns correct initial values
- `selectTile` with matching pair → correct result, score increases, combo increments
- `selectTile` with non-matching pair → incorrect result, combo resets to 0
- `getComboMultiplier` returns correct values at each tier boundary
- `handleMissedTile` removes tile and resets combo
- `spawnTile` avoids duplicate active pairs
- `spawnTile` ensures second half of pair is queued
- `getDifficultyParams` returns correct values at each 15s threshold
- `tick` decrements timer and triggers game-over at 0
- Active tile cap respected (no spawn when ≥12 tiles)

### Acceptance criteria

1. Lightning Match appears on Home menu
2. Pre-game screen shows, Start begins countdown
3. Tiles fall from top in 4 lanes
4. Tapping a tile selects it (visual highlight)
5. Tapping a second tile evaluates the match
6. Correct match: tiles pop + disappear, score/combo update
7. Incorrect match: tiles shake + deselect, combo resets
8. Tiles reaching bottom disappear (animationend)
9. Timer counts down from 60, bar depletes
10. Difficulty increases every 15s (faster tiles, more frequent spawns)
11. Game ends at timer 0, end screen shows stats
12. Can submit score to leaderboard (with profanity filter)
13. Cannot submit same game result twice
14. "Run It Back" restarts, "Menu" returns home
15. Leaderboard dropdown shows all three games
16. Works on mobile (tappable tiles, readable text)

# Simon States — Design Document

**Date:** 2026-04-29
**Status:** Approved
**Game:** Nifty Fifty (50 States & Capitals)

## Overview

Simon States is a memory-chain game mode inspired by the classic Simon electronic game. A sequence of states flashes one at a time. The player must then recall the capital (or abbreviation) for each state in order by picking from 4 multiple-choice options. Each round adds one new state to the sequence. The game continues until the player picks the wrong answer. Score is the highest round completed.

## Core Game Flow

Each round has three phases:

1. **Watch phase** — States from the sequence flash on screen one at a time (~1.5s each). The player watches. No interaction allowed.
2. **Recall phase** — "Your Turn!" appears. States are shown one at a time in sequence order. For each state, 4 answer options appear (1 correct + 3 distractors). The player picks one.
3. **Result phase** — If all correct: brief "Round X complete!" celebration, then the next round starts (same sequence + 1 new state appended). If wrong: game over immediately.

Round 1 starts with 1 state. The theoretical max is 50 rounds (all 50 states used). States are randomly selected without repeats across the entire game.

## Architecture & File Structure

### New files

- `src/lib/simonStatesEngine.js` — Pure game logic (no React, no DOM)
- `src/lib/simonStatesEngine.test.js` — Unit tests for the engine

### Modified files

- `src/components/StatesCapitalsGame.jsx` — Simon States UI components (SimonConfig, SimonGame, SimonEnd), menu entry, leaderboard dropdown update

### Separation of concerns

The engine exports pure functions that take state in and return new state out — no side effects. The React component owns the timers and animation sequencing and calls engine functions.

**Engine responsibilities:**
- Game state management (create, start round, advance)
- Sequence building (random state selection, no duplicates)
- Answer evaluation (correct/incorrect)
- Option generation (1 correct + 3 distractors)

**Component responsibilities:**
- Watch phase animation (flashing states with timing)
- Recall phase UI (state display, answer buttons)
- Transition animations (Your Turn, Round Complete, Game Over)
- Countdown intro (reuse existing 3-2-1-GO)
- End screen + leaderboard submit flow

## Game Engine API (`simonStatesEngine.js`)

### Core functions

```
createGameState(category) → GameState
  - Initializes: round 0, empty sequence, phase "ready", currentIndex 0

startRound(state, statesData) → state
  - Increments round
  - Picks a new random state not already in the sequence
  - Appends to sequence
  - Sets phase to "watching", currentIndex to 0

advanceWatch(state) → state
  - Increments currentIndex by 1
  - When currentIndex exceeds last sequence item: sets phase to "recalling",
    resets currentIndex to 0

submitAnswer(state, answerId) → { state, correct }
  - Checks if selected answer matches current sequence item's capital/abbreviation
  - If correct and more items remain in sequence: advance currentIndex
  - If correct and sequence complete: phase → "roundComplete", update highestRound
  - If wrong: status → "gameOver", record the failed state/capital

generateOptions(state, statesData) → string[]
  - Returns 4 shuffled options for the current sequence item
  - 1 correct answer + 3 random distractors
  - Distractors are pulled from states NOT in the current sequence to avoid confusion
```

### GameState shape

```
status          "ready" | "countdown" | "playing" | "gameOver"
phase           "watching" | "recalling" | "roundComplete"
round           number
sequence        { state, capital, abbreviation }[]
currentIndex    number (position in sequence during watch/recall)
category        "capitals" | "abbreviations"
highestRound    number
failedItem      { state, capital, abbreviation } | null  (the one they got wrong)
selectedAnswer  string | null  (what they picked when wrong)
```

## Categories

- **Capitals** — States flash during watch phase; during recall, player picks the capital from 4 options
- **Abbreviations** — States flash during watch phase; during recall, player picks the abbreviation from 4 options
- Separate leaderboard categories, matching existing patterns

## UI Components & Screens

### New screen components

**`SimonConfig`** — Pre-game screen
- Game explanation: "Watch the sequence, then recall each capital in order. How long can you keep the chain going?"
- Category already selected from Home screen
- "Start" button → triggers 3-2-1-GO countdown (reuse existing)
- "← Menu" back button

**`SimonGame`** — Main gameplay screen
- **HUD bar (top):** Current round number (left), highest round this session (right)
- **Center stage:** Large state name display area
- **Watch phase:** State names appear one at a time with a flash/pulse animation (~1.5s per state). Sequence indicator dots at the bottom show how many states are in the current sequence and which one is currently flashing.
- **"Your Turn!" transition:** Brief animated prompt between watch and recall phases
- **Recall phase:** Current state name shown prominently at top. 4 answer buttons displayed below. Correct answer → checkmark animation, then next state slides in. Wrong answer → shake animation, then game over transition.
- **Round complete:** "Round X complete!" brief celebration (~1.5s), then next round auto-starts

**`SimonEnd`** — Game over screen
- "Round X" displayed large (the score/highest round reached)
- The state and correct answer they missed shown as "the one that got away"
- What the player incorrectly selected shown for learning
- Rating stamp (reuse existing stamp visual pattern)
- Leaderboard submit flow (reuse existing: saved nicknames picker → input → profanity filter → submit to `simon-scores`)
- "Try Again" button (restart same category)
- "← Menu" button

### Modified screens

**Home** — Add "Simon States" card to Games section with brief description and memory/brain icon

**Leaderboard** — Add "Simon States" option to the existing dropdown alongside other game modes

## Scoring

- Score = highest round completed
- Round 1 means the player recalled 1 state's capital correctly
- Round 50 is the theoretical maximum (all states)
- Leaderboard ranks by score descending, then timestamp ascending (earlier = better for ties)

## Rating Stamps

Based on highest round reached:

| Round    | Rating         |
|----------|----------------|
| 1-3      | Beginner       |
| 4-7      | Getting There  |
| 8-12     | Sharp Mind     |
| 13-19    | Memory Master  |
| 20+      | Legendary      |

## Timing & Animation

- **Watch phase flash duration:** ~1.5s per state (state visible ~1.2s, brief gap ~0.3s)
- **"Your Turn!" prompt:** ~1s display before recall begins
- **Recall phase:** No time pressure — player takes as long as they need
- **Correct answer feedback:** ~0.5s checkmark animation before next state
- **Round complete celebration:** ~1.5s before next round starts
- **Countdown intro:** Reuse existing "3-2-1-GO" animation from Speed mode

## Leaderboard

- New Firestore collection: `simon-scores`
- Document shape: `{ name, score, category, timestamp }`
- `score` is the highest round reached (integer)
- Ordered by `score` descending, then `timestamp` ascending
- Submit flow reuses existing nickname picker + profanity filter + duplicate submission prevention
- Leaderboard dropdown updated to include "Simon States"

## Edge Cases

- **Round 50 (all states used):** If the player completes all 50 rounds, the game ends in victory. Special "Perfect Game" end screen.
- **Distractor selection:** Distractors must not include capitals/abbreviations from other states in the current sequence (to prevent confusion about which state is being asked).
- **Rapid tapping:** Answer buttons disabled briefly (~300ms) after selection while feedback animation plays.
- **Category handling:** Capitals mode → answer options are capital names. Abbreviations mode → answer options are state abbreviations.
- **Same distractors across rounds:** Distractors are regenerated fresh each time a state is shown during recall, so they may differ between rounds for the same state.

## Testing

### Unit tests for `simonStatesEngine.js`

- `createGameState` returns correct initial values (round 0, empty sequence, "ready" status)
- `startRound` increments round and adds a new unique state to sequence
- `startRound` never adds a duplicate state
- `advanceWatch` increments currentIndex during watch phase
- `advanceWatch` transitions to "recalling" phase after last sequence item
- `submitAnswer` with correct answer advances currentIndex
- `submitAnswer` with correct answer on last item → phase "roundComplete"
- `submitAnswer` with wrong answer → status "gameOver", failedItem populated
- `generateOptions` returns exactly 4 options
- `generateOptions` includes the correct answer
- `generateOptions` distractors are not from the current sequence
- All 50 states can be added to sequence without error (round 50 edge case)

### Acceptance criteria

1. Simon States appears on Home menu
2. Pre-game screen shows, Start begins countdown
3. Round 1: one state flashes, "Your Turn!", 4 options shown, pick correct capital
4. Round 2: two states flash in sequence, then recall both in order
5. Correct answers show checkmark animation before advancing
6. Wrong answer immediately ends the game with shake animation
7. End screen shows highest round reached
8. End screen shows the missed state/capital
9. Rating stamp displayed based on round thresholds
10. Can submit score to leaderboard (with profanity filter)
11. Cannot submit same game result twice
12. "Try Again" restarts, "Menu" returns home
13. Leaderboard dropdown includes Simon States
14. Both Capitals and Abbreviations categories work
15. Sequence indicator dots show progress during watch phase
16. Works on mobile (tappable buttons, readable text)
17. Round 50 victory handled gracefully

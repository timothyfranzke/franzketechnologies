# Nifty Fifty — Matching Game & Flashcard Enhancements Design

## Overview

Add a memory-style matching game mode, improve flashcard UX with filtering and skip, and introduce persistent per-state accuracy tracking via localStorage.

## Flashcard Improvements

### Filter Toggle

Pill toggle at the top of the flashcard screen: **All** | **Don't Know Only**.

- "Don't Know Only" filters the deck to cards marked "Don't Know" in the current session
- If no cards are missed yet, the toggle is disabled with a hint
- Filtering applies immediately, resets deck index to 0

### Skip Button

Small "Skip" link centered between "Don't Know" and "Know It" buttons.

- Advances to the next card without recording any judgment
- Card stays in its current bucket (or uncategorized if first seen)
- Skipped cards do not enter the retry queue
- Allows free browsing without forced commitment

## Matching Game

### Home Screen

New fifth mode card after Flashcards:

- **Title:** Match
- **Description:** Classic memory game. Flip and find pairs.
- **Icon:** pair symbol
- **Color:** var(--gold)

Content type (Capitals/Abbreviations) inherited from the home screen category tabs.

### Config Screen

Shown when Match is selected. A view within the game (not a separate page).

**Card count** — Four pill buttons: 8, 12, 16, 20 (4, 6, 8, or 10 pairs). Defaults to 12.

**Card source** — Three options:

- **Random** — Random states from the full 50
- **By Region** — Sub-options: South, West, Midwest, Northeast. Pulls from that region. Pads with random extras if region has fewer states than card count requires.
- **Weak Areas** — States with lowest localStorage accuracy scores. Pads with random if not enough weak states. Disabled with hint if fewer than 5 states have history.

"Start" button launches the game.

Styled in game's paper/ink/stamp aesthetic — pill buttons match category tabs, config card uses rounded-2xl + box-shadow.

### Board & Mechanics

Grid layout by card count:

- 8 cards: 4x2
- 12 cards: 4x3
- 16 cards: 4x4
- 20 cards: 5x4

Each pair: one State card + one Capital/Abbreviation card. All shuffled randomly on the grid.

**Gameplay flow:**

1. Tap card to flip face-up (animated flip)
2. Tap second card to reveal
3. Match: both stay face-up, sage/green background, pop animation
4. No match: both show for 1 second, flip back, shake animation
5. Game ends when all pairs matched

**Card appearance:**

- Face-down: Paper background, decorative star/element in ink
- State cards face-up: Paper background, state name in ink, small "State" label
- Answer cards face-up: Ink background, capital/abbreviation in cream, small label

**Header:** Back button, move counter ("12 moves"), timer counting up (mm:ss).

**End screen:** Total moves, time taken, stamp rating based on efficiency (moves relative to minimum possible moves = number of pairs).

## Persistent Stats (localStorage)

### Data Shape

```js
// localStorage key: "nifty-fifty-stats"
{
  "Kansas": { correct: 12, wrong: 3 },
  "Ohio": { correct: 2, wrong: 8 }
}
```

### What Records Stats

- Quiz: correct/wrong answers
- Type It: correct/wrong answers
- Speed: correct/wrong answers
- Flashcards: "Know It" = correct, "Don't Know" = wrong
- Matching game: does NOT record (spatial memory, not knowledge)

### Weak Areas Calculation

- Accuracy = correct / (correct + wrong) per state
- States with no history excluded
- Sort by accuracy ascending, take needed count
- Minimum 5 states with history required to enable "Weak Areas" option

### statsStore Utility

```js
const statsStore = {
  record(stateName, correct) { ... },
  getWeakest(count) { ... },
  getAccuracy(stateName) { ... },
}
```

Wraps localStorage with JSON parse/stringify. All modes call `statsStore.record()` alongside existing session `recordResult()`.

## Files Changed

- `src/components/StatesCapitalsGame.jsx` — all game logic changes

# Nifty Fifty — Progress Map & Enhanced Stats Design

## Overview

Add a US map visualization showing per-state knowledge confidence, and upgrade the statsStore to track current status, history, and confidence per state. The map serves as both a progress tracker and study guide.

## Enhanced statsStore

### New Data Shape

```js
// localStorage key: "nifty-fifty-stats"
{
  "Kansas": {
    status: "know",           // "know" | "dontknow" | null
    correct: 12,              // all-time count
    wrong: 3,                 // all-time count
    lastSeen: 1713400000000,  // timestamp
    history: [                // last 10, newest first
      { r: true, m: "quiz", t: 1713400000000 },
      { r: false, m: "flash", t: 1713390000000 }
    ]
  }
}
```

History entries use short keys: `r` (result bool), `m` (mode string), `t` (timestamp). Mode values: "quiz", "type", "speed", "flash".

### Migration

When the app reads statsStore and finds old shape (no `status` or `history`), auto-migrate:
- Set `status` to accuracy >= 50% ? "know" : "dontknow"
- Create empty `history` array
- Keep existing `correct`/`wrong` counts
- Transparent, happens once on read

### Updated record() Function

`statsStore.record(stateName, correct, mode)` now:
- Updates `status` to "know" or "dontknow" based on result
- Increments correct/wrong count
- Sets `lastSeen` to `Date.now()`
- Prepends to `history`, caps at 10 entries
- Accepts mode string ("quiz", "type", "speed", "flash")

### Confidence Calculation

```js
getConfidence(stateName) → number 0-1
```

Look at last 10 history entries. `confidence = correctInHistory / historyLength`. If no history, fall back to `correct / (correct + wrong)`. If no data at all, return null (unseen).

### Updated Utility Methods

```js
statsStore.getStatus(stateName) → "know" | "dontknow" | null
statsStore.getHistory(stateName) → array of last 10
statsStore.getAllStats() → full data object for map rendering
```

## Home Screen

New link near the leaderboard link — map pin icon with "My Progress". Opens the progress map screen.

## Progress Map Screen

### Layout

- Header: Back button + "My Progress" title
- Summary strip: "32/50 tested · 24 know · 8 don't know · 18 unseen"
- US SVG map, full width, states colored by confidence tier
- Legend below map with 5 color swatches
- Detail card below legend (shown when a state is tapped)

### SVG Map

Inline US states SVG with each state as a `<path>` identified by two-letter abbreviation (`id="KS"`). Alaska and Hawaii as insets below-left. Standard public domain outline.

### Color Tiers

| Status | Confidence | Color | Hex | Meaning |
|--------|-----------|-------|-----|---------|
| know | 80%+ | dark sage | #4A7A4F | Solid knowledge |
| know | <80% | light sage | #8DB891 | Knows but shaky |
| dontknow | 30%+ | light rust | #D4836A | Getting closer |
| dontknow | <30% | dark rust | #C14A33 | Consistently wrong |
| unseen | — | faded paper | #DDD4BE | Not yet tested |

### Tap Interaction

Tapping a state highlights it (darker stroke) and shows a detail card:

- State name, capital, abbreviation
- Status badge: "Know" (green), "Don't Know" (red), or "Not Tested" (gray)
- Accuracy: "12 correct, 3 wrong (80%)"
- Last seen: relative time
- Recent trend: last 5 dots (green/red circles) showing recent history

### Legend

Five colored circles with labels: Solid / Shaky / Getting There / Weak / Not Tested

## Files Changed

- `src/components/StatesCapitalsGame.jsx` — enhanced statsStore, all record() call sites updated with mode param, progress map component, home screen link

# Fifty & Capitals — Game Enhancements Design

## Overview

Enhance the 50 States & Capitals game with new content modes, improved flashcard tracking, and a dedicated OG image.

## Data Changes

Add abbreviation field to the `STATES` array:

```js
{ s: "Kansas", c: "Topeka", a: "KS", r: "Midwest" }
```

All 50 entries get the `a` field.

## Home Screen

### Category Tabs

Pill-style toggle above the mode cards: **Capitals** | **Abbreviations**

- Styled in the game's ink/paper/stamp aesthetic
- Selection determines which content type all game modes use
- Defaults to "Capitals"

### Direction Toggle

Sits below the category tabs. A small labeled toggle:

- Capitals tab: "State → Capital" or "Capital → State"
- Abbreviations tab: "State → Abbreviation" or "Abbreviation → State"
- Defaults to forward (State as question)

Both selections pass as props (`category`, `direction`) into whichever game mode the user picks. The four mode cards remain unchanged.

## Shared Helper

```js
function getQuestionAnswer(state, category, direction) {
  // Returns { question, answer, questionLabel, answerLabel }
  // category: "capitals" | "abbreviations"
  // direction: "forward" | "reverse"
}
```

All four game modes use this helper instead of accessing `state.s` / `state.c` / `state.a` directly. Single place to add future categories.

## Flashcard Enhancements

### Button Layout

Replace Prev/Next with:

- **"Don't Know It"** (left) — rust-colored, marks card as missed, advances
- **"Know It"** (right) — sage/green-colored, marks card as known, advances

Card flip still works via tap on the card itself.

### Retry Queue

1. First pass through all 50 cards (shuffled)
2. Cards marked "Don't Know It" collect in a retry queue
3. After completing the deck, reshuffle retry queue as the new deck
4. Repeat until all cards marked "Know It" or user exits

### End Summary

Shown when all cards are "Know It" or user taps back:

- Total cards: 50
- Knew on first pass: X
- Needed review: Y
- Stamp-style rating based on first-pass accuracy

No persistence across sessions.

## Game Mode Adaptations

### Quiz (Multiple Choice)

Question shows state, capital, or abbreviation based on direction. Four answer options drawn from the matching answer pool.

### Type It

Same adaptation. Extend `normalize()` to handle abbreviation input:

- Case-insensitive ("ks" matches "KS")
- Optional periods ("K.S." matches "KS")

### 60-Second Dash

Same as Quiz adaptation with the 2x2 answer grid.

### Flashcards

Front shows question, back shows answer. "Know It" / "Don't Know It" buttons work identically regardless of content type.

## OG Image

Static 1200x630 PNG at `public/og-50-states.png`.

### Design

- **Background:** Cream (#F3E8D2) with subtle paper texture
- **Title:** "Fifty & Capitals" in Fraunces bold/black, ink color (#1A2537). "& Capitals" in rust italic — mirrors the in-game title
- **Subtitle:** "A Geography Game — 50 States, 4 Modes" in JetBrains Mono, small uppercase, wide tracking
- **Stamp:** Rotated rust-bordered stamp: "★ TEST YOUR KNOWLEDGE ★"
- **Attribution:** "franzketechnologies.com" in dusty color, bottom-right corner

### Integration

Add `og:image` meta tag to the game page `<head>` pointing to `/og-50-states.png`.

## Files Changed

- `src/components/StatesCapitalsGame.jsx` — all game logic changes
- `src/pages/games/50-states.astro` — add og:image meta tag
- `public/og-50-states.png` — new static asset

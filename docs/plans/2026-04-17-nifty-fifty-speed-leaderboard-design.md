# Nifty Fifty — Speed Leaderboard Design

## Overview

Add a Firebase-backed leaderboard for the 60-Second Dash mode. Players submit scores with a persistent nickname. Scores are filtered by category (Capitals vs Abbreviations). The leaderboard is accessible from both the speed end screen (submit) and the home screen (browse).

## Firebase Setup

**Firestore collection:** `speed-scores`

**Document shape:**
```js
{
  name: "Tim",              // nickname (3-15 chars)
  score: 24,                // correct answers in 60s
  category: "capitals",     // or "abbreviations"
  timestamp: serverTimestamp
}
```

**Indexes:** Composite index on `category` (asc) + `score` (desc) + `timestamp` (asc). Firebase auto-prompts on first query.

**Query:** Top 20 per category, ordered by score descending then timestamp ascending (earlier = tiebreaker). Simple `getDocs`, no real-time listeners.

## Nickname

Stored in localStorage under `nifty-fifty-nickname`.

- First submission: inline input appears (3-15 chars) before posting
- Subsequent submissions: auto-used, posted immediately
- Can be changed from the leaderboard screen
- Changing nickname does NOT update past scores

## Speed End Screen Changes

Existing end screen unchanged. Two additions after the stamp rating, before the action buttons:

**Submit button:** "Post to Leaderboard" — if no nickname, expands inline input first. After posting, changes to "Posted!" with rank display ("You're #7 on Capitals"). Disabled after posting. Hidden if score is 0.

## Leaderboard Screen

**Home screen access:** Small trophy link below the mode cards, above the footer text.

**Layout:**
- Header: Back button + "Leaderboard" title
- Category tabs: Capitals | Abbreviations (pill toggle, same style as home)
- Score list: Top 20, each row shows rank, name, score, relative time
- Own entries highlighted with subtle background tint
- Empty state: "No scores yet. Be the first!"

**Rank styling:**
- #1: gold accent
- #2: dusty accent
- #3: rust accent
- Rest: standard ink

**Nickname management:** Edit icon next to your name on the board, or "Set Nickname" link at the bottom. Opens inline input.

## Files Changed

- `.env` — Firebase config (not committed, added to .gitignore)
- `src/components/StatesCapitalsGame.jsx` — Firebase init, leaderboard components, speed end screen changes, home screen link
- `package.json` — firebase dependency

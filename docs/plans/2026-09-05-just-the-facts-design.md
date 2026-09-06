# Just the Facts — Multiplication Facts Game Design

## Overview

Just the Facts is a quick-response multiplication game for 4th graders covering
every fact from 1×1 through 12×12. It is a sibling to Nifty Fifty (the 50 States
game) and lives at `/games/just-the-facts` as an installable PWA.

The first version is deliberately small: one adaptive round type, a keypad for
input, a 12×12 mastery grid for progress, and local-only storage. No leaderboard,
no profiles, no mode menu.

## Decisions

| Question | Decision |
|---|---|
| Scope | Focused core: one adaptive round mode plus progress grid |
| Input | On-screen 0–9 keypad; exact match advances, ✓ submits, backspace corrects |
| Fact selection | Adaptive only, weighted sampling by weakness |
| Round shape | 20 facts, ~3-second window per fact, total time reported |
| On a miss | Flash the correct answer briefly, move on |
| Progress | 12×12 color-coded mastery grid on the home screen |
| Players | Single learner, no profiles |
| Visuals | Sibling look to Nifty Fifty: same fonts, own accent color |

## Architecture and Files

Unlike Nifty Fifty's single large component, game logic lives in a pure engine
module so it can be unit-tested without React, following the pattern already
used by `lightningMatchEngine.js` and `simonStatesEngine.js`.

New files:

- `src/pages/games/just-the-facts.astro` — page shell: meta tags, manifest link,
  service worker registration, back-to-site link. Copied from `50-states.astro`
  and re-pointed.
- `src/lib/justTheFactsEngine.js` — pure functions: fact records, classification,
  weighting, round sampling, grading, applying results. No DOM, React, or storage.
- `src/lib/justTheFactsEngine.test.js` — Vitest unit tests for the engine.
- `src/components/JustTheFactsGame.jsx` — React component: screens, keypad,
  timer bar, grid. Owns localStorage persistence via a small load/save pair.
- `public/games/just-the-facts-manifest.json`, `just-the-facts-sw.js`, icon PNGs
  and SVG source — PWA assets mirroring the Nifty Fifty set with the cache name,
  start URL, and theme color changed.

### Storage

One localStorage key, `just-the-facts-stats`, holding:

```js
{
  roundNumber: 12,
  sound: false,
  facts: { "3×7": { ...record }, ... }
}
```

Fact keys are canonical `"a×b"` with `a <= b`, so 7×8 and 8×7 share one record.
Rounds display either order at random. That gives 78 records covering all 144
grid cells; the grid mirrors across the diagonal.

### Screens

1. **Home** — title, mastery grid, fast-fact count, Start, sound toggle.
2. **Round** — fact, typed answer, timer bar, keypad.
3. **Round end** — time, counts, missed and slow facts, stamp, Again / Home.
4. **Fact detail sheet** — opens from a grid cell; stats plus "Drill this".

## Engine

All engine functions are pure over a `stats` map and an injected random source,
so tests can pass a seeded random.

### Fact record

```js
{ attempts, correct, fastCorrect, avgMs, lastRound, streak }
```

- `streak` — consecutive fast-correct answers; resets to 0 on a miss or slow answer.
- `avgMs` — exponential moving average of response time on correct answers, so
  a kid who has sped up is not held back by old slow times.

### Classification

Used by both the grid colors and the weighting.

- `unseen` — no attempts
- `struggling` — last answer was a miss, or correct rate under 60%
- `slow` — correct but `avgMs` over 3000 ms, or `streak` under 3
- `fast` — `streak` of 3 or more

### Weighting and sampling

Weights: struggling 8, unseen 5, slow 3, fast 1. Facts seen in the previous
round have their weight halved so the same fact does not lead two rounds in a
row. `sampleRound(stats, count, random)` draws `count` facts without
replacement by weight. If fewer than `count` non-fast facts exist, the remainder
fills from fast facts, so early rounds are broad and later rounds become a
quick maintenance sweep.

"Drill this" from the detail sheet builds a 10-fact round from the chosen fact
plus its neighbors in the same family, bypassing adaptive selection. This is
the only manual override.

### Grading

`gradeAnswer(fact, typed, elapsedMs)` returns `"fast"`, `"slow"`, or `"wrong"`.

- The fast window is a constant `FAST_MS = 3000`.
- Timeout at `TIMEOUT_MS = 6000` grades as `"wrong"` with no typed value.

### Round record and applying results

```js
{ facts: [...], results: [...], totalMs, fastCount, slowCount, wrongCount }
```

`applyRound(stats, round, roundNumber)` is the only function that changes
records. It returns a new stats map rather than mutating, updating attempts,
correct, fastCorrect, avgMs, lastRound, and streak for each fact.

## Round Screen and Keypad

### Layout

Portrait, phone or tablet. Top: "7 of 20" counter. Center: the fact large in
Fraunces (`7 × 8`), the typed answer beneath in JetBrains Mono, a timer bar
below that. Bottom third: a 3×4 keypad with 0–9, backspace, and a teal ✓
submit key.

### Input and submit

Digits only build the number (up to three digits, since 144 is the largest
product). After each digit, compare the typed string to the answer:

- Exact match → correct, advance on its own. No extra tap for a right answer.
- Anything else → stays on screen. The kid can backspace and fix it.

The ✓ key (or Enter) submits whatever is typed as the final answer. Because a
correct answer has already advanced, anything submitted with ✓ is graded as a
miss and the answer flashes. An empty ✓ does nothing. The timeout still ends a
fact the kid never resolves.

Taps in the first 150 ms after a new fact appears are ignored, so a late tap on
the previous fact cannot become a stray digit on the next one.

_Revised 2026-09-05: the first cut graded a non-prefix digit wrong immediately,
which made a single mistyped digit end the fact. Phone testing showed kids need
to correct._

### Timer

A bar shrinks over the fast window using a CSS transition restarted per fact.
Elapsed time is measured in JS from fact display to final keystroke, not from
the animation, so frame jitter cannot affect grading. Past 3 seconds the bar
turns amber but the fact stays up. At 6 seconds it times out as wrong.

### Feedback

- Fast-correct: green tick, short pop.
- Slow-correct: amber tick, no pause.
- Wrong or timeout: fact line becomes `7 × 8 = 56` with the answer in the
  struggling color, holds 1.2 seconds with the keypad ignoring input, then
  the next fact appears.
- Optional keypad click and result sounds via Web Audio, off by default,
  toggled on the home screen, saved in stats.

## Home, Grid, End Screen, Visuals

### Home

Title "Just the Facts" in Fraunces, subtitle "Multiplication, 1 through 12",
the 12×12 mastery grid, a count line ("41 of 78 facts fast"), a large Start
button, and a sound toggle. Row and column headers 1–12. Cell colors: gray
unseen, rust struggling, gold slow, green fast. Mirrored across the diagonal.

### Fact detail sheet

Tapping a cell slides up a sheet with the fact and answer, attempts, accuracy,
average time, streak, and a "Drill this" button (10-fact family round).

### End screen

Total time; fast, slow, and missed counts; a list of missed and slow facts with
answers; a stamp rating in the Nifty Fifty style ("Lightning" for 20 fast,
"Solid" for no misses, "Keep going" otherwise); a callout for facts newly
promoted to fast this round; "Again" and "Home" buttons.

### Visuals

Same Fraunces, Manrope, and JetBrains Mono stack as Nifty Fifty, same ink and
paper base. Accent shifts from gold to teal or green so the two games read as
siblings with distinct identities. A faint grid-paper texture on the background
as the math motif. Manifest theme color matches the new accent.

## Testing

### Engine unit tests (Vitest, seeded random)

- Classification at each threshold boundary.
- Weight computation including previous-round damping.
- Sampling never repeats a fact within a round.
- Sampling respects weights over many draws.
- Fill from fast facts when non-fast facts run short.
- Grading: exact, prefix, non-prefix, same-length-wrong, timeout.
- `applyRound` returns a new map with correct streak and moving-average updates.

### Component

One smoke test renders home, starts a round, taps a correct answer via the
keypad, and reaches the end screen.

### Manual

Keypad size and timer feel on a phone; PWA install and offline load.

## Rollout

Add to the site's games listing if one exists; otherwise leave unlinked like
the states game until it is ready to share.

## Out of Scope (for now)

Leaderboard, profiles or sync, division facts, multiple choice mode, spaced
repetition scheduling, fact-family unlock ladder.

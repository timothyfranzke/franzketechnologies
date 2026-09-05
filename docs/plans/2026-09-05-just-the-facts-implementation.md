# Just the Facts — Implementation Plan

**Design:** `docs/plans/2026-09-05-just-the-facts-design.md`
**Branch:** `worktree-just-the-facts` (worktree at `.claude/worktrees/just-the-facts`)
**Template:** Nifty Fifty — `src/pages/games/50-states.astro`, `src/components/StatesCapitalsGame.jsx`, `public/games/nifty-fifty-*`

## Constraints discovered in the repo

- Vitest is configured in `vitest.config.js` (automatic JSX). There is no `npm test` script; run `npx vitest run`. Component tests need `// @vitest-environment happy-dom` at the top of the file (see `src/components/ledger/__tests__/app.smoke.test.jsx`).
- Engine modules under `src/lib/` (`simonStatesEngine.js`, `lightningMatchEngine.js`) are pure and tested with plain `describe/it/expect`. Follow that style; export internals for tests under a `_testing` object if needed.
- Nifty Fifty's design tokens are CSS variables declared inside the component's injected `<style>`: `--paper #EADFC6`, `--ink #1A2537`, `--rust #C14A33`, `--rust-dark #9A3825`, `--gold #D9A441`, `--dusty #8A7E68`. Fonts load from Google Fonts (Fraunces, Manrope, JetBrains Mono) in that same style block. Reuse the same approach and the same font URL.
- Do **not** import `src/lib/firebase.js`; it initializes Firebase on import and this game has no leaderboard.
- `@resvg/resvg-js` is already a dependency; use a one-off node script in the scratchpad to rasterize the icon SVG to 192 and 512 PNGs.
- The only link to the states game is the footer nav array in `src/components/Footer.astro`.

## Design tokens

| Token | Value | Use |
|---|---|---|
| `--paper` | `#EADFC6` | page background (shared with Nifty Fifty) |
| `--ink` | `#1A2537` | text, borders, hard shadows |
| `--teal` | `#1F7A6D` | accent: Start button, fast cells, ticks |
| `--teal-dark` | `#155A50` | pressed accent, hover |
| `--gold` | `#D9A441` | slow cells, amber timer, slow tick |
| `--rust` | `#C14A33` | struggling cells, wrong flash |
| `--dusty` | `#8A7E68` | unseen cells, secondary text |
| grid texture | `repeating-linear-gradient` 1px `rgba(26,37,55,0.06)` every 24px, both axes | body background |

Type: Fraunces for the fact and headings (`fontVariationSettings: '"SOFT" 100, "WONK" 1'` as in Nifty Fifty), Manrope for UI text, JetBrains Mono for the typed answer and grid numbers. Fact size 72px on phones, 96px on tablets. Keypad keys at least 64px tall, 3 columns, 10px gaps. Hard-shadow card style: `3px solid var(--ink)` border, `6px 6px 0 var(--ink)` shadow.

Constants (engine): `FAST_MS = 3000`, `TIMEOUT_MS = 6000`, `ROUND_SIZE = 20`, `DRILL_SIZE = 10`, `WRONG_HOLD_MS = 1200`, `EMA_ALPHA = 0.3`, weights `{ struggling: 8, unseen: 5, slow: 3, fast: 1 }`, `PREV_ROUND_DAMPING = 0.5`, `FAST_STREAK = 3`, `STRUGGLING_RATE = 0.6`.

## Phase 1 — Engine (pure logic, all unit tests here)

1. `src/lib/justTheFactsEngine.js` exports:
   - `ALL_FACTS`: 78 `{ a, b, key, answer }` with `a <= b`, key `` `${a}×${b}` ``.
   - `factKey(a, b)` → canonical key regardless of order.
   - `emptyStats()` → `{ roundNumber: 0, sound: false, facts: {} }`.
   - `getRecord(stats, key)` → record or the zero record `{ attempts: 0, correct: 0, fastCorrect: 0, avgMs: null, lastRound: null, streak: 0, lastResult: null }`.
   - `classify(record)` → `"unseen" | "struggling" | "slow" | "fast"` per the design thresholds. Order of checks: unseen, struggling (lastResult wrong OR correct/attempts < 0.6), fast (streak ≥ 3), else slow.
   - `weightFor(record, roundNumber)` → base weight by class, halved if `lastRound === roundNumber - 1`.
   - `sampleRound(stats, count, random = Math.random)` → array of `{ a, b, key, answer, display: [x, y] }` where `display` is a random order of a and b. Weighted sampling without replacement; falls back to fast facts when non-fast facts run out. Never returns duplicates.
   - `drillRound(stats, key, count, random)` → the chosen fact plus its family neighbors (same `a` or same `b`), padded from the family, shuffled.
   - `checkTyped(answer, typed)` → `"match" | "prefix" | "wrong"`. Empty typed is `"prefix"`.
   - `gradeAnswer(elapsedMs, typedResult)` → `"fast" | "slow" | "wrong"`; `typedResult === "wrong"` or `elapsedMs >= TIMEOUT_MS` → wrong; `elapsedMs <= FAST_MS` → fast; else slow.
   - `summarizeRound(results)` → `{ fastCount, slowCount, wrongCount, totalMs }`.
   - `applyRound(stats, results, roundNumber)` → `{ stats, newlyFast }`. For each `{ key, grade, elapsedMs }`: attempts+1; correct+1 unless wrong; fastCorrect+1 if fast; avgMs EMA on non-wrong; streak = fast ? streak+1 : 0; lastRound = roundNumber; lastResult = grade. `newlyFast` lists keys that moved into fast this round. Returned stats has `roundNumber` set.
   - `countByClass(stats)` → `{ unseen, struggling, slow, fast }`.
2. `src/lib/justTheFactsEngine.test.js` with a seeded LCG random helper:
   - `ALL_FACTS` has 78 entries, all `a <= b`, all keys unique.
   - `factKey(8, 7) === factKey(7, 8)`.
   - `classify` at each boundary: 0 attempts; lastResult wrong; 3 of 5 correct (0.6, not struggling); 2 of 5 (struggling); streak 2 (slow); streak 3 (fast).
   - `weightFor` halves when seen last round, not two rounds ago.
   - `sampleRound` returns `count` unique keys; with 78 facts and count 20 no repeats over 200 seeded runs.
   - `sampleRound` favors weight: with one struggling fact and the rest fast, the struggling fact appears in at least 95 of 100 rounds.
   - `sampleRound` fills from fast facts when all are fast.
   - `drillRound` includes the target and only same-family facts, returns `count`.
   - `checkTyped`: `("56","")` prefix, `("56","5")` prefix, `("56","56")` match, `("56","6")` wrong, `("56","55")` wrong, `("7","8")` wrong.
   - `gradeAnswer`: 2999 fast, 3000 fast, 3001 slow, 6000 wrong, wrong typed → wrong.
   - `applyRound` does not mutate input; updates streak, EMA (`null` → first value; then `0.3*new + 0.7*old`); reports `newlyFast` only on the transition to streak 3.

**Gate:** `npx vitest run src/lib/justTheFactsEngine.test.js` green.

## Phase 2 — Page, PWA shell, component skeleton

1. `src/pages/games/just-the-facts.astro`: copy `50-states.astro`; title "Just the Facts — Multiplication Game", description "Fast multiplication practice for every fact from 1×1 to 12×12."; manifest `/games/just-the-facts-manifest.json`; theme color `#1F7A6D`; apple title "Just the Facts"; icon `/games/just-the-facts-192.png`; OG image reuse `/og-50-states-abv.png` for now (TODO note); register `/games/just-the-facts-sw.js`; mount `<JustTheFactsGame client:only="react" />`.
2. `public/games/just-the-facts-manifest.json`: name "Just the Facts — Multiplication", short_name "Just the Facts", start_url `/games/just-the-facts`, standalone, portrait, background `#EADFC6`, theme `#1F7A6D`, icons 192 / 512 / 512 maskable.
3. `public/games/just-the-facts-sw.js`: copy Nifty Fifty's SW; `CACHE_NAME = "just-the-facts-v1"`, precache `["/games/just-the-facts"]`.
4. Icon: `public/games/just-the-facts-icon.svg` — teal rounded square, ink "×" glyph drawn as a path (no font dependency). Rasterize with a scratchpad node script using `@resvg/resvg-js` to `just-the-facts-192.png` and `just-the-facts-512.png`.
5. `src/components/JustTheFactsGame.jsx` skeleton: injected `<style>` with font import, tokens, grid texture; `screen` state `home | round | end`; `stats` state loaded from localStorage key `just-the-facts-stats` (try/catch, fall back to `emptyStats()`), saved on every change via effect; a `sheetKey` state for the fact detail sheet. Placeholder home with Start button that flips to a placeholder round.

**Gate:** `npm run build` passes; `/games/just-the-facts` loads, manifest and SW register in DevTools, placeholder screens toggle.

## Phase 3 — Round screen and keypad

1. `Round` component receives `facts` (from `sampleRound` or `drillRound`), `onFinish(results)`, `onAbandon`, `sound`.
   - State: `index`, `typed`, `phase` (`answering | wrongHold`), `startedAt` (from `performance.now()` when a fact shows).
   - Header: `"{index+1} of {facts.length}"` in Manrope, Home link that abandons the round without saving.
   - Fact line in Fraunces: `` `${display[0]} × ${display[1]}` ``. During `wrongHold` render `` `= ${answer}` `` appended in `--rust`.
   - Typed line in JetBrains Mono; empty shows a blinking underscore.
   - Timer bar: div whose `transform: scaleX` animates 1 → 0 over `FAST_MS` via a CSS transition, remounted with `key={index}` to restart. Color flips to `--gold` when `elapsed > FAST_MS` using a `setTimeout` toggled class. A second `setTimeout` at `TIMEOUT_MS` triggers the timeout path.
   - Keypad: 3×4 grid, digits 1-9, then `⌫`, `0`, blank. Buttons are `<button type="button">`, 64px min height, hard-shadow style, `:active` translate for press feel. Also accept physical keyboard digits and Backspace via a `keydown` listener for desktop testing.
   - On digit: `typed' = typed + d`; `checkTyped(answer, typed')`: match → grade with `performance.now() - startedAt`, record, `advance()`; prefix → set typed; wrong → record wrong, enter `wrongHold` for `WRONG_HOLD_MS`, then `advance()`.
   - Timeout → record `{ grade: "wrong", elapsedMs: TIMEOUT_MS }`, `wrongHold`, advance.
   - Clear both timers on advance and on unmount. Ignore input during `wrongHold`.
   - Result item shape: `{ key, a, b, answer, grade, elapsedMs, typed }`.
   - Feedback: a small tick element that fades in per result (`--teal` fast, `--gold` slow) and a shake keyframe on the fact line for wrong.
2. Sound: `src/lib/justTheFactsSound.js` with `click()`, `good()`, `slow()`, `bad()` built on a lazily created `AudioContext` and short oscillator envelopes. No-op when sound is off or `AudioContext` is unavailable.
3. Game shell: Start → `sampleRound(stats, ROUND_SIZE)` → `screen = "round"`. `onFinish` → `applyRound` with `roundNumber + 1`, persist, `screen = "end"` with `{ results, newlyFast }`.

**Gate:** manual on phone width: 20 facts, correct/slow/wrong/timeout all behave per design; no double-advance on rapid taps; timers cleared when leaving mid-round.

## Phase 4 — Home grid, fact sheet, end screen

1. `MasteryGrid`: 13×13 CSS grid (header row and column with 1–12). Cell background by `classify(getRecord(stats, factKey(r, c)))`: `--dusty` at 35% alpha unseen, `--rust` struggling, `--gold` slow, `--teal` fast. Cell shows the product in JetBrains Mono at 11–12px, ink on light cells, paper on dark cells. Cells are buttons with `aria-label` like `"7 times 8, fast"`. Fits 360px wide with 24px cells and 2px gaps.
2. Home layout: title, subtitle, grid, legend row, count line `"{fast} of 78 facts fast"` from `countByClass`, Start button (full width, teal, hard shadow), sound toggle pill, footer text `"Just the Facts · franzketechnologies.com"`.
3. `FactSheet`: bottom sheet (fixed, slides up with a transform transition, backdrop click closes, `Escape` closes). Shows `7 × 8 = 56` in Fraunces, class badge, attempts, accuracy `%`, avg time `1.8s`, streak, and buttons "Drill this" (`drillRound(stats, key, DRILL_SIZE)` → round) and "Close".
4. `EndScreen`: total time `mm:ss.s`, three stat tiles (fast / slow / missed), stamp (rotated bordered label like Nifty Fifty's): "Lightning" when `fastCount === facts.length`, "Solid" when `wrongCount === 0`, else "Keep going". `newlyFast.length > 0` → teal callout "N new facts fast". List of slow and wrong facts with answers and the grade tag. Buttons "Again" (new `sampleRound`, or the same drill for drill rounds) and "Home".
5. Grid reflects the round immediately on return to home (stats already persisted).

**Gate:** manual: grid colors match classifications after a couple of rounds; sheet opens for every cell including mirrored ones; end screen stamps correct for each case.

## Phase 5 — Tests, polish, link

1. `src/components/__tests__/justTheFacts.smoke.test.jsx` (`// @vitest-environment happy-dom`, `@testing-library/react`): render, click Start, read the fact from the DOM, compute the answer, click keypad digits, assert progress moves to "2 of 20"; with `vi.useFakeTimers` advance past `TIMEOUT_MS` and assert the answer flash appears. Two tests only; the engine tests carry the logic.
2. Accessibility: keypad buttons have visible focus rings; the fact line is `aria-live="polite"`; grid legend pairs each color with a glyph (·, ○, ◐, ●) so color is not the only signal.
3. `prefers-reduced-motion`: disable shake and sheet slide.
4. `src/components/Footer.astro`: add `{ href: '/games/just-the-facts/', label: 'Just the Facts Game' }` after the Nifty Fifty entry.
5. Run `npx vitest run` and `npm run build`. Commit in small steps per phase.

**Gate:** all tests green, build passes, footer link works, PWA installs on a phone.

## Acceptance criteria

1. A round always presents 20 facts with no repeats; early rounds cover unseen facts, later rounds are dominated by struggling and slow facts.
2. Typing a correct answer within 3 seconds advances with a green tick; 3–6 seconds advances with an amber tick; a wrong digit or 6-second timeout flashes the answer for about 1.2 seconds and then advances.
3. Grid cells change color based on real play, mirrored across the diagonal, and tapping any cell shows that fact's stats with a working "Drill this".
4. Stats survive reload and offline load via the service worker.
5. Nifty Fifty is untouched: no changes to its files, cache name, or manifest.

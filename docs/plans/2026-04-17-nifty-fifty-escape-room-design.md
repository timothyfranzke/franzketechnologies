# Nifty Fifty — Escape Room Mode Design

## Overview

A new game mode where the player answers 4 multiple choice questions to crack a 4-digit code. Each answer option displays a random digit, but the player doesn't know which option is correct. After submitting, Mastermind-style green/white dot feedback reveals which questions are right or wrong. The player refines their answers and resubmits until they escape or run out of retries/time.

## Home Screen

New sixth mode card after Match:

- **Title:** Escape
- **Icon:** Lock-themed symbol
- **Description:** Crack the 4-digit code to break free.
- **Color:** var(--deep)

Category (Capitals/Abbreviations) and direction inherited from the home screen tabs.

## Config Screen

Same layout style as the matching game config. Shown when Escape is selected.

### Retries

Four pill buttons: **1 · 2 · 3 · ∞**. Default: 3. Represents total retries (attempts = retries + 1).

### Timer

Two pill buttons: **Off · 5:00**. Default: Off.

### Card Source

Three options:

- **Random** — Random states from the full 50
- **By Region** — Sub-options: South, West, Midwest, Northeast. Pads with random extras if region has fewer than 4 states (unlikely but safe).
- **Weak Areas** — States with lowest localStorage accuracy scores. Disabled with hint if fewer than 5 states have history.

"Start" button launches the game.

## Game Setup

4 states are selected from the chosen source. Each state generates a multiple choice question:

- 1 correct answer + 3 distractors (using existing `getDistractors()` helper)
- Each of the 4 options is labeled with a unique random digit (0-9, no repeats within a question)
- The correct answer's digit becomes that question's code digit
- The full 4-digit code is hidden from the player

## Game Screen

All on one view, three visual sections:

### Header

- Back button
- Attempt counter: "Attempt 2/4" (or "Attempt 3" if unlimited)
- Timer counting down from 5:00 (if enabled)

### Questions Panel

All 4 questions visible at once, stacked vertically. Each question shows:

- Small label: the question type (e.g., "Capital of" or "Abbreviation of")
- The question text (state name, capital, or abbreviation depending on direction)
- 4 option buttons in a row, each displaying: `[digit] answer text`
- Selected option highlighted with ink style

### Code Display & Submit

At the bottom, a combination-lock visual: 4 boxes showing selected digits (empty boxes for unanswered questions).

"Try Code →" button, enabled only when all 4 questions are answered.

## Feedback

After submission, each code digit box shows a dot:

- **Green dot** — Correct digit, correct position (question answered correctly)
- **White dot** — Wrong digit (question answered incorrectly)

No "right digit, wrong position" logic. Each dot maps directly to one question, so the player knows exactly which questions to reconsider.

The player taps any question to change their answer. The code digit updates live. They resubmit.

## End States

### Escape Success

All 4 dots green. Code display pops, transitions to victory screen:

- "Escaped!" heading
- Stamp rating based on attempt number:
  - 1st attempt: "MASTERMIND"
  - 2nd attempt: "SHARP"
  - 3rd attempt: "SOLID"
  - 4+ attempts: "PERSISTENT"
- Stats: attempts used, time elapsed (if timed)
- Buttons: Play Again (same config), Change Settings (config screen), Back to Menu

### Escape Failure

Retries exhausted or timer hits 0:00.

- "Locked Out" heading
- Shows correct answers for each question with the correct code revealed
- Same three buttons

### Timer Behavior

Countdown runs during gameplay. At 0:00: auto-submits if all questions answered, otherwise immediate lockout. Timer pauses 1 second when showing dot feedback.

## Stats Recording

Each question records to statsStore on first submission only:

- Correct on first attempt → `statsStore.record(state, true)`
- Wrong on first attempt → `statsStore.record(state, false)`

Changing answers on subsequent attempts does not re-record. This feeds Weak Areas for all modes.

## Files Changed

- `src/components/StatesCapitalsGame.jsx` — all game logic changes

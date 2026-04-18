# Nifty Fifty — Progress Map Practice Actions Design

## Overview

Make the progress map legend tiers tappable so users can select confidence tiers (e.g. Weak + Shaky), then launch Quiz, Flashcards, or Type It sessions scoped to just those states.

## Interaction Model

The five legend items (Solid, Shaky, Getting There, Weak, Not Tested) become toggleable pills. Multiple tiers can be active at once. When any are selected:

- Matching states keep their color; all others fade to muted gray with reduced opacity
- A practice bar slides in below the legend with count and three mode buttons
- State detail card still works independently

When no tiers are selected, map returns to normal, practice bar hides.

## Practice Bar

Appears between legend and detail card:
- Top line: "**14 states** selected"
- Bottom row: three compact buttons — Quiz (rust), Flashcards (gold), Type It (sage)

## Mode Integration

Quiz, Study (Flashcards), and TypeIt accept an optional `subset` prop. When present, it replaces `STATES` as the deck source. Distractors in Quiz still pull from full `STATES`.

## Return Flow

When launched from progress map, `onExit` returns to the progress map screen (not results/home). Tier selections persist.

## State Management

App component gets:
- `progressSubset` — array of state objects, or null
- Return routing: if mode was launched from progress, return to progress screen

ProgressMap gets:
- `selectedTiers` state — Set of tier labels
- `onPractice(subset, mode)` prop from App
- Practice bar computes subset by filtering STATES against selected tier confidence

## Files Changed

- `src/components/StatesCapitalsGame.jsx` — ProgressMap (legend toggles, practice bar, dim logic), Quiz/TypeIt/Study (subset prop), App (progressSubset state, return routing)

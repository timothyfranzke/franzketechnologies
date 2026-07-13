# Ledger Flags — Design

**Date:** 2026-07-13
**Feature:** Flag transactions with labels like "Tim's bonus" and see them roll up visually in the register.
**Builds on:** `docs/plans/2026-07-12-checkbook-ledger-design.md`

## Decisions

| Decision | Choice |
|---|---|
| Semantics | Rollup label only — balance math unchanged |
| Granularity | Whole transaction (no partial amounts) |
| Cardinality | One flag per transaction (rollups never double-count) |
| Scope | Flags shared across accounts; register chips show the per-account slice |
| Visualization | Flag chips with live nets in the filter row → tap to drill into a filtered view |

## Data model

Dexie schema **version 2**:

- New table `flags: 'id, name'` — fields: `id`, `name`, `color` (index into a preset palette legible in both themes), `archived`, `createdAt`.
- `transactions` gain nullable, indexed `flagId`.

The v2 migration only adds the table and index; existing rows read as unflagged. Deleting a flag un-flags its transactions (no data loss); archiving hides it from pickers/chips while old rows keep their dot.

**Rollup is derived, never stored** — new pure function in `derive.js`:

```
flagRollup(account, txs, flagId) → { net, in, out, count }
```

built on `signedAmount` so transfers count correctly from whichever register is viewing. Per-account in the register; a cross-account combined view is possible later because the function is pure.

**Export/import:** JSON snapshot gains `flags`, `schemaVersion` bumps to 2; importer accepts v1 (flags default empty) and v2. CSV gains a `flag` column.

## Register UI

- **Chip row:** the filter row becomes horizontally scrollable; after Reconcile and Hide-cleared, one chip per non-archived flag with activity in this account: colored dot, name, live net (`● Tim's bonus +$1,550`). Zero-activity flags don't appear.
- **Flag mode (drill-in):** tapping a chip filters the list to that flag (still grouped Outstanding/Cleared). Running balances are hidden in this mode (misleading on a filtered list); rows show signed amounts only. The summary header swaps: big number becomes the flag's **Net** with dot + name above it, right side shows **In / Out**. Tap the chip again (or its ✕) to exit. Composes with search; Reconcile always sees everything.
- **Rows:** flagged rows append `· ● Flag name` to the meta line, truncating as today. Color is never the only signal — the name travels with the dot.
- **Long-press a chip** opens the manage sheet (rename, recolor, archive, delete).

## Entry form & management

- New **Flag** row below Category (below "To account" for transfers — transfers are flaggable). Picker sheet: existing flags with dots, "No flag", and "New flag…" expanding to name input + palette swatches, so flags are created in the flow of entering the transaction.
- Recurring templates carry `flagId`; materialized instances inherit it.
- Delete warns "N transactions will lose this flag" with the two-tap confirm pattern. Archived flags collapse into an "Archived" group in the picker.

## Testing

- Unit: `flagRollup` incl. transfer sign per side; v1→v2 migration opens existing data cleanly; export v2 shape; import accepts v1 and v2; flag deletion un-flags.
- Smoke (DOM): create flag from entry form → tag two transactions → chip shows correct net → tap chip → filtered list + In/Out header → untag last row → chip disappears.

## Out of scope

Partial-amount flags, multi-flag per transaction, cross-account combined rollup view, flag budgets/targets. None are blocked by this schema.

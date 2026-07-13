# Ledger Flags — Implementation Plan

**Design:** `docs/plans/2026-07-13-ledger-flags-design.md`
**Branch:** `feature-ledger-flags` (regular branch in the main checkout — no worktree)
**Touched code:** `src/components/ledger/` only.

## Flag color palette

Preset pairs (light / dark dot color), stored as a palette index on the flag, defined once in `flags.js`:

| idx | name | light | dark |
|---|---|---|---|
| 0 | Blue | `#2F5FBF` | `#7EA6F4` |
| 1 | Green | `#067647` | `#3FCB8A` |
| 2 | Amber | `#B54708` | `#F7B267` |
| 3 | Purple | `#6941C6` | `#B49BF0` |
| 4 | Pink | `#C11574` | `#F48FB8` |
| 5 | Teal | `#0E7090` | `#67D5E8` |

Dots render via a CSS var set per index (`--flag-color`), themed by `prefers-color-scheme`.

## Phase 1 — Data layer

1. `db.js`: add `db.version(2).stores({ flags: 'id, name', transactions: 'id, accountId, [accountId+date], transferAccountId, date, ruleId, flagId' })` (other tables unchanged; keep v1 block intact for upgrades). New ops: `createFlag({name, color})`, `updateFlag(id, changes)`, `deleteFlagAndUnflag(id)` (one rw transaction: `transactions.where('flagId').equals(id).modify({flagId: null})` + delete flag), `archiveFlag(id, archived)`.
2. `addTransaction` defaults `flagId: null`; recurring `materializeRecurring` copies `template.flagId` onto instances (template spread already covers it — verify + test).
3. `derive.js`: `flagRollup(account, txs, flagId)` → `{ net, inflow, outflow, count }` (avoid the reserved-looking `in`).
4. Export/import: `SCHEMA_VERSION = 2`; `DATA_TABLES` gains `flags`; `validateImport` accepts `{1, 2}`, normalizing v1 with `flags: []` and leaving missing `flagId` as null on merge/replace.
5. `export.js` `buildCsv`: add `flag` column (flag name or empty), passing flags in.

**Tests** (extend existing files): rollup math incl. transfer sign per viewing side and empty-flag case; v1→v2 upgrade (seed a v1 db shape via importReplace of a v1 snapshot, reopen, assert intact + flags empty); v1 AND v2 import accepted, v3 rejected; deleteFlagAndUnflag; recurring instance inherits template flagId; CSV flag column + escaping.

**Gate:** all unit tests green.

## Phase 2 — Entry form tagging

1. `flags.js`: palette constants + `FlagDot` component (colored 8px dot span using palette index).
2. `EntryForm.jsx`: `flagId` state (from `editingTx.flagId`); **Flag** field row below Category (below "To account" when transfer) showing dot + name or "Optional". Picker sheet (reuse `PickerSheet`): non-archived flags with dots, collapsed "Archived" group when any exist, "No flag", and "New flag…" → inline name input + 6 palette swatches + Create (creates via `createFlag`, selects it). `flagId` included in save fields and in the recurring rule template.
3. Smoke test: open form → New flag "Tim's bonus" → save income → db row has flagId; edit form shows the flag.

**Gate:** tests green; flag creation works inside the entry flow.

## Phase 3 — Register chips, drill-in, rows

1. `TransactionRow.jsx`: accept `flag` (resolved object); meta line appends `· <FlagDot/> name` when present.
2. `Register.jsx`:
   - liveQuery flags; compute per-flag rollups from the account's txs (plain memo over the already-loaded `txs` — no extra queries); chips for non-archived flags with `count > 0`, after Reconcile/Hide-cleared. Filter row becomes `overflow-x: auto`, chips `flex: 0 0 auto`.
   - `activeFlagId` state: tapping a chip toggles flag mode; active chip gets tint style + ✕ glyph. In flag mode: rows filtered to the flag (composes with search), running balances hidden (pass `running={undefined}`), Hide-cleared still applies.
   - `SummaryHeader` gains an optional `flagSummary` prop: `{ name, colorIdx, net, inflow, outflow }` — when set, big number = Net with dot+name as its label, right stats = In / Out. Balance header unchanged otherwise.
   - Long-press on a chip (same 500ms pattern as rows) opens the flag manage sheet.
3. Manage sheet (`FlagManageSheet` in `flags.jsx` or own file): rename input, 6-swatch recolor, Archive/Unarchive toggle, Delete with two-tap confirm showing the live "N transactions will lose this flag" count.
4. CSS: `.chip` dot span, `.chip--flag-active`, scrollable filter row, header flag-mode variants — all from existing tokens.
5. Smoke tests: chip shows correct net after tagging two txs; tap → filtered list + In/Out header; untag last → chip gone; long-press delete unflags.

**Gate:** all tests green; `npm run build` clean.

## Phase 4 — Verification & ship

1. Full suite + build; manual pass on register light/dark (chips legible in both themes).
2. Verify export→wipe→import round-trip preserves flags (extend existing acceptance test).
3. Commit per phase as before; PR `feature-ledger-flags` → `main` (or local merge, matching how the ledger landed).

# Checkbook Ledger PWA — Design

**Date:** 2026-07-12
**Route:** `/ledger`
**Design source:** `untitled folder 2/personal-checkbook-ledger-app/project/Checkbook Ledger.dc.html` (hi-fi mockups 1a–1e, 2a)
**Requirements source:** user-provided "Requirements: Personal Checkbook Ledger App"

## Summary

A local-only personal checkbook ledger PWA. The user enters charges before the bank shows them, marks them cleared when they post, and reconciles against statements. No server, no auth, no network calls, no telemetry. Data lives in IndexedDB; backup is file-based JSON export/import.

## Decisions made

| Decision | Choice |
|---|---|
| Route | `/ledger`, PWA scope `/ledger/` |
| Storage | IndexedDB via Dexie |
| App lock (PIN/biometric) | Not in v1 |
| Batch select (design 2a) | In v1 |
| Platform | PWA in this Astro repo, React island (vacation-app pattern) |

## Architecture

Single Astro page `src/pages/ledger/index.astro` mounting one React app with `client:only="react"`. All navigation (register ↔ entry form ↔ reconcile ↔ settings) is client-side view state, not URL routes — one document to precache, no way to strand the user offline on an uncached page.

**PWA:** `public/ledger.webmanifest` (standalone display, light/dark theme colors, icons), service worker scoped to `/ledger/` precaching the shell. Call `navigator.storage.persist()` on first write to reduce iOS eviction risk; Settings surfaces persistence status and days-since-last-export.

**Code layout:**

```
src/components/ledger/
  App.jsx        # view state machine, theme, recurring materialization on mount
  db.js          # Dexie schema + all named data operations
  money.js       # integer-cents math + Intl.NumberFormat display
  derive.js      # cleared/outstanding/balance, running balances (pure functions)
  views/         # Register, EntryForm, Reconcile, BatchSelect, Accounts,
                 #   Settings (export/import), ReconcileHistory
  components/    # TransactionRow, SummaryHeader, ClearedDisc, SegmentedType,
                 #   Keypad, PayeeChips, FilterChips, FAB, ...
```

Styling follows the mockups' tokens: Source Sans 3 with tabular figures, slate neutrals + one blue accent (`#2F5FBF` light / `#7EA6F4` dark), expense `#B42318`/`#F97066`, income `#067647`/`#3FCB8A`. Cleared = solid blue check disc; uncleared = dashed ring + tinted row — shape, not just color. Light/dark via `prefers-color-scheme`.

## Data layer

Dexie database `ledger`, version 1. All amounts are integer cents; `money.js` owns parsing and locale-aware display. Never floats.

```js
accounts:        'id, name'                     // + startingBalance, createdAt
transactions:    'id, accountId, [accountId+date], transferAccountId, date'
categories:      'id, type, sortOrder'          // + name, icon, archived
reconciliations: 'id, accountId, statementDate' // + endingBalance, txCount, finishedAt
recurringRules:  'id, accountId'                // + frequency, interval, endCondition,
                                                //   nextDue, template fields
meta:            'key'                          // schemaVersion, per-account UI prefs
```

Every mutation goes through named operations in `db.js` (`addTransaction`, `toggleCleared`, `finishReconcile`, `importReplace`, …), each wrapped in a Dexie transaction so force-kill mid-write leaves either the old or the new state, never a partial one. UI reads via `dexie-react-hooks` `liveQuery`, so any write re-renders header and rows automatically.

**Transfers** are one stored row: `type: 'transfer'`, `accountId` = source, `transferAccountId` = destination. Each register queries both sides (`accountId = X` or `transferAccountId = X`) and renders sign by which side it is viewing. Edit/delete from either side touches the single row.

**Recurring:** a rule holds the transaction template plus `nextDue`. On app mount, one transaction loop materializes every due instance as a normal uncleared transaction stamped with `ruleId`, advancing `nextDue` until it passes today — multiple missed periods catch up correctly. End conditions: never / after N occurrences / until date. Editing an instance prompts "this occurrence only" (edits the materialized row) vs "the rule" (updates the template for future instances only).

**Derived values** (`derive.js`) are pure functions, never stored: cleared balance = starting + Σ cleared; outstanding = Σ uncleared; balance = cleared + outstanding; running balance per row computed in one pass over transactions sorted by date, ties broken by createdAt.

## Register (mockup 1a, 1d)

- Pinned summary header: Balance large; Cleared and Outstanding right-aligned, dashed underline on Outstanding echoing the uncleared ring.
- Filter row: month label, **Reconcile** chip, **Hide cleared** toggle (persisted per account in `meta`).
- List grouped into **Outstanding** (tinted `#F6F9FF` card, dashed rings) and **Cleared** (white card, solid discs) sections. Row: payee, date · category (+ check # when present), signed colored amount (transfer = neutral ink + paired-arrow glyph, no sign), running balance beneath.
- Virtualized with `@tanstack/react-virtual`; smooth at 10k+ rows.
- Interactions: tap 44pt disc → toggle cleared inline (header updates immediately); tap row body → edit form; long-press → batch select; header search icon → payee filter field; account name → account switcher / manage accounts; FAB → new transaction.
- Empty state per 1d: "No transactions yet", "Set opening balance" action.

## Entry form (mockup 1b)

Full-screen sheet. Segmented Expense/Income/Transfer control — selected segment fills with its semantic color and carries its sign glyph. Amount rendered large in the type's color, driven by an inline numeric keypad filling cents-first (`5432` → `$54.32`); no negative entry, sign derives from type. Payee field with frequency-ranked autocomplete chips scoped to the account; selecting a known payee pre-fills its most-used category. Rows: Category, Account, Date (default today), Check #, Memo. Toggles: Cleared (default off), Recurring (reveals Repeats row → frequency, interval, end condition). Transfer type replaces Payee/Category with a destination-account row. Save enabled once payee + amount exist. Edit mode adds Delete-with-confirmation and shows a warning banner before editing a reconciled transaction.

## Reconcile (mockup 1c)

Entry via Reconcile chip → setup sheet: statement ending balance (keypad) and statement date (default today). Reconcile screen: deep-navy (`#24457F`) header with ending balance, live **Difference remaining**, progress bar ("3 of 5 checked"). List shows only unreconciled transactions dated ≤ statement date — cleared and uncleared both. Checking uses the navy disc; checked rows dim.

`difference = statementEndingBalance − (lastReconciledBalance + Σ checked)`

At zero, the header flips to the green (`#0E5C3F`) "Balanced to the penny." state and **Finish reconciliation** enables; while off, the footer button reads "Off by $X.XX" and is disabled. Finish runs one Dexie transaction: set `reconciled = true` and `cleared = true` on all checked rows, append a `reconciliations` entry (date, ending balance, count). Cancel discards only selection state. Read-only reconciliation history reachable from the account menu.

## Batch select (mockup 2a)

Entered by long-press or a Select action in the ⋯ menu. Header shows live selected total and "Cleared if committed" (cleared balance + selection); "All" selects every outstanding row. Cleared rows render at 45% opacity, not selectable. Bottom bar: **Mark cleared** (one transaction) or **Reconcile…** (opens reconcile setup with the selection pre-checked).

## Export / import

**Export** (Settings): full JSON `{schemaVersion: 1, exportedAt, accounts, categories, transactions, recurringRules, reconciliations}`; per-account CSV of transactions with decimal-string amounts for spreadsheets. Delivery via `navigator.share` with a `File` when supported (iOS share sheet), else download link.

**Import**: JSON only, schema-version validated before any write. *Replace all* — double confirmation, wipe + reload in one transaction. *Merge* — insert records whose ids are absent, skip existing.

## Non-functional

- No network calls, no telemetry anywhere in ledger code.
- Cold start to usable register < 2s (precached shell, single Dexie read per view).
- Accessibility: WCAG AA contrast from mockup palette, 44pt targets, cleared/type states shape-coded not color-only, signs always rendered, `aria-pressed` on toggles, rem-based type for dynamic type.

## Testing

Vitest (already configured) with `fake-indexeddb`:

- `money.js`: parse/format round-trips, locale display.
- `derive.js`: running balance ordering (date then createdAt), transfer sign per viewing side, header math.
- Recurring: multi-period catch-up, all end conditions, occurrence-vs-rule edits.
- Reconcile: difference math, finish semantics, history log.
- Import: merge dedupe by id, replace-all atomicity.
- Integration: the six acceptance criteria below as one test file.

**Acceptance (from requirements):**
1. New account, $500.00 starting → Cleared $500.00 / Outstanding $0.00 / Balance $500.00.
2. Uncleared expense $113.73 → Outstanding −$113.73, Balance $386.27, Cleared unchanged.
3. Toggle cleared from list → Cleared $386.27, Outstanding $0.00.
4. Reconcile at $386.27 → difference $0.00, finish succeeds, row locked as reconciled.
5. Export JSON, wipe, import → identical state including reconciliation log.
6. Kill mid-entry → no corrupt data on relaunch.

## Out of scope (v1)

Bank sync/OFX, budgets/reports/charts, cloud sync, receipt scanning, attachments, CSV import, app lock (PIN/biometric — revisit in v2; no schema impact).

## New dependencies

`dexie`, `dexie-react-hooks`, `@tanstack/react-virtual`, `fake-indexeddb` (dev).

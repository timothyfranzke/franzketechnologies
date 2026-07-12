# Checkbook Ledger PWA — Implementation Plan

**Design:** `docs/plans/2026-07-12-checkbook-ledger-design.md`
**Branch:** `worktree-feature-ledger`
**Mockups:** `untitled folder 2/personal-checkbook-ledger-app/project/Checkbook Ledger.dc.html` — sections 1a (register light/dark), 1b (entry form), 1c (reconcile), 1d (empty state), 1e (component sheet), 2a (batch select). Match these pixel-for-pixel; every color, radius, and size below comes from them.

## Constraints discovered in the repo

- `@vite-pwa/astro` in `astro.config.mjs` is a **single-instance integration already scoped to `/vacation/`**. The ledger gets its own hand-written `public/ledger-sw.js` and static `public/ledger.webmanifest` instead. A runtime-caching SW (no build-time precache manifest) sidesteps hashed `_astro/*` filenames.
- Fonts elsewhere use `@fontsource/*`; the design's Source Sans 3 must be self-hosted (`@fontsource/source-sans-3`, weights 400/600/700) — Google Fonts CDN would break offline.
- Vitest is configured; no test setup file exists yet. Data-layer tests need `fake-indexeddb`.
- Sitemap filter in `astro.config.mjs` excludes `/admin`, `/thank-you`, `/clients/`; add `/ledger`.

## Design tokens (from mockups — centralize in `src/components/ledger/tokens.css`)

| Token | Light | Dark |
|---|---|---|
| App background | `#F4F5F8` | `#0E1116` |
| Card / header surface | `#FFFFFF` | `#171C24` |
| Card border | `#E9ECF2` | `#273040` |
| Row divider | `#EEF0F4` | `#222A36` |
| Ink primary | `#1B1F27` | `#F2F4F8` |
| Ink secondary | `#667085` | `#98A2B3` |
| Ink tertiary | `#98A2B3` | `#5F6B7C` |
| Ink faint | `#B9C1CD` | — |
| Accent blue | `#2F5FBF` | `#7EA6F4` |
| Accent tint bg | `#EBF1FC` | `#1E2A40` |
| Outstanding card bg / border | `#F6F9FF` / `#E3EBFA` | `#18202E` / `#24334A` |
| Dashed ring | `#93A8CC` | `#4A5C7C` |
| Expense red | `#B42318` | `#F97066` |
| Income green | `#067647` | `#3FCB8A` |
| Cleared payee ink | `#3A4252` | `#C6CDD8` |
| Transfer amount ink | `#475467` | `#98A2B3` |
| Reconcile header navy / green | `#24457F` / `#0E5C3F` | same |
| Segmented track | `#E7EAF0` | — |
| Switch off track | `#D3D9E3` | `#37414F` |

Type: Source Sans 3; `font-variant-numeric: tabular-nums` on every money figure. Signature sizes: balance 34px/700, row payee 16px, row amount 17px, row meta 13px, section label 12px/700 uppercase 0.06em, amount display 40px/700, reconcile difference 36px/700. Radii: cards 16px, rows-in-card dividers 1px, segmented 14px outer / 11px inner, FAB 56px circle, buttons 50–52px h / 14–15px radius, chips 32–34px h pill. Cleared disc: 28px inside a 44px hit target; dashed ring 2px dashed; solid disc filled accent with white check.

## Phase 1 — Scaffold & PWA shell

1. `npm i dexie dexie-react-hooks @tanstack/react-virtual @fontsource/source-sans-3 && npm i -D fake-indexeddb`
2. `src/pages/ledger/index.astro`: meta/OG, `theme-color` for both schemes, manifest link, apple-touch tags, mounts `<LedgerApp client:only="react" />`, registers `/ledger-sw.js` with scope `/ledger/` (vacation page is the template).
3. `public/ledger.webmanifest`: name "Checkbook Ledger", short_name "Ledger", `start_url: /ledger`, `scope: /ledger/`, standalone, `background_color #F4F5F8`, `theme_color #2F5FBF`, icons 192/512/512-maskable at `public/ledger/` (generate simple check-disc mark in accent blue).
4. `public/ledger-sw.js` (hand-written, ~60 lines): versioned cache name; install → precache `/ledger`; fetch → same-origin only: stale-while-revalidate for `/ledger*` documents and `/_astro/*` assets; activate → drop old caches. **No cross-origin, no POST.**
5. `astro.config.mjs`: add `!page.includes('/ledger')` to sitemap filter. Verify vacation workbox `globIgnores` doesn't need `ledger/**` excluded (its scope is `/vacation/`, but `_astro/**` overlap is harmless — shared immutable assets).
6. `App.jsx` skeleton: imports fontsource weights + `tokens.css`, view state machine (`register | entry | reconcile | batchSelect | accounts | settings | history`), renders placeholder register.

**Gate:** `npm run build` passes; `/ledger` installable (manifest + SW audit clean); second load works with network disabled.

## Phase 2 — Data layer (pure logic first, all tests here)

1. `money.js`: `formatCents(cents, {sign})` via `Intl.NumberFormat` (currency USD, device locale); `centsFromKeypad(digits)` (cents-first fill: "5432" → 5432); no float ever crosses a boundary.
2. `db.js`: Dexie `ledger` v1 —
   ```js
   accounts:        'id, name'
   transactions:    'id, accountId, [accountId+date], transferAccountId, date'
   categories:      'id, type, sortOrder'
   reconciliations: 'id, accountId, statementDate'
   recurringRules:  'id, accountId'
   meta:            'key'
   ```
   `on('populate')` seeds default categories (Groceries, Dining, Gas, Household, Housing, Subscriptions, Utilities, Health, Entertainment, Misc + Income: Paycheck, Interest, Other). Named ops, every one a `db.transaction('rw', ...)`: `createAccount`, `renameAccount`, `deleteAccountCascade`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `toggleCleared`, `markCleared(ids)`, `finishReconcile(accountId, stmt, ids)`, `materializeRecurring(now)`, `exportAll`, `importReplace`, `importMerge`. `crypto.randomUUID()` for ids. Call `navigator.storage.persist()` once after first write (flag in `meta`).
3. `derive.js` (pure, array-in/values-out): `accountTotals(account, txs)` → `{cleared, outstanding, balance}` with transfer sign resolved per viewing account; `withRunningBalances(account, txs)` — sort date asc + createdAt asc, accumulate, return newest-first rows; `lastReconciledBalance(account, txs)` = starting + Σ reconciled; `reconcileDifference(stmtBalance, lastReconciled, checkedTxs)`.
4. `recurring.js`: `advance(rule, fromDate)` for weekly/biweekly/monthly/yearly × interval (monthly clamps day-of-month, e.g. Jan 31 → Feb 28); loop materializes all due instances stamped `ruleId`, honors end conditions (never / after N via `occurrencesDone` counter / until date).
5. **Tests** (`src/components/ledger/__tests__/`, `fake-indexeddb` in setup): money round-trips & keypad fill; running balance ordering incl. same-date createdAt tiebreak; transfer sign from each side; totals math; recurring multi-period catch-up + all end conditions + month-end clamp; reconcile difference; import merge dedupe / replace atomicity; `deleteAccountCascade` removes txs + rules + recons and detaches transfers pointing at it (transfer rows whose other side was the deleted account become plain expense/income — decide + test).

**Gate:** all unit tests green.

## Phase 3 — Register (mockups 1a, 1d, 1e)

1. `ClearedDisc` (uncleared dashed / pressed hollow-solid / cleared filled — 1e states), `SummaryHeader` (Balance 34px; Cleared + Outstanding right; dashed underline on Outstanding), `TransactionRow` (payee weight 700 uncleared vs 600 cleared, meta line `#1041 · Jul 3 · Housing`, signed amount color by type, transfer paired-arrow glyph + no sign, running balance under amount).
2. `Register.jsx`: `liveQuery` per selected account (`meta.selectedAccountId`); rows through `derive`; grouped **Outstanding · n** (tinted card) then **Cleared · n** (white card); `@tanstack/react-virtual` on the scroll container (group headers are rows in the virtualizer; card look via first/last-in-group radius classes).
3. Filter row: month label from top visible row, Reconcile chip, Hide-cleared chip toggle persisted per account in `meta`.
4. Interactions: disc tap → `toggleCleared` (liveQuery refreshes header); row tap → entry form (edit); long-press (pointer 500ms, cancel on move) → batch select; search icon expands payee substring filter; account name → account sheet; FAB → entry form (new).
5. Empty state per 1d ("Set opening balance" opens income entry pre-filled payee "Opening balance", cleared on).
6. Dark mode via tokens; verify against 1a dark frame.

**Gate:** acceptance #1–#3 pass manually; smooth scroll with 10k seeded rows (add `npm run dev` seed helper behind `?seed=10000` dev-only flag).

## Phase 4 — Entry form (mockup 1b)

1. `SegmentedType` (selected segment fills semantic color + sign glyph), amount display 40px in type color with cursor caret, `Keypad` component (0–9, backspace; cents-first).
2. Payee input with chip suggestions: frequency-ranked per account (query txs, count by payee, prefix-match, top 3); selecting a chip pre-fills that payee's most-used category.
3. Field rows: Category (picker sheet grouped by type), Account, Date (native `input type=date`, label "Today · Jul 12" style), Check # (expense only), Memo. Transfer mode: Payee/Category/Check replaced by "To account" row; amount neutral ink.
4. Toggles card: Cleared (default off), Recurring → reveals Repeats row → sheet for frequency/interval/end condition.
5. Save enabled when payee + amount > 0 (or destination for transfer); footer hint "Payee + amount is enough — everything else is optional".
6. Edit mode: prefilled, Delete row with confirm dialog; amber warning banner when `reconciled` ("This transaction is reconciled — editing it will change past reconciliations"); recurring-instance edit prompts occurrence-vs-rule.

**Gate:** acceptance #2 via the real form; transfer renders correctly in both registers.

## Phase 5 — Reconcile (mockup 1c) & batch select (2a)

1. Setup sheet: statement ending balance (keypad) + statement date (default today).
2. `Reconcile.jsx`: navy header (ending balance line, Difference remaining 36px, progress bar + "n of m checked"); list = unreconciled txs dated ≤ statement date; check = navy disc, checked rows dim (ink → tertiary); difference from `derive.reconcileDifference`; footer disabled "Off by $X.XX" until zero, then green header + "Balanced to the penny." card + enabled "Finish reconciliation" → `finishReconcile` (sets reconciled+cleared, logs entry).
3. `ReconcileHistory.jsx`: read-only list (date, ending balance, tx count) from account ⋯ menu.
4. `BatchSelect.jsx`: entered by long-press or ⋯ → Select; header Selected total + "Cleared if committed"; All / Deselect; cleared section 45% opacity non-selectable; bottom bar **Mark cleared** (`markCleared(ids)`) and **Reconcile…** (setup sheet, selection pre-checked).

**Gate:** acceptance #4; batch flows commit atomically.

## Phase 6 — Accounts & settings

1. Accounts sheet: list with balances, create (name + starting balance), rename, delete (confirm naming cascade count).
2. `Settings.jsx`: **Export JSON** (full snapshot per design schema) and **Export CSV** per account (`date,payee,category,type,checkNum,memo,amount,cleared,reconciled`, amount as signed decimal string) — `navigator.share({files})` when `canShare`, else anchor download. **Import JSON**: file picker → validate `schemaVersion` → Merge (insert-if-absent by id) or Replace all (two-step confirm) → single transaction. Show storage-persisted status and days since last export (from `meta.lastExportAt`).

**Gate:** acceptance #5 (export → wipe via Replace-all with empty file or a dev reset → import → identical state incl. reconciliation log).

## Phase 7 — Polish & verification

1. A11y pass: `aria-pressed` on discs/toggles, `role=button` + labels, focus-visible rings, rem type, contrast spot-check both themes, 44pt audit.
2. Integration test file `acceptance.test.jsx` covering the six smoke criteria against fake-indexeddb (force-kill = abort a transaction mid-op and assert consistency).
3. iOS Safari manual pass: install to home screen, share-sheet export, offline relaunch, `storage.persist()` result, safe-area insets (`env(safe-area-inset-*)` — mockups' 62px top padding maps to safe-area + header).
4. Lighthouse: installable, no network calls in ledger code path (verify Network panel empty after load).
5. Update `CLAUDE.md` site-structure section with `/ledger`.

## Sequencing & commits

One commit per phase minimum, message style matching repo history ("Add ledger data layer with Dexie schema and money math"). Phases 3–5 each depend on 2; 6–7 depend on all prior. PR from `worktree-feature-ledger` → `main` when Phase 7 gate passes.

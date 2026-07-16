# Checkbook Ledger Mobile — Design

**Date:** 2026-07-16
**Origin:** productizes the `/ledger` web PWA (see `2026-07-12-checkbook-ledger-design.md`, `2026-07-13-ledger-flags-design.md`)

## Summary

Take the Checkbook Ledger PWA to the iOS and Android app stores as a freemium subscription product. New Expo/React Native app in its own repo; the web `/ledger` is frozen as-is. Data moves from local-only IndexedDB to cloud-primary Firestore (per-user), with subscriptions via RevenueCat. Premium: $1.99/mo or $14.99/yr. Working title "Checkbook Ledger"; final name pending store availability.

## Decisions made

| Decision | Choice |
|---|---|
| Platforms | iOS + Android only; web version frozen |
| App stack | Expo / React Native (EAS Build) |
| Data layer | Cloud-primary Firestore with built-in offline persistence |
| Auth | Firebase Auth — Apple, Google, email. Required; no anonymous mode |
| Subscriptions | RevenueCat, both stores; webhook stamps entitlement into Firestore |
| Monetization | Free tier + premium; $1.99/mo · $14.99/yr, annual highlighted |
| Repo | New repo, sibling to this one |

## Architecture

Expo app + three managed services:

- **Firebase Auth** — sign-in. First launch: welcome → sign in → register.
- **Firestore** — the database. Reads serve from local cache; offline writes
  queue and auto-flush. No hand-written sync code.
- **RevenueCat** — subscription state, source of truth. Its webhook (one Cloud
  Function) writes `premiumUntil` to `users/{uid}` so security rules and the
  app can both check entitlement.

**Ports unchanged from the web codebase (with their test suites):** `money.js`,
`derive.js`, `recurring.js`, `export.js` — the entire business-logic layer.
Integer cents, running balances, recurring materialization, export format all
identical.

**Rewritten:** `db.js` becomes a Firestore data layer with the same
named-operation API (`addTransaction`, `toggleCleared`, `finishReconcile`, …);
the ~15 view/component files rebuilt in RN primitives, same visual design.

## Data model (Firestore)

Everything under the user's document; security rules reduce to "own subtree only".

```
users/{uid}                    email, premiumUntil, createdAt, schemaVersion
  accounts/{accountId}         name, startingBalance, createdAt
  transactions/{txId}          accountId, type, amountCents, payee, categoryId,
                               date, cleared, checkNo, memo, flagId, ruleId,
                               transferAccountId, createdAt, updatedAt
  categories/{categoryId}      name, type, icon, sortOrder, archived
  flags/{flagId}               name, color, seedCents
  recurringRules/{ruleId}      template + frequency, interval, endCondition, nextDue
  reconciliations/{reconId}    accountId, statementDate, endingBalance, txCount
```

Semantics carry over exactly: integer cents everywhere; transfers stay one
document (source `accountId` + `transferAccountId`, registers query both
sides); derived values never stored — `derive.js` computes from the loaded
list.

**Reads:** per-account `onSnapshot` subscription loading the account's full
transaction list (personal-ledger scale; `derive.js` needs the full list for
running balances anyway). **Writes:** every named operation is a Firestore
batched write, preserving "old state or new state, never partial" (e.g.
`finishReconcile` updates N transactions + creates the reconciliation doc
atomically).

**Accepted behavioral change:** offline batches flush at next connect with
last-write-wins at document granularity. Fine for a single-user ledger.

## Entitlement & feature gates

- **Free:** 1 account, full core ledger — entry, clearing, batch select,
  reconcile, categories. The habit-forming loop is entirely free.
- **Premium:** unlimited accounts, transfers, flags, recurring rules, CSV/JSON
  export, reconcile history.

Enforcement: `usePremium()` hook gates UI (lock glyph → paywall). Security
rules enforce only the hard limit (account create denied when count ≥ 1 and
not premium); the rest are UI gates.

**Lapse behavior:** nothing deleted or locked away. Extra accounts go
read-only (visible, exportable); flags/recurring stop being editable but still
display. No data hostage-taking.

**Paywall:** single RevenueCat Paywalls screen (copy/pricing tunable without
app updates), reached from any locked feature and Settings → "Go Premium".
Restore-purchases button included (App Store review requirement).

## Screens & port plan

Expo Router; Register is home, other views are pushed screens/modals mapping
1:1 onto the current view-state machine.

- **Register** — `@shopify/flash-list` replaces `@tanstack/react-virtual`;
  sticky summary header, Outstanding/Cleared cards, flag chips + rollups,
  tap-disc-to-clear, long-press batch select unchanged.
- **Entry Form** — cents-first Keypad ports directly; segmented type control,
  payee autocomplete chips, recurring toggle as-is. Haptics on keypad and
  clear-toggle.
- **Reconcile / Batch Select / Accounts / Settings / Flag Manage** — straight ports.

**Design tokens:** Source Sans 3 tabular figures (`expo-font`), slate +
`#2F5FBF`/`#7EA6F4` blue, semantic red/green, dashed-ring vs solid-disc
cleared semantics, system light/dark. `tokens.css` → `tokens.js` theme object.

**Native niceties in v1:** optional Face ID/Touch ID app lock
(`expo-local-authentication`), haptics, share-sheet export.

**Not in v1:** widgets, watch app, notifications, bank import (Plaid),
budgeting/reports. The pitch stays "the honest manual checkbook register".

**Migration:** Settings → Import accepts the web app's JSON export format
(`export.js` round-trip logic already exists).

## Testing & error handling

- Ported logic modules keep their Jest suites verbatim.
- Firestore data layer + security rules tested against the Firestore emulator
  (including the free-tier account limit).
- RN Testing Library for keypad and register-row behavior; one Maestro flow
  (sign in → add → clear → reconcile) as pre-release smoke on real builds.
- Writes are treated as committed (offline queue); Settings shows a
  pending-sync indicator from Firestore's pending-writes state.
- Auth-expiry re-login flow; Sentry (`sentry-expo`) from day one.

## Ops & costs at small scale

Firebase free tier covers roughly the first few hundred actives; RevenueCat
free under $2.5k/mo tracked revenue; EAS ~$19/mo while shipping; Apple $99/yr,
Google $25 once. ~$30/mo burn before revenue.

## Build order

1. Expo skeleton + auth + Firestore data layer with ported logic and tests
2. Register + Entry Form (the daily loop)
3. Reconcile, accounts, settings, import
4. RevenueCat + paywall + gates
5. Polish: biometrics, haptics, Sentry
6. TestFlight with own migrated data → store submission

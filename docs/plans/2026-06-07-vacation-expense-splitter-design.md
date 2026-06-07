# Vacation Expense Splitter — Design

**Date:** 2026-06-07
**Status:** Design approved, ready for implementation
**Sub-app path:** `/vacation`

## Summary

A sub-application on the Franzke Technologies site that lets multiple families track shared vacation expenses and see who owes whom to settle up evenly. One person creates a "trip," gets a 6-character code (and a shareable link), and other families join with the code or the link. Each family logs their own expenses; the dashboard computes equal-per-family splits and shows the minimum payments needed to settle.

## Goals

- Share a trip via a short code or a pre-filled link — zero account setup.
- Every family can add expenses and see the full ledger live.
- Dashboard answers "who owes whom?" without mental math.
- Reuse existing Firestore infrastructure (same project as the Nifty Fifty games).

## Non-goals (v1)

- Authentication, accounts, passwords.
- Per-expense custom splits (only equal-per-family).
- Multi-currency, FX, categories, receipts, exports, notifications.
- Trip deletion, renaming families/trip, "mark as paid" tracking.
- Server-side authorization beyond Firestore's open game-style rules.

## Architecture

**Stack:** Astro pages wrapping React islands, matching the pattern used by the existing games. Firestore via `src/lib/firebase.js`. No new dependencies.

**Routes:**

| Route | Purpose |
|---|---|
| `/vacation` | Landing — lists trips this device has joined (from local storage). CTAs: "Create trip", "Enter code". |
| `/vacation/new` | Create-trip form (trip name + family name). |
| `/vacation/join` | Enter-code form (code + family name). Accepts `?code=` pre-fill. |
| `/vacation/[code]` | The trip itself. Tabs: Dashboard / Ledger / Add expense / Share. Accepts `?family=` for auto-join via shared link. |

Each route is a thin Astro page that mounts a single React component and passes URL params.

**Data flow:** All writes go straight to Firestore. The trip page uses `onSnapshot` for live reads — Dashboard and Ledger both derive from the same live expense stream.

## UI flows

### Create

1. User enters trip name + their family name on `/vacation/new`.
2. Generate a 6-char code from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous chars). Check Firestore for collision; regenerate up to 5 times.
3. Write the trip doc with the creator as the first family.
4. Save `{ code, tripName, familyId, familyName }` to local storage.
5. Redirect to `/vacation/[code]` on the **Share** tab.

### Join via shared link (`/vacation/[code]?family=Smiths`)

1. Read `code` from URL, fetch trip.
2. If trip exists and `?family=` is present: write family to local storage, register on the trip if new, `history.replaceState` to strip the query param, land on Dashboard.
3. If trip exists, no `?family=`, and local storage has no record of this device on this trip: redirect to `/vacation/join?code=ABC123`.
4. If trip doesn't exist: error screen — "Trip not found. Check the code."

### Manual join

`/vacation/join` — two fields (code + family name). Validates the code exists, then behaves like the link join.

### Inside a trip

Sticky header: trip name, your family name, "Switch trip" link back to `/vacation`. Four tabs:

- **Dashboard** — net per family + settlement transactions.
- **Ledger** — chronological list of all expenses, every family visible, edit/delete only on your own rows.
- **Add expense** — amount, place, optional description, datetime (default now). Submit → Firestore write → bounce back to Dashboard.
- **Share** — show the share link with `?family=` swapped per recipient, a "copy link" button, and a "copy link for a specific family" input.

## Settlement math

**Inputs:** families on the trip and expenses (each with `amountCents` and `paidByFamilyId`).

**Step 1 — totals (integer cents):**

```
totalSpent      = sum(expense.amountCents)
familyCount     = families.length
fairShare       = floor(totalSpent / familyCount)
remainder       = totalSpent - (fairShare * familyCount)
```

The `remainder` (0 to `familyCount − 1` cents) is distributed one cent each to the first `remainder` families sorted by `joinedAt` ascending. Result: shares sum to exactly `totalSpent`, no orphaned penny.

```
paid[family]    = sum of expense.amountCents where paidBy == family
net[family]     = paid[family] - share[family]
```

Positive net = others owe them. Negative net = they owe. Sum of all nets is exactly zero.

**Step 2 — settlement (greedy, minimum transactions):**

1. Split families into `creditors` (net > 0) and `debtors` (net < 0).
2. Sort both by `|net|` descending.
3. Repeatedly: biggest debtor pays `min(|debtor.net|, creditor.net)` to biggest creditor. Subtract from both. Drop whoever hits zero. Continue until both lists are empty.

Produces at most N−1 transactions for N families in the equal-share case.

**Display:** show net per family on top ("Smiths +$120, Joneses −$80, Browns −$40"), then the settlement transactions below ("Joneses pays Smiths $80", "Browns pays Smiths $40").

**Edge cases:**

- 0 or 1 family: "Add another family to settle up."
- 0 expenses: "$0 spent. Nothing to settle."
- Only one family has spent: every other family owes them an equal share.

## Firestore schema

### `trips/{code}`

```js
{
  code: "K7M2PQ",                    // doc ID also
  name: "Beach Week 2026",
  createdAt: serverTimestamp,
  families: [
    { id: "fam_abc123", name: "Smiths",  joinedAt: serverTimestamp },
    { id: "fam_def456", name: "Joneses", joinedAt: serverTimestamp }
  ]
}
```

Family `id` is a client-generated short random string (e.g., `nanoid(10)`). Family `name` must be unique within a trip (case-insensitive).

### `trips/{code}/expenses/{expenseId}`

```js
{
  amountCents: 4250,                 // integer cents — avoids float drift
  place: "Joe's Crab Shack",
  description: "Dinner Friday",      // optional, may be ""
  spentAt: Timestamp,                // when the expense happened
  paidByFamilyId: "fam_abc123",
  paidByFamilyName: "Smiths",        // denormalized for fast ledger render
  createdAt: serverTimestamp,
  updatedAt: serverTimestamp
}
```

### `firestore.rules` addition

```
match /trips/{tripId} {
  allow read, write: if true;
  match /expenses/{expenseId} {
    allow read, write: if true;
  }
}
```

Same open-rules pattern as `simon-scores`, `lightning-scores`, etc. The 6-char code is the only access control — acceptable for a low-stakes family expense list.

## Local storage

**Key:** `franzke.vacation.v1`

```json
{
  "trips": [
    {
      "code": "K7M2PQ",
      "tripName": "Beach Week 2026",
      "familyId": "fam_abc123",
      "familyName": "Smiths",
      "lastOpenedAt": "2026-06-07T18:22:00Z"
    }
  ]
}
```

- Multiple trips per device supported.
- `familyId` is the identity sent to Firestore; `familyName` is for display.
- `lastOpenedAt` sorts the landing-page list.
- Versioned key (`v1`) for future migrations.
- "✕ forget" on the landing page removes the entry from local storage only — does not touch Firestore.
- All reads guarded for SSR (`typeof window !== 'undefined'` + `useEffect`) to avoid hydration mismatch.

## Edge cases

**Trip:**
- Invalid code → "Trip not found. Check the code."
- Code collision on create → silently retry up to 5 times.
- Trip doc missing after entry → "This trip no longer exists" with link back to `/vacation`.

**Family identity:**
- Duplicate family name on join (case-insensitive) → "That family name is already taken on this trip."
- `?family=` link on a device already registered as a different family on this trip → confirm screen, no silent overwrite.
- Empty/whitespace family name → disable submit, trim before save.

**Expenses:**
- Amount ≤ 0 → block, inline error.
- Amount > $100,000 → block, "Amount seems too high — double-check."
- Empty place → block.
- Delete needs a confirm; edit is inline with cancel.
- Concurrent edits: last write wins (Firestore default).

**Network:**
- Write failure → toast, keep form populated.
- Read failure → "Trouble loading this trip. Retry." Don't render stale data.

**Emptiness:**
- No expenses yet → Ledger: "No expenses yet. Add one to get started." Dashboard: "$0 spent. Nothing to settle."
- Solo family → Dashboard: "Share the link to get others on the trip."

## Future considerations (not v1)

- Per-expense custom splits (which families share which expense).
- Trip deletion / archiving / close-to-writes.
- Renaming families or the trip.
- Currency selector, FX rates.
- Categories, tags, receipts/photos, recurring expenses.
- CSV/PDF export.
- Email or push notifications when an expense is added.
- "Mark as paid" tracking on settlement transactions.
- Soft delete / audit log.
- Server-side validation in Firestore rules.

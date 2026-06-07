# Multi-Domain Email Client Support

## Problem

A single client may operate the same website across multiple domains (e.g., `kc360gym.com` and `kc360gymnastics.com`). Currently each client record stores one `domain` string, requiring duplicate client records with duplicate API keys to handle this. That's messy and error-prone.

## Solution

Change `domain` (string) to `domains` (array of strings) across the Firestore schema, Firebase Function, and admin UI. One client record, one API key, multiple domains — all treated identically.

---

## Firestore Schema Change

**Before:**

```
clients/{clientId}
├── domain: "kc360gym.com"
├── name: string
├── recipients: array
├── apiKey: string
├── fromName: string (optional)
├── createdAt: timestamp
└── active: boolean
```

**After:**

```
clients/{clientId}
├── domains: ["kc360gym.com", "kc360gymnastics.com"]
├── name: string
├── recipients: array
├── apiKey: string
├── fromName: string (optional)
├── createdAt: timestamp
└── active: boolean
```

The `domain` field is replaced entirely by `domains`. All domains in the array share the same recipients, API key, from name, and config.

---

## Firebase Function Changes (`functions/index.js`)

### CORS Origin Building

Currently iterates clients and reads `client.domain`. Change to flatten all `domains` arrays into the allowed origins list.

**Before:**

```js
origins.push(`https://${client.domain}`);
```

**After:**

```js
client.domains.forEach(d => origins.push(`https://${d}`));
```

### `validateClient(origin, apiKey)`

Currently queries `where("domain", "==", origin)`. Change to `where("domains", "array-contains", origin)`.

This is a native Firestore query operator — no extra indexing or client-side filtering needed.

### Localhost Bypass

No change. The existing localhost check happens before the domain query.

### Everything Else

Rate limiting, email sending, validation — untouched. Domains are only checked at the CORS and validation layer.

---

## Admin UI Changes

### `ClientForm.jsx`

- Rename "Domain" label to "Domains"
- Input becomes comma-separated, matching the existing pattern used for recipient emails
- On save: split by comma, trim whitespace, strip protocols and trailing slashes (reuse existing logic), store as array
- On edit/load: join the array back to a comma-separated string for the input
- Validation: at least one domain required

### `ClientList.jsx`

- Table column changes from showing a single domain to showing domains joined by ", "

---

## Data Migration

Existing client documents need a one-time update:

1. Rename `domain` field to `domains`
2. Wrap the existing string value in an array

This can be done manually in the Firebase console or with a simple migration script. There are only a handful of client records.

---

## Files to Modify

| File | Change |
|------|--------|
| `functions/index.js` | CORS building, `validateClient` query, origin extraction |
| `src/components/admin/ClientForm.jsx` | Domain input to comma-separated domains input |
| `src/components/admin/ClientList.jsx` | Display domains array instead of single domain |

## No Changes Required

- `firestore.rules` — no rule changes needed
- `src/lib/firebase.js` — no config changes
- Rate limiting logic — keyed by clientId, not domain
- Email sending logic — domain-agnostic

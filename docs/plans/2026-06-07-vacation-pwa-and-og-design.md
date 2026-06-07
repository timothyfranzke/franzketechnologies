# Vacation Splitter — PWA + Dynamic OG — Design

**Date:** 2026-06-07
**Status:** Design approved, ready for implementation
**Sub-app path:** `/vacation`
**Builds on:** [`2026-06-07-vacation-expense-splitter-design.md`](./2026-06-07-vacation-expense-splitter-design.md)

## Summary

Two additions to the existing `/vacation` sub-app:

1. **Vacation-only PWA.** Installable from `/vacation`, with an offline-capable app shell and Firestore's built-in offline persistence. Lets families keep using the app on flaky hotel wifi and have a real "open the app" experience during a trip.
2. **Dynamic Open Graph image.** When a trip link is shared, the unfurl shows a personalized card — "Smiths is owed $120 on Beach Week 2026" — generated on demand by a Firebase Function. Falls back to trip stats when the family isn't on the trip yet, and to a generic card when no trip is referenced.

Marketing/games parts of the site stay unchanged.

## Goals

- Installable home-screen app scoped to `/vacation`.
- Recently-opened trips stay viewable offline; new expenses queue and sync.
- Shared trip links unfurl with a personalized, trustworthy preview.
- Reuse the existing Firebase Functions surface — no new hosting platforms.

## Non-goals (v1)

- Whole-site PWA. Marketing and games pages remain plain web pages.
- Background sync / push notifications.
- Pre-caching trips the user hasn't opened.
- Designed/illustrated OG imagery — text-card only for v1.
- Updating already-cached unfurls in third-party chat apps (we accept that messenger caches are stubborn; the URL version key only helps *new* shares).

## Part 1 — PWA

### Manifest

New file `public/vacation.webmanifest`:

```json
{
  "name": "Vacation Splitter",
  "short_name": "Vacation",
  "description": "Split shared trip expenses across families.",
  "start_url": "/vacation",
  "scope": "/vacation",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0ea5e9",
  "icons": [
    { "src": "/vacation/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/vacation/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/vacation/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Linked only from `/vacation/*` pages via `<link rel="manifest" href="/vacation.webmanifest">` in those pages' `<head>`. The existing `site.webmanifest` is untouched.

Scope = `/vacation`. The browser treats only `/vacation/*` URLs as in-app; clicks on links outside the scope open in a regular browser, which is the intended behavior.

### Service worker

Tool: **Workbox** via `@vite-pwa/astro` plugin, configured with `scope: '/vacation/'` and `registerType: 'autoUpdate'`. The plugin generates and registers `sw.js`.

**Caching strategies:**

| Asset class | Strategy | Notes |
|---|---|---|
| App shell — HTML for `/vacation`, `/vacation/new`, `/vacation/join`, `/vacation/trip` | StaleWhileRevalidate | Page loads instantly from cache; updates in background. |
| JS / CSS bundles (hashed) | CacheFirst | Hashed filenames make this safe. |
| Static images under `/vacation/` | CacheFirst | Icons, illustrations. |
| Firestore SDK chunks | CacheFirst | Hashed, safe. |
| `firestore.googleapis.com` requests | **Not cached by SW** | Firestore manages its own IndexedDB cache; double-caching would cause stale-data bugs. |
| OG image function | Network-only | Never user-facing; only crawlers fetch it. |

The SW only activates for clients in `/vacation/` scope, so it won't intercept requests for `/blog`, `/games`, etc.

### Firestore offline persistence

Enable in `src/lib/firebase.js` using the modern persistent cache config:

```js
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

Effect: reads served from IndexedDB when offline; writes queued locally and replayed on reconnect. `onSnapshot` continues to fire with the cached data + pending local writes blended in, so Dashboard and Ledger keep working with no extra code.

**Multi-tab manager** chosen because users will plausibly have the app open in a regular tab and the installed PWA simultaneously.

### Offline UX surface

A small `OfflineBanner` React component mounted in `TripApp.jsx`:

- Listens to `window.online` / `window.offline` events and to Firestore's connection state via a sentinel `onSnapshot` (one-time setup; cheap).
- Renders a thin top strip in `TripApp` only (not landing/create/join) when offline: *"You're offline. Changes will sync when you reconnect."*
- Does **not** disable the Add Expense form — submits go into the Firestore queue and Dashboard reflects them via the same snapshot stream.

### Install prompt UX

A small `InstallButton` React island, mounted on the `/vacation` landing page header and (one-time, dismissible) at the bottom of the share tab.

**Behavior:**

1. On mount, listen for `beforeinstallprompt`. Stash the event, render an "Install app" button.
2. Click → call `event.prompt()`, then hide.
3. After dismissal — whether the user installs or declines — set `localStorage['franzke.vacation.installPromptDismissed'] = '1'` and don't render again.
4. **iOS Safari fallback:** detect iOS + Safari + non-standalone. Show a one-line hint instead of the button: *"To install: tap Share → Add to Home Screen."* Same dismissal key.
5. If `display-mode: standalone` matches (already installed), render nothing.

### Icons

Three PNGs need to exist:
- `/vacation/icon-192.png` (192×192, transparent or solid bg)
- `/vacation/icon-512.png` (512×512, same)
- `/vacation/icon-512-maskable.png` (512×512, art inside the safe zone — see [maskable.app](https://maskable.app))

Source: a vacation-themed mark (suitcase, palm, or stylized "V") on the `#0ea5e9` theme color. Generated once and committed to `public/vacation/`.

## Part 2 — Dynamic Open Graph image

### Architecture

The trip page (`/vacation/trip`) becomes **SSR'd on Netlify** so it can inject per-request OG meta tags. Everything else in the site stays static.

```
astro.config.mjs
  + import netlify from '@astrojs/netlify';
  + output: 'static',           // default for the rest of the site
  + adapter: netlify(),         // SSR available per-route via prerender:false
```

In `src/pages/vacation/trip.astro`:

```astro
---
export const prerender = false;
const url = Astro.url;
const code = url.searchParams.get('code');
const family = url.searchParams.get('family');
const ogUrl = await buildOgUrl({ code, family });   // see below
const ogTitle = await buildOgTitle({ code, family });
---
<head>
  <meta property="og:image" content={ogUrl} />
  <meta property="og:title" content={ogTitle} />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
```

`buildOgUrl` / `buildOgTitle` do a single Firestore Admin read of `trips/{code}` (and `expenses` for totals), returning:

- **Family exists on trip:** `og:image = /.netlify/functions/og?code=K7M2PQ&family=Smiths&v=<n>`; title = `"Smiths owes $80 on Beach Week 2026"` (or "is owed", or "is settled up").
- **Family in URL but not on trip:** trip-stats variant — title = `"Beach Week 2026 — $1,240 across 3 families"`, image with the same content.
- **No family in URL:** trip-stats variant.
- **Trip doesn't exist:** generic site OG, no extra fetch.

The SSR'd page uses `firebase-admin` from a tiny new helper (`src/lib/firebase-admin.js`) — read-only, scoped to the trip doc and a `count()` aggregation on expenses to keep the page-render cost to two cheap reads.

### OG image rendering function

New Firebase Function (or, equivalently, a Netlify Function — see "Hosting decision" below): **`og`**.

```
GET /.netlify/functions/og?code=K7M2PQ&family=Smiths&v=17
→ 200, Content-Type: image/png, 1200×630
```

**Pipeline:**

1. Read `code`, `family`, `v` from query string.
2. Look up `trips/{code}` via `firebase-admin`. If missing, return a generic "Vacation Splitter" PNG.
3. Compute the family's net (same settlement math as the in-app dashboard, shared from `src/lib/settlement.js`).
4. Pick a layout variant:
   - `family exists, net > 0` → green card, "Smiths is owed $120 · Beach Week 2026"
   - `family exists, net < 0` → amber card, "Smiths owes $80 · Beach Week 2026"
   - `family exists, net = 0` → neutral card, "Smiths is settled up · Beach Week 2026"
   - `family in URL but not on trip` → neutral card, "Beach Week 2026 · $1,240 across 3 families"
   - `no family` → neutral card, trip stats only
5. Render via **Satori** (JSX → SVG) and **@resvg/resvg-js** (SVG → PNG). Both pure-JS, no native compile.
6. Return PNG with `Cache-Control: public, max-age=60, s-maxage=300`.

The settlement math file moves out of the React component into `src/lib/settlement.js` so both the dashboard and the OG function import the same source of truth.

### Hosting decision — Firebase Function vs Netlify Function

Netlify Function wins:
- The page is already SSR'd on Netlify; co-locating the OG function avoids a cross-domain hop (`og:image` on `firebaseapp.com` is fine but adds latency and a CORS-ish footgun for some crawlers).
- One deploy target for the new code paths.
- The existing `sendEmail` Firebase Function stays where it is — no migration.

The Netlify Function uses the same Firestore project via `firebase-admin` with a service-account JSON loaded from an env var. Service account is read-only on `trips` for least privilege.

### Cache-busting / staleness

Two layers, per the design discussion:

1. **`v=` param in the og:image URL.** Computed during SSR as the trip's `expenseCount` (cheap Firestore `count()` aggregation, no full read). When an expense is added/edited/deleted, the count changes, the URL changes, and new shares unfurl with fresh data.
2. **Short `Cache-Control`** on the function (`max-age=60, s-maxage=300`). Covers Netlify's edge cache and any well-behaved intermediaries.

Explicitly accepted: messenger apps (iMessage, Slack, Discord) cache unfurls aggressively at the URL level. A link shared before more expenses were added will keep showing its snapshot in that chat — by design.

### URL / family-name handling

- Family names are user input. URL-encode on the share side (`encodeURIComponent`) and decode on the SSR/function side.
- Names with `&`, `?`, `#`, emoji, unicode → must round-trip cleanly. Add a test.
- Truncate display in the OG image at ~30 chars with ellipsis to keep the card legible.
- A family in the URL that doesn't exist on the trip falls through to the trip-stats variant — no error card.

## Edge cases

**PWA:**
- User installs on iOS — `start_url` opens `/vacation` directly; subsequent navigation within `/vacation/*` stays in standalone, links to `/blog` etc. open in Safari (system default for out-of-scope links).
- Service worker update mid-session — Workbox `autoUpdate` activates new SW on next navigation, no toast/prompt needed (we're not stretching for a "new version available" UX in v1).
- Multi-tab: persistent multi-tab cache handles two tabs gracefully. Two different families on the same device in two tabs — already supported by the existing local-storage design.
- Offline + new trip creation: the create flow needs a Firestore write to claim the code. Block with an inline "Connect to the internet to create a trip" message rather than queueing (queueing a code claim is racy against another device taking the same code).
- Offline + join with a fresh code: same — block, prompt to reconnect. Joining an already-cached trip works offline.

**OG:**
- Trip doesn't exist → generic OG, no Firestore error surfaced to the crawler.
- Firestore read in SSR fails → fall through to generic OG; log; page still renders.
- Function timeout / error → return a static generic PNG (bundled with the function) rather than 500, so the unfurl never breaks.
- Very long trip names → truncate at ~40 chars.
- Negative-zero edge case in settlement math → treat `|net| < 1 cent` as settled.

## Files touched / added

```
astro.config.mjs                          # add Netlify adapter
package.json                              # +@astrojs/netlify, +@vite-pwa/astro, +satori, +@resvg/resvg-js, +firebase-admin (root, for SSR)
public/vacation.webmanifest               # NEW
public/vacation/icon-192.png              # NEW
public/vacation/icon-512.png              # NEW
public/vacation/icon-512-maskable.png     # NEW
src/lib/firebase.js                       # switch to initializeFirestore + persistentLocalCache
src/lib/firebase-admin.js                 # NEW — SSR-side read helper
src/lib/settlement.js                     # NEW — extract math from Dashboard.jsx
src/components/vacation/Dashboard.jsx     # import settlement from lib
src/components/vacation/OfflineBanner.jsx # NEW
src/components/vacation/InstallButton.jsx # NEW
src/components/vacation/TripApp.jsx       # mount OfflineBanner
src/components/vacation/VacationLanding.jsx # mount InstallButton
src/pages/vacation/index.astro            # <link rel="manifest"> + register SW
src/pages/vacation/new.astro              # <link rel="manifest">
src/pages/vacation/join.astro             # <link rel="manifest">
src/pages/vacation/trip.astro             # prerender:false + dynamic OG meta
netlify/functions/og.ts                   # NEW — Satori + Resvg image render
netlify.toml                              # NEW (if not already present) — function config, env
```

## Implementation order

1. Extract settlement math to `src/lib/settlement.js`; verify dashboard parity.
2. Add Netlify adapter; flip `/vacation/trip` to `prerender:false`; verify it still renders identically with no OG changes.
3. Add `firebase-admin` SSR helper; wire trip-doc + count read into trip.astro frontmatter.
4. Build the Netlify `og` function with Satori + Resvg. Test each variant (owes / owed / settled / no-family / trip-only / not-found) via direct URL.
5. Wire OG meta tags into trip.astro.
6. Add `@vite-pwa/astro`, manifest, icons. Verify install flow on Chrome desktop, Android, iOS.
7. Switch Firestore to persistent cache; add OfflineBanner; manual offline test (devtools → Offline) for view + add expense.
8. Add InstallButton + iOS hint.
9. End-to-end: share a link from one device, unfurl in iMessage/Slack, install on a phone, go offline, add an expense, come back online.

## Future considerations (not v1)

- Push notifications when an expense is added (would need server-side trigger + user opt-in).
- "New version available" SW update toast.
- Branded / illustrated OG variants (still Satori; just richer JSX).
- Per-family OG variants that include settlement transactions ("Joneses owes Smiths $80").
- Background sync API for write retries (current Firestore queue handles 99% of this).
- Whole-site PWA, if/when another sub-app earns it.

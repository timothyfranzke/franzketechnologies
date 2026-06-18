# Client Resource Pages — Design

**Date:** 2026-06-18
**Status:** Approved, ready to implement
**Initial client:** C26 Aquatics

## Problem

I have in-progress client deliverables (wireframes, mockup images, eventually copy drafts and live preview links) that I need to share with clients during a build. Today, I email files or send Drive links. I want a shareable URL on this site where a client can see everything in one place, organized.

First real use: C26 Aquatics. Resources currently sit in `c26/` at the project root (PDF wireframes + ~6 mockup images).

## Non-goals

- Not a CMS or admin UI — manifests are hand-edited JSON, committed to git.
- Not an outreach/prospect preview — that's the existing `/sites/[guid]` flow and stays untouched.
- No auth, no comments, no approval workflow at v1. The share URL is the access control.
- No image optimization pipeline — these are short-lived review pages, not LCP-critical traffic.

## URL & routing

```
/clients/[guid]   →  src/pages/clients/[guid].astro
```

- `guid` is the client slug (`c26`, `riverbend-bakery`). Short, lowercase, URL-safe.
- `getStaticPaths` reads every `*.json` in `src/content/clients/`, builds a page per file keyed by `guid`.
- Pages emit `<meta name="robots" content="noindex, nofollow">`. Share via the URL; the guid is the secret.
- No `/clients` index page — pages are reachable only by direct link.

## File layout

```
src/content/clients/
  c26.json                          ← manifest

public/clients/c26/
  wireframes.pdf
  homepage-hero.png
  mobile-nav.png
  logo-concept-1.png
  ...

src/pages/clients/[guid].astro      ← entry, defers to ClientLayout
src/layouts/ClientLayout.astro      ← page chrome
src/components/client/
  ClientHeader.astro
  ClientSection.astro
  items/
    ImageItem.astro
    PdfItem.astro
    LinkItem.astro

src/lib/clients/schema.ts           ← types + Zod validation
```

All asset URLs in the manifest are absolute from site root (`/clients/c26/wireframes.pdf`). Rendering components don't need to know about the source folder.

Adding a new client is: drop files in `public/clients/[guid]/`, write the JSON manifest, commit, Netlify deploys.

## Manifest schema

```typescript
// src/lib/clients/schema.ts

export type ClientItem =
  | { type: "image"; src: string; caption?: string; alt?: string }
  | { type: "pdf"; src: string; caption?: string }
  | { type: "link"; href: string; label: string; caption?: string };

export interface ClientSection {
  title: string;
  description?: string;
  items: ClientItem[];
}

export interface ClientPage {
  guid: string;
  client: string;         // "C26 Aquatics"
  title?: string;         // page <title>; defaults to "{client} — Project Resources"
  intro?: string;         // optional paragraph above the first section
  sections: ClientSection[];
  updatedAt?: string;     // ISO date, shown in footer
}
```

- A Zod schema parses each manifest at build time. Malformed JSON fails the build with a clear message.
- `alt` falls back to `caption` if absent. Captions and labels are required where they make a difference to the client's understanding.
- Three item types at v1: `image`, `pdf`, `link`. `note` (markdown) and `video` deferred.

### Example: `src/content/clients/c26.json`

```json
{
  "guid": "c26",
  "client": "C26 Aquatics",
  "intro": "Where we are on the C26 site. Have a look, jot down anything that feels off, and let me know.",
  "updatedAt": "2026-06-18",
  "sections": [
    {
      "title": "Wireframes",
      "description": "Page structure and content blocks — no styling yet.",
      "items": [
        { "type": "pdf", "src": "/clients/c26/wireframes.pdf", "caption": "Full wireframe deck" }
      ]
    },
    {
      "title": "Visual direction",
      "description": "Early mockups exploring tone and feel.",
      "items": [
        { "type": "image", "src": "/clients/c26/homepage-hero.png", "caption": "Homepage hero", "alt": "Homepage hero mockup" },
        { "type": "image", "src": "/clients/c26/mobile-nav.png", "caption": "Mobile navigation" }
      ]
    }
  ]
}
```

## Layout & rendering

**Page chrome** (`ClientLayout.astro`)

```
┌─────────────────────────────────────────┐
│  ClientHeader                           │
│  ──────────────                         │
│  C26 Aquatics                           │
│  Project Resources                      │
│  (small) Prepared by Franzke Tech       │
└─────────────────────────────────────────┘

  {intro paragraph, if present}

┌── Wireframes ──────────────────────────┐
│  Page structure and content blocks...   │
│  ┌─ PDF item ─────────┐                │
│  │ 📄 Full wireframe   │  [Open PDF →] │
│  │    deck             │                │
│  └─────────────────────┘                │
└─────────────────────────────────────────┘

┌── Visual direction ────────────────────┐
│  Early mockups exploring tone...        │
│  ┌──── homepage-hero.png ────────┐    │
│  │       (image fills width)      │    │
│  └────────────────────────────────┘    │
│  Homepage hero                          │
│   ...                                   │
└─────────────────────────────────────────┘

  Last updated 2026-06-18 · Built by Franzke Technologies
```

**Components**

- `ClientHeader` — client name (large), "Project Resources" subtitle, "Prepared by Franzke Technologies" attribution (text link to homepage, no logo).
- `ClientSection` — heading + optional description, then maps over `items` and dispatches by `type` to the right item component.
- `ImageItem` — full-width responsive `<img>`, `loading="lazy"`, rounded corners, subtle border, caption below in muted text. Click opens in a new tab (native zoom, no lightbox library).
- `PdfItem` — card with PDF icon, caption, and "Open PDF →" button opening in a new tab. No inline iframe — better mobile behavior.
- `LinkItem` — card with label, optional caption, opens in new tab.

**Styling**

- Reuses the site's existing Tailwind config — no separate design system.
- Light mode only at v1.
- Max content width ~800px so images don't sprawl on wide monitors.
- Neutral Franzke chrome — no per-client branding inside the wrapper. The content is the client's work; the wrapper is the delivery surface.

## Implementation order

1. **Schema + types** — `src/lib/clients/schema.ts` with Zod validation.
2. **Layout shell** — `ClientLayout.astro` with header/footer + `noindex` meta. Hard-coded dummy content first to nail typography.
3. **Components** — `ClientHeader`, `ClientSection`, `ImageItem`, `PdfItem`, `LinkItem`.
4. **Route** — `src/pages/clients/[guid].astro` with `getStaticPaths` reading `src/content/clients/*.json`.
5. **c26 content** — Move files from `c26/` (project root) into `public/clients/c26/` with friendlier filenames. Author `src/content/clients/c26.json`.
6. **Verify** — `npm run dev`, visit `/clients/c26`, check mobile viewport, confirm PDF opens cleanly, confirm `noindex` in `<head>`.

## Open items deferred to later

- `note` item type (markdown text blocks for decisions, copy drafts).
- `video` item type (mp4 or YouTube embed).
- Image lightbox / inline zoom.
- Per-client theming (logo, accent color).
- Update timestamps per item (not just per page).
- `/clients` index for me (not the public).

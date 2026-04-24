# Nightly Prospect Agent — Implementation Plan

**Date:** 2026-04-24
**Design doc:** `docs/plans/2026-04-24-nightly-prospect-agent-design.md`
**Branch:** `worktree-nightly-prospect-agent`

## Guiding principle

Build the **preview-page machinery first with a sample prospect**, verify it end-to-end in the browser, then wire up the agent that produces real prospects. This de-risks the part that actually has to look good.

## File inventory

New files:
```
.claude/routines/nightly-prospect.md        # the agent prompt
data/target-cities.json                     # rotation list
data/run-state.json                         # rotation index + last run
data/sites-pitched.json                     # ledger (starts as [])
src/content/sites/sample.json               # seed test prospect
src/content/sites/.gitkeep                  # keep dir under version control
src/pages/sites/[guid].astro                # dynamic route
src/components/preview/PreviewRibbon.astro
src/components/preview/PreviewHero.astro
src/components/preview/PreviewServices.astro
src/components/preview/PreviewReviews.astro
src/components/preview/PreviewHoursLocation.astro
src/components/preview/PreviewContactCTA.astro
src/components/preview/PreviewFooter.astro
src/layouts/PreviewLayout.astro             # wraps a prospect page
src/lib/preview/palette.ts                  # vertical → gradient lookup
src/lib/preview/schema.ts                   # TypeScript types for the JSON
outreach/.gitkeep
runs/.gitkeep
public/sites/.gitkeep
```

Modified files:
```
.gitignore                                  # ensure runs/ committed; hero assets tracked
astro.config.mjs                            # if any trailing-slash or path tweaks needed
```

Possibly modified (verify, don't assume):
```
.github/workflows/*.yml                     # confirm content/ changes trigger build
```

## Phase 1 — Preview page machinery (sample prospect)

Goal: visiting `localhost:4321/sites/sample` renders a polished, complete-looking prospect homepage.

### Step 1.1 — Data schema + sample

1. Write `src/lib/preview/schema.ts`:
   ```ts
   export interface ProspectSite {
     guid: string;
     name: string;
     city: string;
     state: string;
     category: string;                   // Google category
     vertical: "food-hospitality" | "service-trade"
              | "professional-services" | "retail" | "generic";
     rating: number;
     reviewCount: number;
     phone?: string;
     address?: string;
     hours?: Record<string, string>;     // e.g. { monday: "8–5" }
     services: string[];
     reviewQuotes: { text: string; author?: string }[];
     heroPhoto?: string;                 // path under /sites/{guid}/hero.jpg
     tagline?: string;
   }
   ```

2. Write `src/content/sites/sample.json` — a realistic-looking test prospect (fake but plausible, e.g. "Riverbend Bakery" in Topeka, vertical `food-hospitality`, with a couple of review quotes, hours, services).

### Step 1.2 — Dynamic route

`src/pages/sites/[guid].astro`:
- `getStaticPaths()` reads every `.json` in `src/content/sites/` and returns `{ params: { guid }, props: { data } }` for each.
- Renders `PreviewLayout` with the prospect data.

### Step 1.3 — Components (build bottom-up)

Build in this order, checking visually after each:

1. **`PreviewRibbon.astro`** — sticky top ribbon. Props: `businessName`, `guid`. Text: "Preview for {name} — This is what your website could look like. Built by Tim Franzke." + "Let's talk →" button linking to `/contact?ref={guid}`. Dismissible via a small `[×]` with `localStorage` flag. Slim — max ~48px.

2. **`PreviewHero.astro`** — props: `name`, `tagline`, `heroPhoto?`, `vertical`. If `heroPhoto`: full-bleed image with dark gradient overlay + centered name. If not: typographic gradient using `palette.ts` lookup for the vertical, name in large display type.

3. **`palette.ts`** — map each vertical to a Tailwind gradient triplet (warm amber for food, cool slate-blue for service-trade, neutral for generic, etc.).

4. **`PreviewServices.astro`** — simple 3-column card strip from `services[]`. Icons by vertical (pick a static set per vertical for v1).

5. **`PreviewReviews.astro`** — "Why customers love us" — up to 3 review quotes with the ★ rating header above.

6. **`PreviewHoursLocation.astro`** — two-column: hours list + address (link to Google Maps) + phone.

7. **`PreviewContactCTA.astro`** — big "Get in touch" section. Phone-to-call + a simple mailto if an email is present. For v1: just the phone + a fake form (no submission) — we're not building real contact infra for demo pages.

8. **`PreviewFooter.astro`** — business name, "© {year}", and a subtle credit: "Designed by [Franzke Technologies](https://franzketechnologies.com)". Small, not loud.

9. **`PreviewLayout.astro`** — composes the above in order: Ribbon, Hero, Services, Reviews, HoursLocation, ContactCTA, Footer. Sets `<title>` to the business name and a meta description.

### Step 1.4 — Manual validation

Run `npm run dev` and hit `localhost:4321/sites/sample`. Verify:
- [ ] Ribbon is sticky, dismissible, links to `/contact?ref=sample`
- [ ] Hero with gradient fallback renders cleanly (delete `heroPhoto` to test)
- [ ] All sections render with the sample data
- [ ] Mobile (≤ 375px) is usable
- [ ] Light mode looks deliberate (dark mode can follow later if needed)
- [ ] `npm run build` succeeds and emits `dist/sites/sample/index.html`

Commit: **"add prospect preview page template and sample prospect"**

## Phase 2 — Data scaffolding

### Step 2.1 — Seed data files

- `data/target-cities.json`:
  ```json
  [
    { "city": "Kansas City", "state": "MO" },
    { "city": "Topeka", "state": "KS" },
    { "city": "St. Louis", "state": "MO" },
    { "city": "Omaha", "state": "NE" },
    { "city": "Des Moines", "state": "IA" },
    { "city": "Springfield", "state": "MO" },
    { "city": "Wichita", "state": "KS" },
    { "city": "Lincoln", "state": "NE" }
  ]
  ```
- `data/run-state.json`: `{ "rotationIndex": 0, "lastRunAt": null }`
- `data/sites-pitched.json`: `[]`

### Step 2.2 — Empty dirs

Create `outreach/.gitkeep`, `runs/.gitkeep`, `public/sites/.gitkeep`.

Commit: **"add data scaffolding for nightly prospect agent"**

## Phase 3 — Agent briefing

Write `.claude/routines/nightly-prospect.md` — the full prompt the `/schedule` agent will execute. Structure:

1. **Role & goal** — one paragraph: the agent's job is to find one qualifying prospect tonight and produce the four artifacts.
2. **Voice guidelines** — lifted from `CLAUDE.md`: practical, low-pressure, "I" not "we," concise.
3. **Research procedure** — the step-by-step from the design doc (pick city → search → filter → enrich → generate).
4. **Filter criteria** — rating ≥ 4.5, reviews ≥ 20, no-site-or-social-only, not in ledger.
5. **File contracts** — exact paths and shapes for each artifact, referencing the schema in `src/lib/preview/schema.ts`.
6. **Email draft guidance** — show one good and one bad example so the agent learns the voice.
7. **Git workflow** — stage, commit with message `prospect: {business name} — {city}`, push to `main`.
8. **Failure paths** — what to do in each scenario from the design's failure table.
9. **Run log** — required fields in `runs/{YYYY-MM-DD}.log`.

Commit: **"add nightly prospect agent briefing"**

## Phase 4 — Deploy pipeline check

Look at `.github/workflows/` and confirm:
- The build runs on push to `main`
- It picks up changes under `src/content/sites/**` and `public/sites/**`
- Firebase deploy step runs after build

If path filters exclude the new directories, add them. Test by committing a throwaway update to `src/content/sites/sample.json` and watching the Action.

Commit (if changes needed): **"ensure prospect content triggers deploy"**

## Phase 5 — First manual dry run

**Before enabling the nightly cron**, trigger the routine manually once:

1. Register the routine in `/schedule` pointing at `.claude/routines/nightly-prospect.md`, but **don't set the cron yet** — use one-shot mode.
2. Run it. Review the resulting commit *on the worktree branch* (not main) — inspect the JSON, the generated page at `localhost:4321/sites/{guid}`, the outreach file, and the run log.
3. If it looks good: merge to main, set the cron to `0 7 * * *` UTC.
4. If it needs tuning: iterate on the agent briefing, rerun, repeat.

Gate for going live:
- [ ] Generated JSON validates against the schema
- [ ] Preview page renders without layout issues (spot check 2–3 verticals)
- [ ] Outreach email reads like a human wrote it, references specifics from research
- [ ] Ledger append is clean JSON (no trailing-comma errors)
- [ ] Run log captures rejected candidates with reasons

## Phase 6 — Enable nightly cron

Register with `/schedule`:
- Cron: `0 7 * * *` UTC
- Runbook file: `.claude/routines/nightly-prospect.md`
- Notification preference: none for success, email-on-failure

Merge worktree branch to main.

## Out of scope for v1

Explicitly deferred — add later only if needed:
- Multiple vertical template variants (ship with `generic` only)
- Hero image post-processing (cropping, color grading)
- Automated email send (stays manual from Gmail)
- Analytics on prospect pages (add if open rates become a question)
- Opt-out / removal requests (if a prospect asks their preview down, manual delete is fine for v1)
- Revisit thresholds if the agent consistently fails to find candidates after 2 weeks of runs

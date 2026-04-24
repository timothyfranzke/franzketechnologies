# Nightly Prospect Agent Design

**Date:** 2026-04-24
**Owner:** Timothy Franzke

## Purpose

A scheduled remote agent (via Claude `/schedule`) that runs once per night, researches local businesses in the Midwest with strong reputations but weak web presence, and produces a complete outreach package: a mocked preview homepage hosted at `franzketechnologies.com/sites/{guid}`, a drafted email, and a ledger entry — all committed to this repo so the existing GitHub Action deploys the preview automatically.

The goal is lead generation by demonstration: the prospect clicks a link and sees what their website could look like, built for them specifically.

## Scope Decisions

| Decision | Choice |
|---|---|
| Geography | Wider Midwest (rotates: Kansas City, Topeka, St. Louis, Omaha, Des Moines, Springfield, Wichita, Lincoln) |
| Business type | Any local business |
| Research data source | WebSearch + WebFetch only (no API keys) |
| Web-presence filter | No website OR social-only (Facebook/Instagram-only) |
| Rating threshold | ≥ 4.5 stars AND ≥ 20 reviews |
| Page style | Template with vertical variants; custom hero per business |
| Hero image | Scrape from business's own listing; fall back to typographic gradient |
| Preview framing | Franzke "preview ribbon" header on top of a mocked homepage |
| Outreach delivery | Markdown file in repo (`outreach/{guid}.md`) |
| Contact channel | Email preferred, phone as fallback |
| Deploy path | Agent commits + pushes; existing GitHub Action deploys to Firebase |

## High-Level Flow

The routine runs at 02:00 Central nightly and produces four artifacts per successful run:

1. **Business data** — `src/content/sites/{guid}.json`
2. **Preview page** — one Astro dynamic route renders every JSON as a static page at `/sites/{guid}`
3. **Outreach file** — `outreach/{guid}.md` (your copy-paste email)
4. **Ledger update** — `data/sites-pitched.json` appends the pitch record

Agent commits, pushes to `main`, GitHub Action deploys. No further human intervention needed for the preview to go live.

## Nightly Agent Workflow

### 1. Pick a seed city
Rotate through `data/target-cities.json`. The rotation index lives in `data/run-state.json` and increments each night so coverage stays even.

### 2. Research
Run WebSearch variants such as `"top rated [vertical] in [city] google reviews"`. Crawl Google Maps, Yelp, and BBB results for 5–10 candidates. For each, extract:
- Name, rating, review count, address, phone, category
- The "website" field — and verify it. If it's a Facebook/Instagram URL, flag social-only. If it's a domain, fetch it; if it 404s, is parked, or redirects to Facebook, also social-only.

### 3. Filter
A candidate qualifies if:
- Rating ≥ 4.5 AND reviews ≥ 20
- No website OR social-only
- Not already in `data/sites-pitched.json` (checked by normalized name + city)

First qualifying candidate wins. Log runners-up in the ledger as `rejected` with a reason.

### 4. Enrich
For the chosen business, scrape:
- Hours, services offered
- A usable hero photo (from Facebook or Google listing)
- Owner/contact name if visible
- An email address (Facebook About, BBB, Chamber directory)

If no email is found, capture a phone number and set the outreach channel to `phone`. If neither is discoverable, reject and keep searching.

### 5. Generate
Write the JSON, outreach file, and (if enrichment found a photo) `public/sites/{guid}/hero.jpg`. Commit, push.

## Site Structure

### File layout per prospect
```
src/content/sites/{guid}.json      # business data
public/sites/{guid}/hero.jpg       # scraped hero (optional)
outreach/{guid}.md                 # your copy-paste email
```

### Single Astro route, many pages
`src/pages/sites/[guid].astro` uses `getStaticPaths()` to enumerate every JSON under `src/content/sites/` and emit a static page per candidate at build time. Firebase stays a pure static host.

### Template sections (shared)
- Franzke preview ribbon (sticky top, dismissible)
- Hero
- Services strip
- "Why customers love us" — pulled from scraped Google reviews
- Hours + location
- Contact CTA
- Footer with subtle Franzke credit

### Vertical variants
The agent picks a variant from the Google category: `food-hospitality`, `service-trade`, `professional-services`, `retail`, `generic`. Variants differ in section order, iconography, and copy tone. Start with one and add as common verticals emerge.

### Hero treatment
- If `hero.jpg` exists: full-bleed image with gradient overlay + business name
- If not: typographic gradient hero — Tailwind gradient palette chosen from a vertical lookup, business name as display type

### Preview ribbon copy
> **Preview for {Business Name}** — This is what your website could look like. Built by Tim Franzke. [Let's talk →]

The CTA links to `/contact?ref={guid}` so inbound inquiries are traceable to the preview.

## Outreach File Format

```markdown
# {Business Name} — {City}

**Channel:** email   (or: phone — no email found)
**To:** jane@patelsplumbing.com   (or: (913) 555-0123)
**Owner/contact:** Jane Patel (if discoverable)
**Preview:** https://franzketechnologies.com/sites/{guid}

## Why this business
4.8★ · 142 reviews · no website (Facebook-only). 12 years in business per FB.
Strong signal: recent reviews mention "wish they had a website so I could book."

## Suggested email
Subject: A quick preview I built for Patel's Plumbing

Hi Jane,
[drafted body referencing 1–2 specifics the agent learned — a review quote,
a service they mention, the city — so it doesn't read like a mail-merge]

Take a look: https://franzketechnologies.com/sites/{guid}
No pressure, no hard sell. If you like it, let's talk.

— Tim
```

The email body is drafted fresh each night using what the agent learned in research. It matches the CLAUDE.md voice guidelines: practical, low-pressure, "I" not "we," concise.

## Ledger

`data/sites-pitched.json` — single append-only array:

```json
[
  { "guid": "…", "name": "Patel's Plumbing", "city": "Topeka",
    "pitched_at": "2026-04-25", "status": "pitched",
    "channel": "email", "preview_url": "…" },
  { "guid": "…", "name": "…", "status": "rejected",
    "reason": "already had modern site on closer look" }
]
```

Checked before every commit. Dedup key is normalized `name + city`.

## Operations

### Scheduling
- Cron: `0 7 * * *` UTC (02:00 Central)
- Agent briefing lives at `.claude/routines/nightly-prospect.md` — the full prompt the routine executes, checked into the repo for transparency and iteration

### Failure handling

| Failure | Behavior |
|---|---|
| No candidate meets criteria in target city | Try next city in rotation that night; if all 8 exhausted, log and exit cleanly |
| Candidate qualifies but no email or phone | Reject, keep searching |
| Hero scrape fails | Fall back to typographic gradient; don't abort |
| Git push fails (conflict, auth) | Write local run log; next night's agent retries |
| GitHub Action deploy fails | Action's own alerts handle it |

### Run logs
`runs/{YYYY-MM-DD}.log` is committed every night regardless of outcome. Audit trail of what was searched, what was rejected, what shipped — and the dataset to tune thresholds if nights keep ending in "no candidate found."

### Cost
No external API keys. Only cost is Claude remote agent token usage — one research + generation run per night.

### Kill switch
Pause via `/schedule` without touching the repo.

## Open Items Before Implementation

- Write the agent briefing at `.claude/routines/nightly-prospect.md`
- Seed `data/target-cities.json` and `data/run-state.json`
- Create `src/pages/sites/[guid].astro` (single template, starting with the `generic` variant; add verticals incrementally)
- Create `outreach/` and `runs/` directories (with `.gitkeep` so they commit empty)
- Confirm the GitHub Action build includes `src/content/sites/**` as a trigger path

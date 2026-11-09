# Snowflake Report — design

Date: 2026-11-09

## Purpose

A print template at `/snowflake-report` for a 5th grade project. A kid types
six short report sections (title + paragraph), and the page lays each one out
inside a leaf-shaped snowflake lobe. Printed at 100% on letter paper, three
sheets come out with two leaves each, ready to cut out and assemble.

## Decisions

- Several leaves per sheet, cut out afterward (not one leaf per page, not a
  whole snowflake on one page).
- Six leaves total, two per sheet, three sheets. Leaves are placed side by
  side because the lobe is about 1.65× taller than wide; side by side gives
  the largest leaf that fits the 7.5 × 10 in printable area.
- One editor card per leaf with a Title input and a Paragraph textarea. The
  title renders bold at the start of the leaf text.
- Plain Astro page plus the `<leaf-text>` web component as a static script.
  No React, no server, no account.
- Text is kept in localStorage so a reload does not lose work.

## Files

- `public/snowflake-report/leaf-text.js` — the web component, with two small
  additions: the outline stroke reads `--leaf-outline` so the cut line can
  print gray while text prints black, and a `valign="middle"` attribute
  centers the text block vertically so titles land in the wide part of the
  leaf instead of breaking one word per line at the tip. Chord lookups are
  cached per element so re-rendering on each keystroke stays under 10 ms.
- `src/pages/snowflake-report.astro` — standalone page (own `<html>`, no site
  chrome), `noindex`, excluded from the sitemap in `astro.config.mjs`.
- Source Sans 3 400/700 imported from `@fontsource/source-sans-3`.

## Screen layout

Two columns on wide screens, stacked on narrow ones. Left: heading, one line
of instructions, Print and Clear buttons, six numbered cards. Right: live
preview of the three sheets. Each card shows a "too long" note when the
component had to shrink its text below 85% of the requested size (or set
`overflow`), so the kid knows which paragraph to trim.

## Data flow

On input: write `{ leaves: [{title, body} × 6] }` to localStorage under
`snowflake-report:v1`, then set each leaf's innerHTML to
`<b>Title.</b> body` with the text escaped. The component's MutationObserver
reflows. On load: restore from storage (try/catch, works without storage).

## Print

`@page { size: letter; margin: 0.5in }`. Each `.sheet` is 7.5 × 10 in with
`break-after: page` (none on the last). Two leaves side by side, each 3.5 in
wide (about 5.8 in tall). Editor, toolbar, and instructions are hidden.
Outline prints light gray, text black. Font size 12 shape units ≈ 13.5 pt
on paper. The instructions tell the user to print at 100%, not fit-to-page.

## Edge cases

- Empty leaf prints as an outline only. Blank title with a body renders the
  body alone.
- Fonts arriving late: the component re-renders on `document.fonts`
  loadingdone.
- localStorage unavailable: the page still works, it just forgets.

## Testing

Manual in the browser: type into all six cards, confirm leaves update,
reload and confirm restore, open print preview and confirm three pages with
two leaves each and no editor UI.

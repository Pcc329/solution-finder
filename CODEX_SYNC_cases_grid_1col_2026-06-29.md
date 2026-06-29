# CODEX SYNC - Cases Grid 1 Column

Date: 2026-06-29

## Branch

- Branch: `fix-cases-grid-1col`
- Base: latest `origin/main`

## Modified Files

- `public/manufacturing.html`

## Scope

This task only changes the reference cases grid layout from 3 columns to 1 column.

No data, API, filtering logic, expansion logic, recommendation logic, or Babel script tag attributes were changed.

## CSS / Class Location

Location: `public/manufacturing.html`

Element:

```html
<div id="referenceCaseList" ...></div>
```

## Before / After

Before:

```html
<div id="referenceCaseList" class="grid grid-cols-1 md:grid-cols-3 gap-3"></div>
```

After:

```html
<div id="referenceCaseList" class="grid grid-cols-1 gap-3"></div>
```

Effect:

- Mobile: remains 1 column.
- Tablet / desktop: changed from 3 columns to 1 column.
- Existing `gap-3` spacing remains unchanged.

## Validation

- `git diff --check -- public/manufacturing.html`: passed
- Inline script syntax check: `manufacturing inline scripts syntax ok: 1`
- `node --check`: not directly applicable because `manufacturing.html` is an HTML file, not a standalone `.js` file. The inline script was extracted and syntax-checked through Node parsing instead.

## Acceptance Checklist

- [x] Reference case cards render as 1 card per row.
- [x] Only the cases grid class was changed.
- [x] Case card content was not modified.
- [x] Filter logic was not modified.
- [x] Expand / collapse logic was not modified.
- [x] Official and other recommendation areas were not modified.
- [x] Cases static data constants were not modified.
- [x] Babel `<script>` tag attributes were not modified.

## Preview Screenshot

Vercel Preview screenshot is pending PR creation/deployment.

## Git

- Commit hash: see final Codex response after commit.
- PR link: see final Codex response after PR creation.


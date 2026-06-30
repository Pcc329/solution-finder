# SYNC: Rename Dashboard To 戰情室

Date: 2026-06-30
Branch: feat-strategy-merge-p2-import

## Scope

Renamed dashboard display text from `整合策略儀表板` to `戰情室`.

Only display text was changed. Dashboard route remains `/dashboard.html`.

## Changed Locations

- `public/dashboard.html`
  - `<title>`: `資服產業資料庫 整合策略儀表板` -> `資服產業資料庫 戰情室`
  - global nav `/dashboard.html` link: `整合策略儀表板` -> `戰情室`
  - page-head H1: `資服業產業資料庫｜整合策略儀表板` -> `資服業產業資料庫｜戰情室`
- `public/index.html`
  - global nav `/dashboard.html` link: `整合策略儀表板` -> `戰情室`
- `public/compare.html`
  - global nav `/dashboard.html` link: `整合策略儀表板` -> `戰情室`
- `public/diagnosis.html`
  - global nav `/dashboard.html` link: `整合策略儀表板` -> `戰情室`
- `public/manufacturing.html`
  - global nav `/dashboard.html` link: `整合策略儀表板` -> `戰情室`
- `public/sources.html`
  - global nav `/dashboard.html` link: `整合策略儀表板` -> `戰情室`
- `public/strategy-guide.html`
  - global nav `/dashboard.html` link: `整合策略儀表板` -> `戰情室`

## Guardrails

- Did not modify `/api/`.
- Did not modify any `<script>` or Babel tag attributes.
- Did not change dashboard route, anchor-nav, dashboard sections, or business logic.

## Verification

- `rg -n -F "整合策略儀表板" public --glob "*.html"`:
  - PASS: no matches.
- `rg -n -F "戰情室" public --glob "*.html"`:
  - PASS: 9 expected matches.
- `git diff --check -- public/index.html public/dashboard.html public/compare.html public/diagnosis.html public/manufacturing.html public/sources.html public/strategy-guide.html`:
  - PASS, only Git line-ending warnings.
- Inline script syntax check:
  - PASS: `dashboard.html`, `compare.html`, `diagnosis.html`, `manufacturing.html`, `strategy-guide.html`
  - `sources.html` has no inline script.
- `git diff -- api`:
  - PASS: no diff.

## Commit / PR

- Implementation Commit: ddef0fb
- SYNC Commit: see latest branch commit after this file update
- PR: https://github.com/Pcc329/solution-finder/compare/main...feat-strategy-merge-p2-import

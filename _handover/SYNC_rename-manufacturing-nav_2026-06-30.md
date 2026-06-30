# SYNC: Rename Manufacturing Nav To 方案探索

Date: 2026-06-30
Branch: feat-strategy-merge-p2-import

## Scope

Renamed the public-facing manufacturing page label from `製造業方案探索` to `方案探索`.

The route remains `/manufacturing.html`.

## Changed Locations

- `public/index.html`
  - global nav `/manufacturing.html` link: `製造業方案探索` -> `方案探索`
- `public/dashboard.html`
  - global nav `/manufacturing.html` link: `製造業方案探索` -> `方案探索`
- `public/compare.html`
  - global nav `/manufacturing.html` link: `製造業方案探索` -> `方案探索`
- `public/diagnosis.html`
  - global nav `/manufacturing.html` link: `製造業方案探索` -> `方案探索`
- `public/manufacturing.html`
  - `<title>`: `製造業方案探索 | Solution Finder` -> `方案探索 | Solution Finder`
  - global nav `/manufacturing.html` link: `製造業方案探索` -> `方案探索`
  - restore-message product label: `已還原上一輪製造業方案探索結果。...` -> `已還原上一輪方案探索結果。...`
- `public/sources.html`
  - global nav `/manufacturing.html` link: `製造業方案探索` -> `方案探索`
- `public/strategy-guide.html`
  - global nav `/manufacturing.html` link: `製造業方案探索` -> `方案探索`

## Guardrails

- Did not modify `/api/`.
- Did not modify any `<script>` or Babel tag attributes.
- Did not change `/manufacturing.html` route.
- Did not change manufacturing page H1:
  - remains `AI分析 幫你找出適合方案`.
- Did not remove or rewrite manufacturing-specific content such as page descriptions, source data, cases, or recommendation logic.

## Verification

- `rg -n -F "製造業方案探索" public --glob "*.html"`:
  - PASS: no matches.
- `rg -n -F "方案探索" public --glob "*.html"`:
  - PASS: expected nav/title/message matches.
- `git diff --check -- public/index.html public/dashboard.html public/compare.html public/diagnosis.html public/manufacturing.html public/sources.html public/strategy-guide.html`:
  - PASS, only Git line-ending warnings.
- `node --check api/claude.js`:
  - PASS.
- Inline script syntax check:
  - PASS: `dashboard.html`, `compare.html`, `diagnosis.html`, `manufacturing.html`, `strategy-guide.html`
  - `sources.html` has no inline script.
- `git diff -- api`:
  - PASS: no diff.

## Commit / PR

- Implementation Commit: d3c358b
- SYNC Commit: see latest branch commit after this file update
- PR: https://github.com/Pcc329/solution-finder/compare/main...feat-strategy-merge-p2-import

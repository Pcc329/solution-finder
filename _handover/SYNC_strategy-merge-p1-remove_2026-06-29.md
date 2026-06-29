# SYNC - Strategy Guide Merge P1 Remove

Date: 2026-06-29
Branch: feat-strategy-merge-p1-remove

## Summary

Removed duplicate/legacy strategy-guide sections that will be merged into other pages in later patches.

## File Changed

- `public/strategy-guide.html`

## Removed Sections

Removed these full page sections:

- `<section id="market">` 市場現況
- `<section id="gap">` 產業數位需求覆蓋矩陣
- `<section id="ai">` AI 推薦

## Removed JavaScript

Removed section-specific JavaScript and data:

- `scenarios`
- `INDUSTRIES`
- `GAP_DATA`
- `toChartEntries()`
- `getLevel()`
- `avgCount()`
- `renderGapMatrix()`
- `renderBarChart()`
- `renderMarketCharts()`
- `renderScenarios()`
- `relevance()`
- `loadCandidateSolutions()`
- `renderScoreRef()`
- `submitAsk()`
- `askBtn` event binding
- startup calls to `renderScenarios()` and `renderGapMatrix()`

## Preserved

Kept the following areas working:

- Hero KPI (`kpiSolutions`, `kpiCompanies`, `kpiWeek`)
- `loadStats()` for hero KPI only
- 服務分類
- 公司圖譜
- 競爭態勢
- `catDetail`
- `renderStars()`
- `escapeHtml()`
- `fmt`
- `renderCompetitionGrid()`
- `loadCompanies()`

## Navigation Cleanup

Removed these anchor-nav and hero quick-link entries:

- `#market`
- `#gap`
- `#ai`

Remaining quick links:

- `#services`
- `#companies`
- `#competition`

Remaining anchor-nav links:

- `#top`
- `#services`
- `#companies`
- `#competition`

## Validation

- `public/strategy-guide.html` inline script syntax check: pass
- `git diff --check -- public/strategy-guide.html`: pass
- `/api/` files: no diff
- Browser/Vercel Preview screenshot: not captured in this environment

## Commit / PR

- Implementation commit: `73c9c2d`
- PR: pending

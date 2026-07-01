# SYNC_analysis-result-sticky_2026-07-01

## Branch / Commit

- Branch: `feat-strategy-merge-p2-import`
- Commit: pending before final commit

## Task

Make the right-column `分析結果` card sticky in `public/manufacturing.html`, so `重新分析` and `已產生推薦` remain visible while the recommendation list scrolls inside the right panel.

## Modified Files

- `public/manufacturing.html`
- `_handover/SYNC_analysis-result-sticky_2026-07-01.md`
- `_handover/SYNC_analysis-result-sticky_2026-07-01.png`

## CSS Selector / Implementation

Applied selector:

```css
.analysis-result-sticky {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface-2, #ffffff);
}
```

Applied to the right-column top card:

```html
<section class="card p-5 analysis-result-sticky">
```

This keeps the card sticky relative to `.diagnosis-results-panel`, which is the right-column scroll container:

```css
.diagnosis-results-panel {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}
```

## Validation

Preview:

- Local preview: `http://127.0.0.1:5192/manufacturing.html?sticky=2`
- Data source: live `/api/solutions`
- Loaded solution count: `2,322`

Questionnaire inputs:

1. `金屬加工`
2. `10-50人`
3. `剛起步`
4. `生產排程`
5. `30萬以下`

Recommendation result:

- Official recommendations: `5 筆`
- Other recommendations: `5 筆`

After right-column scroll:

```json
{
  "pageScrollY": 0,
  "resultScrollTop": 750,
  "panel": {
    "top": 208.6666717529297,
    "bottom": 768.6666717529297,
    "height": 560
  },
  "sticky": {
    "top": 208.6666717529297,
    "bottom": 451.3333435058594,
    "height": 242.6666717529297
  },
  "stickyStyle": "sticky",
  "stickyTop": "0px",
  "stickyZ": "10",
  "stickyBg": "rgb(255, 255, 255)",
  "runText": "已產生推薦",
  "runDisabled": true,
  "restartVisible": true,
  "restartEnabled": true
}
```

Result:

- Right panel scrolled independently.
- Whole page did not scroll.
- `分析結果` card remained fixed at the top of the right panel.
- `重新分析` remained visible and enabled.
- `已產生推薦` remained visible.
- Recommendation cards scrolled underneath.

Screenshot:

- `_handover/SYNC_analysis-result-sticky_2026-07-01.png`

## Acceptance Checklist

- [x] Right-column scroll keeps `分析結果` card fixed at the top.
- [x] `重新分析` and `已產生推薦` remain visible after scrolling.
- [x] Recommendation cards scroll below the sticky card.
- [x] Sticky card background is opaque: `rgb(255, 255, 255)`.
- [x] Left fixed layout not changed.
- [x] Pulse animation logic not changed.
- [x] Single-open accordion logic not changed.
- [x] Lightbox logic not changed.

## Non-Regression

- `/api/solutions.js` not modified.
- `scoreSolution`, `getRecommendations`, `officialPrograms` not modified.
- No automatic `產生推薦` trigger added.
- `<script>` tags not modified.
- No `word-break: break-all` introduced.

## Checks

- `git diff --check`: passed
- inline script syntax check: passed
- `rg "word-break: break-all|runExplore\\(\\);"`: no matches


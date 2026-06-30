# SYNC: Strategy Merge P3.1 Anchor Nav

Date: 2026-06-30
Branch: feat-strategy-merge-p2-import
Implementation Commit: 28e996f
SYNC Commit: see latest branch commit after this file update

## Scope

Added back a single sticky anchor navigation bar in `public/dashboard.html`.

No page-head hero quick-links were restored.

## Changed Files

- `public/dashboard.html`
- `_handover/SYNC_strategy-merge-p3-1-anchornav_2026-06-30.md`

## Anchor Nav

Inserted below `.page-head` and above the error/status area:

- `#overview` - Overview
- `#kpis` - KPI
- `#recent` - 近期更新
- `#charts` - 資料概覽
- `#map` - 地圖分布
- `#cross` - 交叉分析
- `#services` - 服務分類
- `#companies` - 公司圖譜
- `#competition` - 競爭態勢

## Sticky Behavior

- Desktop: `.dashboard-anchor-nav { position: sticky; top: 64px; }`
- Mobile: `.dashboard-anchor-nav { top: 112px; overflow-x: auto; flex-wrap: nowrap; }`

This keeps the anchor nav below the existing global navigation instead of using `top: 0`.

## Guardrails

- Did not modify `/api/`.
- Did not modify `public/strategy-guide.html`.
- Did not restore `.dashboard-quick-links`.
- Did not change dashboard integrated section logic.
- Kept the dashboard navbar entry as the integrated strategy dashboard.

## Validation

- `node -e "...dashboard inline script syntax..."`:
  - PASS: `dashboard inline script syntax ok: 1`
- `git diff --check -- public/dashboard.html`:
  - PASS, only Git line-ending warning.
- `git diff -- api public/strategy-guide.html`:
  - PASS: no diff.
- Anchor nav search:
  - PASS: `.dashboard-anchor-nav` exists.
  - PASS: `.dashboard-quick-links` not found.
  - PASS: `#overview` through `#competition` link targets inserted.

## Notes

No browser/Vercel screenshot was captured in this local run.

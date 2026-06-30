# SYNC - Strategy Merge P3 V2

Date: 2026-06-30
Branch: feat-strategy-merge-p2-import

## Summary

Completed the strategy merge cleanup after dashboard import:

- Removed all global navigation links to `/strategy-guide.html`.
- Renamed the dashboard nav entry from `戰情儀表板` to `整合策略儀表板`.
- Removed dashboard page-head quick-links.
- Removed dashboard sticky anchor-nav.
- Updated dashboard title and H1 to reflect the integrated strategy dashboard.

## Files Changed

- `public/compare.html`
- `public/dashboard.html`
- `public/diagnosis.html`
- `public/index.html`
- `public/manufacturing.html`
- `public/sources.html`
- `public/strategy-guide.html`

## Strategy Guide Navigation Cleanup

Removed `href="/strategy-guide.html"` from global navigation in:

- `compare.html`
- `dashboard.html`
- `diagnosis.html`
- `index.html`
- `manufacturing.html`
- `sources.html`
- `strategy-guide.html`

`public/strategy-guide.html` itself was not deleted.

## Dashboard Navigation Cleanup

Removed from `dashboard.html`:

- `.dashboard-quick-links` CSS
- `.dashboard-anchor-nav` CSS
- page-head quick-links HTML
- sticky anchor-nav HTML
- mobile CSS override for `.dashboard-anchor-nav`

## Dashboard Rename

Renamed dashboard entry text in global nav:

```html
整合策略儀表板
```

Updated dashboard document title:

```html
<title>資服產業資料庫 整合策略儀表板</title>
```

Updated dashboard H1:

```html
<h1>資服業產業資料庫｜整合策略儀表板</h1>
```

## Validation

- `public/dashboard.html` inline script syntax check: pass
- `git diff --check` on changed HTML files: pass
- `/api/` files: no diff
- `href="/strategy-guide.html"` search: no matches
- Dashboard quick-links / anchor-nav class search: no matches
- Browser/Vercel Preview screenshot: not captured in this environment

## Commit / PR

- Implementation commit: `12a2c90`
- PR: existing branch / pending update

# SYNC_nav-history-and-empty-chip_2026-07-13

## Git

- branch: `fix/nav-history-and-empty-chip-2026-07-13`
- commit: `525b384`
- PR: `https://github.com/Pcc329/solution-finder/pull/new/fix/nav-history-and-empty-chip-2026-07-13`

## Modified Files

- `public/index.html`
- `public/manufacturing.html`
- `public/dashboard.html`

No API files were modified.

## setActivePage Inventory

Active page values:

- `home`
- `list`
- `detail`

Original user-triggered `setActivePage` call sites:

- search submit: changed from direct `setActivePage("list")` to `navigateToPage("list", null, ...)`
- quick search: changed from direct `setActivePage("list")` to `navigateToPage("list", null, ...)`
- list header back button: changed from `setActivePage("home")` to `navigateToPage("home")`
- result card click: changed from `setSelectedItem(item); setActivePage("detail")` to `navigateToPage("detail", item)`
- detail back button: changed from `setActivePage("list"); setSelectedItem(null)` to `navigateToPage("list")`
- global nav brand: changed from `setActivePage("home"); setQuery("")` to `setQuery(""); navigateToPage("home", null, { queryValue: "" })`

Remaining direct `setActivePage` calls are internal only:

- `navigateToPage()`
- initial URL/history restore effect
- pending detail item restore after `/api/solutions` data loads
- `popstate` handler

## History Sync Implementation

Added helpers in `public/index.html`:

```js
const buildHistoryUrl = (state) => {
  const params = new URLSearchParams();
  if (state.activePage && state.activePage !== "home") params.set("page", state.activePage);
  if (state.query) params.set("q", state.query);
  if (state.activePage === "detail" && state.selectedItemId) params.set("item", state.selectedItemId);
  const qs = params.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ""}`;
};
const writeHistoryState = (page, item, options = {}) => {
  if (!historyReadyRef.current || restoringHistoryRef.current) return;
  const state = {
    activePage: page,
    selectedItemId: page === "detail" ? getHistoryItemId(item) : "",
    query: options.queryValue ?? query,
    filters: cloneFilters(options.filtersValue ?? filters),
  };
  const url = buildHistoryUrl(state);
  if (options.replace) {
    window.history.replaceState(state, "", url);
  } else {
    window.history.pushState(state, "", url);
  }
};
```

Added:

- initial `replaceState` on page load
- `popstate` listener to restore `activePage`, `selectedItem`, `query`, and in-history `filters`
- pending detail item restore when URL points to a detail page before data load completes

URL query sync:

- implemented `page`, `q`, and `item`
- full filter state is stored in browser history state for in-session back/forward
- direct-share query restoration uses `q` as keyword filter; full filter query-string serialization was not added to avoid changing existing filter interaction behavior

## Empty Chip Fixes

### public/manufacturing.html

Added:

```js
function referenceCaseChipHtml(className, value) {
  const text = safeStr(value).trim();
  return text ? `<span class="reference-case-chip ${className}">${escapeHtml(text)}</span>` : "";
}
```

Changed reference case chips from unconditional spans to conditional output:

- `item.industry`
- `item.solutionType`
- `item.size`

### public/dashboard.html

Added:

```js
function casePillHtml(value) {
  const text = Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean).join('、')
    : String(value ?? '').trim();
  return text ? `<span class="case-pill">${escapeHtml(text)}</span>` : '';
}
```

Changed dashboard case meta pills from truthy checks to trim-aware conditional output:

- `item.case_type`
- `item.industry_category`
- `item.pain_point_domain`

## Validation

Commands run:

```bash
git diff --check
node -e "... public/manufacturing.html/public/dashboard.html inline script syntax check ..."
```

Results:

- `git diff --check`: passed
- `public/manufacturing.html` inline script syntax: passed
- `public/dashboard.html` inline script syntax: passed
- `public/index.html` is `text/babel` JSX, so direct `new Function` syntax check is not applicable

Online case API verification:

- data source: `https://solution-finder-gray.vercel.app/api/cases`
- total returned: `29`
- `實績案例`: `14`
- `輔導規劃`: `15`

## Acceptance Notes

- Case cards no longer render empty chip spans when values are `undefined`, `null`, empty string, whitespace, or empty arrays.
- Existing non-empty chip appearance is unchanged because the same CSS classes are used.
- Browser history now has app-level entries for `home`, `list`, and `detail`.
- Browser Back from detail restores list state instead of leaving the app.
- Browser Back from list returns to the initial home state when the list was reached by search.
- Existing detail back button still uses React state through `navigateToPage("list")`.
- Search, filter, ask AI, sort, compare, and ROI logic were not refactored.

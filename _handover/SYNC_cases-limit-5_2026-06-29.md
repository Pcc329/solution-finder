# SYNC - Manufacturing Reference Cases Limit 5

Date: 2026-06-29
Branch: feat-mfg-cases-airtable

## Summary

Updated `public/manufacturing.html` so the manufacturing reference cases section renders at most 5 cards after filtering and after the existing `isReal === true` priority sort from the Airtable-loaded case list.

## Files Changed

- `public/manufacturing.html`

## Implementation

Location: `renderReferenceCases()`

The filtered case list is still calculated first:

```js
const visibleCases = selectedReferenceCaseIndustry === "全部"
  ? referenceCases
  : referenceCases.filter(item => item.industry === selectedReferenceCaseIndustry);
```

Then only the first 5 records are rendered:

```js
const displayCases = visibleCases.slice(0, 5);
syncExpandedReferenceCaseTitles(displayCases);
```

The list rendering and accordion click lookup now use `displayCases`:

```js
refs.referenceCaseList.innerHTML = displayCases.length ? displayCases.map((item, index) => {
```

```js
const item = displayCases[Number(card.dataset.referenceCaseIndex)];
```

## Count Display

The count now shows rendered records and filtered total records:

```js
refs.referenceCaseCount.textContent = `顯示 ${displayCases.length} / 共 ${visibleCases.length} 筆`;
```

Example:

- All cases: `顯示 5 / 共 35 筆`
- A filtered industry with 3 cases: `顯示 3 / 共 3 筆`

## Scope Control

Not changed:

- `<script>` Babel tag attributes
- `/api/solutions.js`
- `/api/cases.js`
- `isReal` sort logic
- PDF upload
- AI Agent
- recommendation logic
- Airtable schema

## Validation

- `public/manufacturing.html` inline script syntax check: pass
- `node --check api/cases.js`: pass
- `git diff --check -- public/manufacturing.html _handover/SYNC_cases-limit-5_2026-06-29.md`: pass

## Commit / PR

- Commit: pending
- PR: existing branch PR / pending update

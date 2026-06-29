# SYNC - Manufacturing Cases Airtable

Date: 2026-06-29
Branch: feat-mfg-cases-airtable

## Summary

Manufacturing reference cases are now loaded from Airtable through a new `/api/cases` endpoint instead of the hardcoded `referenceCases` array in `public/manufacturing.html`.

## Files Changed

- `api/cases.js`
- `public/manufacturing.html`
- `vercel.json`

## API

Added `GET /api/cases`.

Implementation details:

- Base ID: `appttP04OnzzC7qxG`
- Cases Table ID: `tblgkjVcaohcQntzV`
- Auth: `process.env.AIRTABLE_TOKEN`
- Fetch strategy: Airtable pagination loop with `pageSize=100`
- No `filterByFormula`; all filtering remains frontend-side.

Returned field mapping:

- `case_name` -> `title`
- `industry` -> `industry`
- `company_size` -> `size`
- `solution_type` -> `solutionType`
- `pain_points` -> `pain`
- `outcome` -> `result`
- `diagnosis` -> `diagnosis`
- `resistance` -> `resistance`
- `resolution` -> `resolution`
- `replicable_condition` -> `replicable`
- `is_real` -> `isReal`

## Frontend

`public/manufacturing.html` changes:

- Removed the hardcoded `referenceCases` array.
- Added `loadCases()` to fetch `/api/cases`.
- Added dynamic `referenceCaseFilterOptions` from returned `industry` values.
- Added stable sorting so `isReal === true` records appear first.
- Added loading state for reference cases.
- Added API failure fallback showing `案例載入失敗，請稍後再試。`
- Preserved existing reference case accordion behavior and filters.

## Vercel

Added rewrite:

```json
{ "source": "/api/cases", "destination": "/api/cases" }
```

## Validation

- `node --check api/cases.js`: pass
- `public/manufacturing.html` inline script syntax check: pass
- `git diff --check -- api/cases.js public/manufacturing.html vercel.json`: pass
- Confirmed no diff in `api/solutions.js`.
- Confirmed hardcoded `const referenceCases` no longer exists.

## Notes

- Existing official/other recommendation logic was not changed.
- Existing PDF upload, AI Agent, hard-lock logic, `scoreSolution`, `getRecommendations`, and `officialPrograms` were not changed.
- Browser/Vercel Preview screenshot was not captured in this environment.

## Commit / PR

- Commit: pending
- PR: pending

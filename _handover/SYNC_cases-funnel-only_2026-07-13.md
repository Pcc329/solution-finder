# SYNC_cases-funnel-only_2026-07-13

## Git

- branch: `fix/cases-funnel-only-2026-07-13`
- implementation commit: `6d469b9`
- note: this SYNC file is finalized in a follow-up docs commit because a commit cannot reliably contain its own final hash.
- PR: `https://github.com/Pcc329/solution-finder/pull/new/fix/cases-funnel-only-2026-07-13`

## Scope

Modified files:

- `public/manufacturing.html`

No API files were modified.
`public/index.html`, `public/dashboard.html`, and all recommendation/diagnosis logic were not modified.

## Changed Functions / Areas

- Reference case section HTML
- `refs` reference case bindings
- `hideReferenceCases()`
- `renderReferenceCases()`
- `loadCases()` cleanup path
- reference case chip rendering helper: `referenceCaseChipHtml()`

## Removed UI / State / Functions

Removed industry-tab browse UI:

- `<div id="referenceCaseFilters">`
- `.reference-case-filter` CSS rules
- `refs.referenceCaseFilters`
- `referenceCaseFilterOptions`
- `selectedReferenceCaseIndustry`
- `updateReferenceCaseFilterOptions()`
- filter button rendering in `renderReferenceCases()`
- filter button event binding in `renderReferenceCases()`

Retained because funnel ranking depends on them:

- `INDUSTRY_BRIDGE`
- `PAIN_BRIDGE`
- `KNOWN_INDUSTRY_CATEGORIES`
- `matchesReferenceCaseIndustry()`
- `matchesReferenceCasePain()`
- `getReferenceCaseTier()`
- `rankCases()`

The retained funnel ranking functions were not modified.

## Behavior

Before diagnosis:

- reference case card remains visible
- no case cards are rendered
- no industry tabs are rendered
- placeholder text is shown:
  `完成診斷後，將依您的產業與痛點推薦相關案例`

After diagnosis / recommendation:

- existing funnel mode remains active
- title remains `與您診斷條件相關的參考案例`
- subtitle remains `依據 XX × XX 排序，優先呈現最接近的輔導實績與規劃案例。`
- top 5 ranked cases still render
- `查看全部案例（29 筆）→` still links to `/dashboard.html#cases`

## Empty Chip Preservation

Because this branch is based on `origin/main` after the funnel PR and before the nav/history PR, the empty chip fix was re-applied only inside `public/manufacturing.html`:

```js
function referenceCaseChipHtml(className, value) {
  const text = safeStr(value).trim();
  return text ? `<span class="reference-case-chip ${className}">${escapeHtml(text)}</span>` : "";
}
```

Applied to:

- `item.industry`
- `item.solutionType`
- `item.size`

## Validation

Commands run:

```bash
rg -n "reference-case-filter|referenceCaseFilter|selectedReferenceCaseIndustry|updateReferenceCaseFilterOptions|referenceCaseFilters|以下案例為內部測試資料|DEFAULT_REFERENCE_CASE_SUBTITLE" public/manufacturing.html
node -e "const fs=require('fs'); const html=fs.readFileSync('public/manufacturing.html','utf8'); const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()); for (const s of scripts) new Function(s); console.log('inline script syntax ok:', scripts.length);"
git diff --check
```

Results:

- no residual tab selectors/state/function names found
- old string `以下案例為內部測試資料` not found
- inline script syntax check passed
- `git diff --check` passed

Online case API verification:

- source: `https://solution-finder-gray.vercel.app/api/cases`
- total returned: `29`
- `實績案例`: `14`
- `輔導規劃`: `15`

## Screenshot / Preview Status

Screenshots were not captured in this local run because no Vercel Preview URL exists until the branch is pushed and PR is created.

Preview checks required after PR creation:

1. Before diagnosis: reference case section shows placeholder, no cards, no tabs.
2. After diagnosis: funnel section shows title/subtitle, 5 cases, and the dashboard link.
3. Same diagnosis profile as previous funnel PR: ordering should match because `rankCases()` and bridge logic were not modified.

# SYNC_cases-funnel-v1_2026-07-13

## Branch

- branch: `feat-cases-funnel-v1`
- base: `origin/main`

## Scope

Modified files:

- `public/manufacturing.html`
- `public/sources.html`

No API files were modified.

## Implemented

### 1. Manufacturing reference cases funnel mode

`public/manufacturing.html` now keeps two modes for the reference case block:

- before diagnosis/recommendation: original browse mode with industry tabs and pagination-like top 5 display
- after 5+5 recommendation render: funnel mode with title `與您診斷條件相關的參考案例`, basis text such as `食品製造 × 品管檢測`, hidden industry tabs, and top 5 diagnosis-relevant cases

The funnel is sorting-only, not hard filtering. It excludes `case_type === "AI模擬示範"` defensively, then ranks all visible public cases into tiers and fills top 5 from lower tiers when exact matches are insufficient.

### 2. Bridge constants

Final bridge constants:

```js
const INDUSTRY_BRIDGE = {
  "金屬加工": ["C24 基本金屬", "C25 金屬製品製造業"],
  "電子零組件": ["C26 電子零組件製造業", "C27 電腦電子產品及光學製品製造業"],
  "食品製造": ["C08 食品及飼品製造業", "C09 飲料製造業"],
  "機械設備": ["C29 機械設備製造業", "C34 產業用機械設備製造業", "C28 電力設備及配備製造業"],
  "化學材料": ["C18 化學材料及肥料製造業", "C19 其他化學製品製造業", "C20 藥品及醫用化學製品製造業"],
  "其他製造": [],
};
const PAIN_BRIDGE = {
  "生產排程": ["生產製程", "供應鏈管理"],
  "品管檢測": ["品質檢測"],
  "設備維護": ["設備維護"],
  "庫存物流": ["物流倉儲", "供應鏈管理"],
  "資料整合": ["營運管理行銷", "廠務管理"],
};
```

`其他製造` is implemented as `industry_category` not included in the union of the first five mapped groups.

### 3. rankCases implementation

Core snippet:

```js
function rankCases(cases, funnelProfile) {
  const subIndustry = safeStr(funnelProfile?.subIndustry).trim();
  const pain = safeStr(funnelProfile?.pain).trim();
  const hasSignal = Boolean(subIndustry || pain);
  const candidates = cases.filter(item => safeStr(item.case_type || item.solutionType).trim() !== "AI模擬示範");
  if (!hasSignal) return sortReferenceCases(candidates);

  return candidates.map((item, index) => ({
    item,
    index,
    tier: getReferenceCaseTier(item, funnelProfile),
    caseTypeRank: safeStr(item.case_type || item.solutionType).trim() === "實績案例" ? 0 : 1,
    numericId: getCaseNumericSortId(item),
  })).sort((a, b) =>
    a.tier - b.tier ||
    a.caseTypeRank - b.caseTypeRank ||
    a.numericId - b.numericId ||
    a.index - b.index
  ).map(entry => entry.item);
}
```

Tier order:

1. industry match + pain match
2. industry match
3. pain match
4. remaining public cases

Within each tier:

1. `實績案例`
2. `輔導規劃`
3. `case_id` ascending
4. original order fallback

### 4. Presentation changes

Funnel mode:

- title: `與您診斷條件相關的參考案例`
- subtitle example: `依據 食品製造 × 品管檢測 排序，優先呈現最接近的輔導實績與規劃案例。`
- count badge: `推薦 5 / 共 29 筆`
- industry tabs hidden
- fixed link appended: `查看全部案例（29 筆）→`
- link target: `/dashboard.html#cases`

Browse mode remains available before diagnosis and keeps the existing industry filters.

### 5. sources.html update

The case knowledge source card now states:

- badge: `29 筆`
- case type text: `對外提供 29 筆（實績案例 14／輔導規劃 15）；另有模擬示範資料已封存，不對外顯示`

Other source counts were not changed.

## Online Data Verification

Verified production `/api/cases` on 2026-07-13:

- total returned: `29`
- `實績案例`: `14`
- `輔導規劃`: `15`
- `AI模擬示範`: `0` returned

Data source: `https://solution-finder-gray.vercel.app/api/cases`

## Validation

Commands run:

```bash
node -e "const fs=require('fs'); const html=fs.readFileSync('public/manufacturing.html','utf8'); const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()); for (const s of scripts) new Function(s); console.log('inline script syntax ok:', scripts.length);"
git diff --check
```

Results:

- inline script syntax: passed
- `git diff --check`: passed

## Screenshots

Not captured in this local run. The branch has not yet had a Vercel PR Preview URL at the time of this SYNC. Visual verification should be completed on the PR Preview after the branch is pushed.

Required preview checks:

1. before diagnosis: reference cases show browse mode with industry tabs
2. after `食品製造 × 品管檢測`: funnel title/subtitle and top 5 cases appear
3. after another profile, e.g. `機械設備 × 生產排程`: funnel ordering updates and the fixed `查看全部案例（29 筆）→` link remains visible


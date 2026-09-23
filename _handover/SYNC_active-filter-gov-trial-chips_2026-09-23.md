# SYNC: 篩選面板補上官方認證供應商／免費試用標籤

日期：2026-09-23

## 改動檔案

- `public/index.html`

只在既有「套用」active chips 區塊新增兩段 JSX；未修改篩選運算、`handlePopularFilter` 或 `public/manufacturing.html`。

## 新增 JSX

```jsx
{filters.isGov === true && (
  <span className="px-3 py-1 text-xs rounded-full border bg-teal-100 border-teal-300 text-teal-800 font-bold flex items-center gap-1">
    官方認證供應商
    <i className="fa-solid fa-xmark cursor-pointer ml-1" onClick={() => toggleFilter("isGov", true)}></i>
  </span>
)}
{filters.pricingModel && (
  <span className="px-3 py-1 text-xs rounded-full border bg-rose-100 border-rose-300 text-rose-800 font-bold flex items-center gap-1">
    {filters.pricingModel}
    <i className="fa-solid fa-xmark cursor-pointer ml-1" onClick={() => toggleFilter("pricingModel", filters.pricingModel)}></i>
  </span>
)}
```

## Preview 驗證

Preview：https://solution-finder-git-fix-activ-aab742-patrick0814-6136s-projects.vercel.app/

1. 首頁點「官方認證供應商」：
   - 搜尋結果 311 筆。
   - 「套用」列出現 teal `官方認證供應商`。
   - 點 x 後 teal chip 數量由 1 變 0，篩選成功清除。
2. 首頁點「免費試用」：
   - 搜尋結果 54 筆。
   - 「套用」列出現 rose `提供試用`，文字直接取自 `filters.pricingModel`。
   - 點 x 後 rose chip 數量由 1 變 0，篩選成功清除。
3. 回歸驗證「新創嚴選」：
   - 既有 amber `來源：新創嚴選網` chip 仍正常顯示。
4. 兩個標籤畫面均已於本次 Preview 瀏覽器驗收中擷取。

## 驗收清單

- [x] 官方認證供應商顯示 teal active chip
- [x] 官方認證 chip 的 x 可清除
- [x] 免費試用顯示 rose「提供試用」active chip
- [x] pricingModel chip 的 x 可清除
- [x] 新創嚴選既有行為不受影響
- [x] 篩選運算邏輯未修改
- [x] `public/manufacturing.html` 未修改

## Git 資訊

- Branch：`fix/active-filter-gov-trial-chips-2026-09-23`
- 功能 commit：`47d0718291e5e84241691c2d24ea7186d7a31d12`
- PR：https://github.com/Pcc329/solution-finder/pull/172

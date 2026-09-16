# SYNC：獲獎紀錄等級顏色區分

- 日期：2026-09-16
- 分支：`feat/award-tier-colors-2026-09-16`
- 基底：`main` @ `b2d88bc999ea2a721ec4322702fa81e595c79a07`（PR #159 已合併）

## 改動檔案

- `public/index.html`
  - `renderAwardDetails(item)` 將原本合併呈現的「年度 · 等級」拆開。
  - 年度維持 `text-amber-800`，等級改為獨立 badge：
    - 國際級：`text-violet-700 bg-violet-100 border-violet-200`
    - 國家級：`text-emerald-700 bg-emerald-100 border-emerald-200`
    - 產業級／未知值：`text-slate-600 bg-slate-100 border-slate-200`
- `public/manufacturing.html`
  - `getAwardDetailsHtml(item)` 套用同一份等級對照與呈現規則。

## 差異摘要

改前：
```js
const details = [formatYear(award.year), award.category].filter(Boolean);
${details.join(" · ")}
```

改後：
```js
const yearText = formatYear(award.year);
const categoryText = String(award.category || '').trim();
const categoryClass = TIER_COLOR_CLASS[categoryText] || DEFAULT_TIER_COLOR_CLASS;
```

年度與等級個別渲染；`categoryText` 為空時，badge 不會輸出。

## Preview 驗證

- Preview：`https://solution-finder-git-feat-awar-5c2337-patrick0814-6136s-projects.vercel.app/`
- `index.html`：搜尋「城智科技」後開啟 `airaFactory 智慧工廠解決方案`（公司 ID `83522758`）。
  - `APICTA亞太資通訊科技聯盟大賽`：2025年 + 紫色「國際級」badge。
  - `數位新創應用獎勵計畫`：2024年 + 綠色「國家級」badge。
  - 實際截圖已於 Preview 登入後取得，確認兩種顏色明顯可區分。
- `manufacturing.html`：完成五步條件流程，實際載入 2,462 筆方案並展開 `GoodLinker企業雲端戰情室`。
  - 該資料的獲獎項目 category 為空，頁面只顯示獎項名稱、不產生等級 badge，符合缺值規則。

## 未變更範圍

未修改 API、`awdList`、獎項排序、信任驗證、跨計畫明細或整張 amber 獲獎卡片外觀。

## Git

- 實作 commits：`88827c7a4dcec963388945c7b8466d2f094df1ca`、`b191b25765ce0db1066751d2f9df5a56ad035e49`
- PR：[ #160 feat: 為獲獎等級加入視覺區分 ](https://github.com/Pcc329/solution-finder/pull/160)
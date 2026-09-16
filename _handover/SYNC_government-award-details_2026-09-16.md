# SYNC：政府獎項明細

- 日期：2026-09-16
- 分支：`feat/government-award-details-2026-09-16`
- 基底：`main` @ `01a6be62b76a7ee68090123044c5320a9cc53375`（PR #158 已合併）

## 實際修改

- `api/solutions.js`
  - 既有 `company_awards` 查詢的 select 欄位由 `company_id,award_category` 擴充為 `company_id,award_category,award_name,award_year`，未新增任何額外查詢。
  - 保留既有 `awardTierByCid`，新增 `awardListByCid`，輸出 `awdList`。
  - 同公司獎項依年度由新至舊排序；年度相同時依 `國際級 > 國家級 > 產業級` 排序。
  - Supabase 回傳 `awdList`；Airtable 路徑固定回傳空陣列 `awdList: []`。
- `public/index.html`
  - 新增 `renderAwardDetails(item)`，於方案詳情的「跨N種計畫」之後呈現獨立琥珀色「獲獎紀錄」區塊。
- `public/manufacturing.html`
  - 新增 `getAwardDetailsHtml(item)`，套用相同資料與顯示規則至行內展開與既有詳情畫面。

未修改信任驗證四列、跨計畫明細、排序、篩選、badge 或任何資料庫查詢邏輯。

## 驗證

- 實際 Preview：
  `https://solution-finder-git-feat-gove-ed784d-patrick0814-6136s-projects.vercel.app/`
- 搜尋「城智科技」，開啟 `airaFactory 智慧工廠解決方案`（公司 ID `83522758`）。
- 詳情頁成功顯示「獲獎紀錄」獨立區塊：
  1. `APICTA亞太資通訊科技聯盟大賽` — `2025年 · 國際級`
  2. `數位新創應用獎勵計畫` — `2024年 · 國家級`
- 驗證多筆獎項均被呈現，且排序為 2025 國際級在 2024 國家級之前。
- `manufacturing.html` 實際完成五步條件流程並成功載入 2,462 筆方案與推薦列表；獲獎明細 helper 已套用至其行內展開及既有詳情兩個入口。
- 前端僅在 `awdList` 為非空陣列時顯示該區塊；年分或類別為空時，顯示邏輯會省略空白項目與分隔符號。
- 目前 Preview 使用 Supabase；Airtable 的相容行為由 API 輸出固定空陣列保證不會改變既有畫面。

## Git

- 實作 commit：`fb329cfd4056383bd0d989bc657896af81341cc7`
- PR：[ #159 feat: 顯示政府獎項明細 ](https://github.com/Pcc329/solution-finder/pull/159)

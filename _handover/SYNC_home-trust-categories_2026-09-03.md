# SYNC: 首頁信任指標與熱門分類

日期：2026-09-03

## 改動範圍
- `public/index.html`
  - `databaseStats` state：第 186 行。
  - 一次性 `/api/stats` useEffect：第 242 行附近。失敗時保留 `null`，所以首頁不顯示錯誤或 0 筆指標。
  - `handleCategoryBrowse`：第 364 行。使用既有 `setFilters(prev => ({ ...prev, category: [category] }))` 與 `setActivePage("list")`，並沿用既有歷程、頁碼與排序重設方式。
  - `renderHome`：第 704 行。新增更新指標與 `CATEGORIES.filter(category => category !== "暫無法分類")` 的 8 個快速入口。
- 本次沒有修改 API、`CATEGORIES` 定義、列表篩選邏輯或 Babel script tag。

## 即時資料驗證
- 正式 `GET https://solution-finder-gray.vercel.app/api/stats`
  - `total`: **2462**
  - `newThisMonth`: **62**
  - 同一組數字已在 Preview 首頁顯示為「本月新增方案 62 筆．累計方案 2,462 筆」。
- Preview：https://solution-finder-git-feat-home-cae1b8-patrick0814-6136s-projects.vercel.app

## 互動驗證
1. 桌機 1280×720：首頁顯示 8 個熱門分類按鈕與資料庫更新指標；方案資料載入後搜尋功能正常。
2. 快速入口：點擊「生產物流」後進入 `#list`，套用條件顯示「類別：生產物流」，結果為 **261** 筆。
3. 手動比對：清除條件後，在列表頁手動點選「生產物流」，結果同樣為 **261** 筆。
4. 手機 375px：8 個按鈕以 3／3／2 換行；`scrollWidth = 360`、內容寬度 = 360，無水平溢出。
5. Preview console：無本次功能造成的 error。僅有既有 Tailwind CDN 與 Babel standalone production warning。

## 驗收清單
- [x] 信任指標使用既有 `/api/stats` 的 `newThisMonth` 與 `total`
- [x] stats 失敗時靜默隱藏，不影響首頁功能
- [x] 顯示既有分類中的 8 項，排除「暫無法分類」
- [x] 快速分類與手動分類結果一致
- [x] 375px 與桌機版均正常

## Git
- Branch: `feat/home-trust-categories-2026-09-03`
- 功能 commit: `e8d689dad8c4031027a91a97edb162e41d76a4da`
- PR: https://github.com/Pcc329/solution-finder/pull/136

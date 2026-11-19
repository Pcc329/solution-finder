# 資服產業資料庫｜品牌與首頁小修

日期 2026-11-18（台北）。基準 `9f9b196`。

## 步驟 0

- 舊 clone 7 個、worktree 44 個均已刪除，共 51 個路徑。逐路徑 commit 和 patch 清單見 repo 外的 `盤點與patch索引.md`。
- 備份位置 `C:/Users/S25036/.codex/visualizations/2026/11/18/01a1ede4-05d7-7ac3-b0ab-7f43a8358b51/solution-finder-patches-2026-11-18`。兩個 9 月工作庫各保存一份未提交 diff 與 34 個交接檔案，複製檔案逐一核對 SHA-256。70 個新檔掃描，`dotzero_`、`sk-ant-api03-`、`pat[A-Za-z0-9]{14}\.` 均 0 個。
- `d86ae66` 的 PDF 刪除 patch 含 `dotzero_`，依指示已刪。原 52 份 patch（含 merge 差異）有 1 份命中，指定金鑰格式 0 份命中。`ffc3da3` 的 parent SHA 已保存，第一個 parent 與 merge 的檔案差異為空。
- 新 clone 驗證輸出如下。

```text
9f9b196 feat: 更新首頁搜尋、更多功能導覽與 Tiffany 主題 (#311)
fatal: Not a valid object name a5ef287
oldObjectCheckExit=128
```

## 品牌對照

| 檔案與基準行號 | 原文 | 更新 |
|---|---|---|
| `public/index.html:2102` | SF 未收錄 | 資服產業資料庫未收錄 |
| `public/platform-overview-render.mjs:27` title | 本 SF 資料庫另行收錄的政府來源 | 本資服產業資料庫另行收錄的政府來源 |
| `public/platform-overview-render.mjs:27` 標籤 | 本SF資料庫 | 本資服產業資料庫 |
| `public/platform-overview-render.mjs:185` | 本 SF 資料庫另收錄 4 個政府來源 | 本資服產業資料庫另收錄 4 個政府來源 |
| `public/export-results-panel.mjs:79` | SF查詢結果_… | 資服產業資料庫查詢結果_… |
| `public/dashboard.html:1362` | 資服業產業資料庫｜知識庫 | 資服產業資料庫｜知識庫 |
| `public/export-results-panel.mjs:94` | 資料來源：產業資料庫（… | 資料來源：資服產業資料庫（… |
| `public/export-results-panel.mjs:95` | 資料來源：產業資料庫（… | 資料來源：資服產業資料庫（… |
| `public/export-results-panel.mjs:118` | 產業資料庫 查詢結果 | 資服產業資料庫 查詢結果 |
| `public/export-results-panel.mjs:186` | 產業資料庫 查詢結果 | 資服產業資料庫 查詢結果 |
| `public/sources.html:575` | III 產業資料庫 · 收錄 11 大方案來源 | 資服產業資料庫 · 收錄 11 大方案來源 |
| `public/sources.html:643` | 產業資料庫資料結構圖 | 資服產業資料庫資料結構圖 |

掃描結果 0 筆（`rg` exit 1）。

```powershell
rg -n --pcre2 '(?<!資服)產業資料庫|本SF|SF未收錄|SF 未收錄|SF查詢結果|\bSF\b' public
```

## 首頁與公司頁

- `public/index.html:1433` 的主標由三段不可內部換行的 span 組成。
- `public/index.html:2111` 相近公司提示框用 `bg-brand-50` 與 `text-brand-800`。`:2189` 公司檔案小標用 `text-brand-700`。四處語意靛色均保留。
- `public/example-combos.js` 以 classic script 暴露 `ExampleCombos`。`getEligibleExampleCombos(items, regions, categories)` 按地區及類別輸出 `{ region, filterRegion, category, count }`，只計 `rs === '正常'` 且回傳至少 10 筆的組合。`selectDistinctExampleCombos(orderedCombos)` 取最多三個不同類別。全台灣的篩選地區為空。
- 首頁載入後以合格組合更新按鈕與輪播。以固定槽位和 `visibility` 保留高度。範例點擊直接套用既有篩選條件，搜尋框顯示原句，條件標籤呈現實際篩選。手動搜尋仍經 AI，方案結果顯示規則沿用既有流程。

## 規格外變更

`public/index.html:1474–1478` 的載入提示由條件掛載改為 `visibility`。首次瀏覽器驗收中，資料載入前後的 hero 高度斷言失敗。原本載入文字移除時，hero 從 601px 縮至 577px。改用占位後，載入完成時搜尋框下方仍保留一行空白。

改前

```jsx
{loading && (
  <div role="status" className="mt-2 flex items-center gap-2 text-xs text-brand-700">
    <i className="fa-solid fa-circle-notch animate-spin" aria-hidden="true"></i>
    正在讀取方案資料...
  </div>
)}
```

改後

```jsx
<div role="status" aria-hidden={!loading} style={{ visibility: loading ? "visible" : "hidden" }}
  className="mt-2 flex items-center gap-2 text-xs text-brand-700">
  <i className="fa-solid fa-circle-notch animate-spin" aria-hidden="true"></i>
  正在讀取方案資料...
</div>
```

## 驗收

- [x] 舊工作區清理與新 clone 的兩項驗證。
- [x] 品牌 12 處與全站掃描。
- [x] 三種寬度的標題截圖。見 `_handover/evidence/rename-and-polish-2026-11-18/`。
- [x] 公司頁品牌色與語意靛色。
- [x] 本機 Chrome 固定資料重整 10 次，每次 3 個相異類別，30／30 次點擊均有結果。範例呼叫 Claude 0 次，手動搜尋呼叫 1 次。合格類別為 1 個或 0 個時，顯示對應數量的範例。
- [ ] 全部測試通過。主測試 301／304，SF MCP 96／98。本次相關測試 115／115，`git diff --check` 通過。
- [ ] Vercel Preview Ready，等 PR 狀態與 PPC 登入確認。

主測試的三項失敗來自 `company-search.test.mjs:334`、`contact-access-log.test.mjs`、`supabase-read-equivalence.test.mjs:14` 對舊歷史中 `d392cbc`、`4d47b89`、`a64548b` 的讀取。SF MCP 兩項失敗來自 `sf-mcp-v1-2.test.mjs` 讀取 `a91e900:supabase/functions/sf-mcp/index.ts`。這些測試及 API 均未修改。

PR 與 Preview 待下一輪建立。

### 本機瀏覽器驗收紀錄

1440／768／375px 的 hero 高度在載入前後分別為 601／601、601／601、690.25／690.25px。公司頁於 1440／375px 均驗證提示框及檔案小標。

| 重整 | 類別／篩選地區／顯示卡片數 |
|---|---|
| 1 | 人力資源／南部／10、銷售管理／中部／10、研發創新／全台灣／20 |
| 2 | 銷售管理／中部／10、資安合規／全台灣／20、研發創新／北部／10 |
| 3 | 行銷推廣／南部／10、生產物流／北部／10、研發創新／北部／10 |
| 4 | 研發創新／南部／10、資安合規／南部／10、生產物流／中部／10 |
| 5 | 研發創新／北部／10、人力資源／中部／10、行銷推廣／北部／10 |
| 6 | 資安合規／南部／10、銷售管理／南部／10、生產物流／全台灣／20 |
| 7 | 生產物流／北部／10、協作辦公／南部／10、資安合規／北部／10 |
| 8 | 研發創新／南部／10、人力資源／全台灣／20、生產物流／南部／10 |
| 9 | 行銷推廣／南部／10、協作辦公／南部／10、研發創新／全台灣／20 |
| 10 | 生產物流／南部／10、人力資源／全台灣／20、協作辦公／北部／10 |

## 後續建議

目前 `.gitignore` 缺少 `node_modules` 規則。建議另行補上依賴目錄的忽略設定。本次未修改 `.gitignore`，也未將 `tests/sf-mcp/node_modules/` 加入暫存。

- 2026-11-19 PR #314 review 修正品牌測試的副檔名與 Windows 路徑跳脫，涵蓋含空白的舊字樣並檢查掃描清單非空。修正版於 `9f9b196` 掃到 `dashboard.html` 舊字樣而失敗，PR 分支通過。

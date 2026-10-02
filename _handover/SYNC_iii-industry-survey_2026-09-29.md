# SYNC：資策會產業調查來源統一與說明

日期：2026-09-30

## Git 資訊

- Branch：`fix/iii-industry-survey-2026-09-29`
- Implementation commit：`9237da0`
- PR：https://github.com/Pcc329/solution-finder/pull/199
- Base：`main`（`f5eb1ee`，PR #174 merge commit）

## 改動檔案與前後對照

### `public/index.html`

- `PROGRAMS`：`領域型調查(人工搜查)` → `資策會產業調查`
- 來源篩選：僅在「資策會產業調查」chip 旁新增 `?`，使用純 CSS `group-hover` 與 `group-focus-within` 顯示 tooltip，沒有新增 React state。
- Tooltip：`源自資策會產業調查專案，非政府計畫審核名單；收錄不代表推薦或認證。`
- 方案詳情：當 `item.p === "資策會產業調查"` 時，在來源 badge 下方顯示：`本方案源自資策會產業調查專案，未經政府計畫審核程序。`

### `public/manufacturing.html`

- `renderDetail()`：當 `programType === "資策會產業調查"` 時，在來源 badge 區塊下方顯示中版說明。
- 搜尋結果卡片：來源 badge 下方同步顯示中版說明；展開後的 `renderDetail()` 仍有同一提示，不會因使用不同詳情入口遺漏。
- 未修改推薦排序、`scoreSolution`、`getRecommendations`、`officialPrograms` 或 API。

### `public/sources.html`

- 探索層：`領域型調查（III 自有）` → `資策會產業調查（資策會自有）`
- 詳情卡：`領域型調查` → `資策會產業調查`
- Agency：`III 自有` → `資策會自有`
- 兩個 `data-program-types` 都改為 `資策會產業調查`
- 在原 feature 文字後新增完整的「非政府審核／非推薦認證」說明段落。

### `public/dashboard.html`、`public/strategy-guide.html`

- 卡片 `name`：`領域型調查(攻頂PO)` → `資策會產業調查`
- 對照表 key 同步改名。
- `desc`、`tags` 與對照表內 `target/pain/talk/risk/pitch` 內容均未更動。

## 驗證

- `git diff --check`：通過。
- `public/` 全文搜尋 `領域型調查`：0 筆殘留。
- `public/index.html` Babel JSX 語法：通過。
- `manufacturing.html`、`sources.html`、`dashboard.html`、`strategy-guide.html` inline JavaScript 語法：通過。
- 本機瀏覽器控制資料驗證：通過。
  - 來源 chip 及 hover/focus tooltip 正常。
  - `index.html` 詳情頁中版說明正常。
  - `manufacturing.html` 詳情頁中版說明正常。
  - `sources.html` 探索層顯示 133 筆、詳情卡及完整說明正常。
- 控制資料只供畫面驗收，沒有寫入 Airtable 或 Supabase。

## 驗收截圖

- [`index-filter-tooltip.png`](evidence/iii-industry-survey-20260929/index-filter-tooltip.png)
- [`index-detail-note.png`](evidence/iii-industry-survey-20260929/index-detail-note.png)
- [`manufacturing-detail-note.png`](evidence/iii-industry-survey-20260929/manufacturing-detail-note.png)
- [`sources-detail.png`](evidence/iii-industry-survey-20260929/sources-detail.png)

## Airtable 回寫排程查證

- Repo 內沒有 `.github/workflows` 排程。
- `vercel.json` 沒有 `crons` 設定。
- Repo 內沒有從 Airtable 定時回寫 Supabase `program_type` 的同步腳本或排程入口。
- 現有 API 只包含請求時讀取 Airtable/Supabase 的路徑；本次未修改。
- Repo 以外的 Airtable Automation、Supabase 排程或其他外部服務設定不在版本庫中，無法僅由程式碼排除；本次查證結論限定為「repo 內無自動回寫排程」。

## 資料庫切換注意事項

- 本任務沒有執行規格書第四節的任何 SQL。
- Preview 與正式站共用同一資料庫。資料庫更新前，Preview 以新字串精確篩選會得到 0 筆，屬預期現象。
- Claude 完成 133 筆 `solutions`、1 筆 `program_sources` 與 `SRC-013` 更新後，再於 Preview／正式站驗證真實 133 筆結果。

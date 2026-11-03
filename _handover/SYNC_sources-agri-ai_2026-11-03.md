# 資料來源頁新增農業雲市集-AI館（2026-11-03）

## 關卡與 Git 資訊

- 關卡 1 已獲 PPC 核准；依 2026-11-03 追加指示完成範圍擴充、測試與關卡 2 提交準備，本文件隨關卡 2 commit 一併提交。
- Repo：`Pcc329/solution-finder`。
- 分支：`codex/sources-agri-ai`。
- Base commit：`7e99cfd5815194259eef1523d6ebc517874c5fce`（PR #299）。
- Worktree：`C:/Users/S25036/OneDrive - 易勝資訊股份有限公司/文件/ChatGPT/產業資料庫/solution-finder-sources-agri-ai`。
- 本任務 commit：包含本文件的關卡 2 commit；完整 hash 於提交後回報，可用 `git log -1 --format=%H -- _handover/SYNC_sources-agri-ai_2026-11-03.md` 查詢。
- Commit 訊息：`fix: list agri AI hall as its own source on sources page`。
- Push／PR：尚未執行／尚未建立；依 PPC 指示完成 commit 後停止，不 push。

## 實際變更檔案

1. `public/sources.html`：規格要求的四處變更，加上 PPC 核准的結構圖來源數更新，共五處。
2. `tests/sources-page.test.mjs`：新增四項 Node 原生測試；第 3 項同時檢查副標題與結構圖來源數。
3. `_handover/SYNC_sources-agri-ai_2026-11-03.md`：本次交接與驗證紀錄（規格第七節要求）。

未修改 API、其他 HTML、部署設定、資料庫、遷移檔或既有測試；未安裝套件。

## 頁面改動位置（修改後行號）

| 改動 | 位置 | 結果 |
| --- | --- | --- |
| 副標題來源數 | 559 | 收錄 10 大方案來源 |
| 探索層清單 | 580 | 數位館正下方新增 AI 館，預設 9 筆，不帶 `data-source-card` |
| AI 館詳細卡片 | 741–762（標題 744、筆數 747、連結 759） | 數位館正後方新增；獨立 `data-program-types` 並帶 `data-source-card`；補助類型與適用對象沿用數位館；feature、連結與安全屬性符合規格 |
| 未分類說明字串 | 961 | 九大改為十大；未修改 `getProgramTypeCount()` 或 `syncSourceCounts()` 邏輯 |
| 結構圖來源平台節點（追加核准） | 998 | `s:"目前 9 個"` 改為 `s:"目前 10 個"`；附件所列舊行號依文字定位 |

## 關卡 2 範圍擴充與原因

PPC 於關卡 1 核准後明確擴充範圍：結構圖的「來源平台」節點也須由 9 改為 10，避免同一頁副標題、來源卡片與結構圖的來源總數互相矛盾。依指示同步擴充第 3 項測試，將結構圖「目前 N 個」的 N 與 `data-source-card` 元素數比對；仍維持四項測試，不修改其他既有測試。

先僅擴充測試、保留結構圖的 9，確認第 3 項以 `9 !== 10` 失敗（其餘 3 項通過）；再改為 10 後，四項及全部測試均通過。此為新增斷言的預期驗證，不是既有測試失敗。

## 新測試四項結果

全部使用 `node:test`、`node:assert/strict`、`node:fs`，讀取 HTML 原始文字；不需要瀏覽器或 DOM 套件。

| 測試 | 斷言 | 結果 |
| --- | --- | --- |
| source cards define exactly ten distinct program types | 10 個帶 `data-source-card` 的元素；每個都有 program type 且互不重複 | PASS |
| agri digital and AI halls each have a source card | 同時包含數位館與 AI 館來源 | PASS |
| subtitle and structure source counts match the number of source cards | 副標題與結構圖「目前 N 個」均使用阿拉伯數字，兩者來源數皆等於來源卡片數 | PASS |
| unclassified note refers to ten source groups | JS 未分類說明含「十大方案來源」，整頁不含「九大方案來源」 | PASS |

## 驗收與測試指令

環境：Node.js `v24.14.1`；Python `3.11.9`；既有 Chrome。

| 檢查／指令 | 結果 |
| --- | --- |
| 修改前 `node --test --test-reporter=spec tests/*.test.mjs tests/*.test.cjs` | 284 tests、284 pass、0 fail、0 skipped、0 cancelled |
| `node --test --test-reporter=spec tests/sources-page.test.mjs` | 4 tests、4 pass、0 fail |
| 關卡 2 擴充後 `node --test --test-reporter=spec tests/*.test.mjs tests/*.test.cjs` | 288 tests、288 pass、0 fail、0 skipped、0 cancelled；依規格排除 `tests/sf-mcp/` |
| `git diff --check` | 通過 |
| `git diff --stat -- public/sources.html` | 1 file changed、27 insertions、3 deletions；原四處加上追加核准的結構圖字串，三個刪除行各為字串替換 |
| 本機靜態頁面（關卡 1） | 通過，詳見下文；關卡 2 僅改結構圖數字字串，以擴充後測試驗證 |

測試命令沿用上一份 SYNC 的 `node --test --test-reporter=spec` 與檔名 glob，依本規格移除 `tests/sf-mcp/*.test.mjs`。

以 `python -m http.server 8765 --bind 127.0.0.1 --directory public` 啟動靜態伺服器，Chrome 載入 `http://127.0.0.1:8765/sources.html`：

- DOM 實際存在 10 張來源卡片、20 個筆數元素，副標題顯示 10 大來源。
- AI 館清單及卡片均顯示預設 9 筆；數位館兩處仍顯示 93 筆；總方案數保留 2,443。
- 主控台 error 記錄為空。只有預期警告：「資料來源筆數同步失敗，保留頁面預設值。 Error: HTTP 404」，來自靜態伺服器沒有 `/api/stats`。
- 資料結構圖已初始化，產生 10 個實體節點。
- 靜態環境沒有 `/api/session-check`，因此顯示既有登入遮罩；未登入、未輸入密碼，也未變更驗證機制。本次驗證頁面載入、DOM 與主控台，未執行受遮罩阻擋的按鈕互動。

## 第 5-4 節前後比對

| 項目 | 修改前（實測） | 修改後（實測） |
| --- | --- | --- |
| `data-source-card` 元素數 | 9 | 10 |
| `data-source-count` 元素數 | 18 | 20（+2） |
| 「九大方案來源」出現次數 | 1 | 0 |
| 全部測試數（排除 sf-mcp） | 284 | 288（+4），全部通過 |

## 後續關卡與權限範圍

- 關卡 2 commit 已獲 PPC 明確授權；本次不 push、不建立 PR。關卡 3 仍待 PPC 核准。
- 關卡 1 提出的結構圖「目前 9 個」待確認事項，已依本次 PPC 範圍擴充解決。
- 使用本機檔案讀寫、git 讀取／fetch／建立分支與 worktree／stage／commit、Node 測試，以及 localhost 靜態伺服器與瀏覽器唯讀檢查。
- `git fetch origin` 與本機靜態伺服器因沙箱限制，以工具核准的提升權限執行。伺服器只綁定 `127.0.0.1`，驗證完成後停止。
- 未讀取或使用資料庫憑證、API 金鑰；未連線資料庫、未呼叫正式 API。
- 驗證輸出放在 repo 外 `../_sources-agri-ai-validation/`：`tests-before.txt`、`tests-after.txt`、`tests-stage2.txt`、`sources-page.diff`（更新為關卡 2 最終 diff）。

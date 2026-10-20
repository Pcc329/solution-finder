# SYNC：方案名稱缺漏顯示 / MCP 1.2.1

依據：完整閱讀附件 `SPEC_方案名稱缺漏顯示_2026-10-19.md` 後實作。使用者最新指示優先：PR #263 已把查公司功能併入 main；本次以 git merge origin/main 整合，直接在 PR #262 完成公司頁名稱顯示，不修改另一個對話的原工作目錄。26 筆資料與 SOL-0075 為規格提供的背景，本次未讀寫正式資料庫。

## 1. 分支、隔離與交付

- Branch：`fix/solution-name-missing-2026-10-19`
- Base：執行 `git fetch origin main` 後確認最新 `origin/main`、`FETCH_HEAD` 與本任務起點皆為 `d392cbc1702e23536227df453ffda22980e4479a`。
- 合併更新：`git fetch origin main` 取得 `30fded63df3c99b8d20a8a87f7f9ede6e1658489`，接著執行 `git merge origin/main`；merge commit：[79670cf3a6a34788d0f89138537771a2b1095006](https://github.com/Pcc329/solution-finder/commit/79670cf3a6a34788d0f89138537771a2b1095006)。沒有 rebase 或 force push。
- 公司頁修正 commit：[621a5fb751a19d47cb7b0ff596abec130574b66e](https://github.com/Pcc329/solution-finder/commit/621a5fb751a19d47cb7b0ff596abec130574b66e)
- 初次實作 commit：[7d42a40c2d2da0a2684b135798aba1a56ab6a268](https://github.com/Pcc329/solution-finder/commit/7d42a40c2d2da0a2684b135798aba1a56ab6a268)
- 審查修正 commit：[6db3be291535400e4d8e33babf1049611d84da93](https://github.com/Pcc329/solution-finder/commit/6db3be291535400e4d8e33babf1049611d84da93)
- PR：[https://github.com/Pcc329/solution-finder/pull/262](https://github.com/Pcc329/solution-finder/pull/262)，base `main`，保持 open，未 merge。
- 開始前已執行 `git status`：原工作目錄 `solution-finder-contact-info` 在 `feat/company-frontend`，沒有未提交修改。仍另建同層 worktree `solution-name-missing`，避免切換或修改另一個對話使用的分支。
- 初次任務時原工作目錄 HEAD 為 `25c607c8ba3988042d35e395bb6c6c653b0a5d22`。本次仍只操作本任務 worktree；查公司功能改從最新 main 合併取得，沒有操作原工作目錄或 feat/company-frontend 分支。
- 不修改資料庫、不新增遷移、不升級套件；所有 `api/*.js` 保持原樣。未改搜尋篩選、加權分數、工具輸入參數或「顯示已下架方案」行為。

## 2. 新增與修改檔案

| 檔案 | 變更 |
| --- | --- |
| `public/solution-name.js`（新增） | 同一處定義 11 個佔位字，提供 `isMissingSolutionName`、`displaySolutionName`；供各前端頁面共用；MCP 另在單一 index.ts 內定義相同邏輯 |
| `public/solution-name.css`（新增） | `.sf-name-missing`：`#6b7280`、字重 `400`，覆蓋既有粗體／文字色 |
| `public/index.html` | 引入 helper/CSS；卡片、詳情、ROI 名稱；AI 摘要輸入名稱；名稱排序及既有同組排序 |
| `public/compare.html` | 比較表名稱、AI 比較輸入名稱 |
| `public/dashboard.html` | 近期更新的方案名稱；案例名稱不套用方案缺漏規則 |
| `public/diagnosis.html` | 舊探索頁卡片、AI 摘要輸入名稱、同分同價排序；雖已有 redirect，仍處理原始頁面 |
| `public/manufacturing.html` | 方案卡片、詳情、AI 推薦輸入名稱、同分排序 |
| `supabase/functions/sf-mcp/index.ts` | 版本 1.2.1；四種名稱輸出、明確的 name_missing schema；摘要與 42501 處理 |
| `tests/solution-name.test.mjs`（新增） | 35 項（含 ROI state／樣式回歸及公司清單 7 項）：缺值、完整佔位字、正常名稱保留、排序、共用資源引入 |
| `tests/sf-mcp/sf-mcp-v1-2.test.mjs` | 保留既有回歸；新增四種名稱輸出與 schema、八工具未授權、縣市、摘要、分數與 RPC 順序測試 |
| `_handover/SYNC_solution-name-missing_2026-10-20.md`（新增） | 本交接文件 |
| `_handover/solution-name-missing_mock.png`（新增） | 30 組瀏覽器 mock 顯示截圖（含公司頁兩元素） |
| `_handover/company-name-missing_mock.png`（新增） | 實際 renderCompany JSX 的合成資料顯示截圖；驗證名稱及共用缺漏樣式，不代表完整網站版面驗收 |
| `_handover/solution-name-missing_mock-responses.json`（新增） | 實際 SDK mock 呼叫的四工具完整回應、未授權回應與 mock 伺服器日誌 |

佔位字集中於 `public/solution-name.js:3`：`缺`、`缺漏`、`待補`、`無`、`-`、`—`、`N/A`、`NA`、`null`、`?`、`？`。以 trim 後的值判斷；正常名稱回傳原值，不自行 trim 或改名。依 PR #262 審查修正，MCP 在 `supabase/functions/sf-mcp/index.ts:15` 內嵌相同清單與兩個函式，讓 Supabase Dashboard 可只貼上單一 index.ts。兩份定義由測試分別載入，斷言清單完全相同且對相同測試值的判斷與顯示結果一致；Edge Function 僅保留 npm:/jsr: 匯入，不依賴本地相對路徑。

### 前端所有名稱顯示點（本 PR 行號）

| 檔案＋行號 | 顯示位置 |
| --- | --- |
| `public/index.html:160` | ROI 試算視窗名稱；`openROIModal` 在 `:1115` 先以 `displaySolutionName` 正規化 state.name，並在 `:1116` 保留 nameMissing 旗標以維持缺漏樣式 |
| `public/index.html:1758` | 首頁搜尋方案卡片 |
| `public/index.html:2027` | 首頁方案詳情標題 |
| `public/index.html:1957` | 公司清單可點擊的方案名稱按鈕 |
| `public/index.html:1958` | 公司清單無詳細頁／已下架方案的純文字名稱 |
| `public/compare.html:389` | 比較表的方案名稱列 |
| `public/dashboard.html:2087` | 近期更新列表的方案名稱（`type !== 'case'`） |
| `public/diagnosis.html:641` | 舊智能探索方案卡片 |
| `public/manufacturing.html:1472` | 方案探索詳情標題 |
| `public/manufacturing.html:1964` | 方案探索推薦卡片（兩種來源共用） |

額外的 AI 文字顯示輸入也先經過 helper，避免把原始佔位字送去生成摘要：`public/index.html:1138`、`public/compare.html:432`、`public/diagnosis.html:695`、`public/manufacturing.html:2442`。只建立顯示用 payload，不修改 allData、原始資料或 sessionStorage 中的方案。

已檢索 `public/` 全部 HTML/JS；其餘 `item.name` 為獎項、分類、案例或公司名稱，`item.s` 的其他用途為搜尋比對、評分、key 或原始比較資料，不是直接顯示點。`sources.html`、`strategy-guide.html`、`feedback.html` 沒有方案名稱列表。

排序：首頁 `public/index.html:940` 起，保留原相關性／價格／公司排序優先條件，只在相同分數、價格或公司組內把缺漏名稱放最後；名稱 A-Z 則先區分缺漏，再比較正常原名，缺漏彼此維持穩定順序。`public/diagnosis.html:571`、`public/manufacturing.html:1870` 同樣只處理同組順序。比較頁保留使用者選取順序，儀表板保留近期更新順序。MCP 保留資料庫分頁與排名順序，未修改搜尋或 SQL。

### MCP 名稱輸出與 schema

- `supabase/functions/sf-mcp/index.ts:387`：`search_solutions.results[]`。
- `supabase/functions/sf-mcp/index.ts:458`：`search_companies.companies[].solutions[]`。
- `supabase/functions/sf-mcp/index.ts:534`：`get_solution.solution`；既有 `solution_name` 改為統一顯示，另附同值的 `name` 與布林 `name_missing`。
- `supabase/functions/sf-mcp/index.ts:594`：`get_solutions.results[]`。
- `:214` 起的 solution/company outputSchema 明確要求 `name: string`、`name_missing: boolean`；詳情另保留 `solution_name: string`。其他原有欄位透過 passthrough 保留。
- `:36`：`SERVER_VERSION = '1.2.1'`。未更動工具輸入 schema／參數。

## 3. 「查公司」整合後的名稱顯示位置

PR #263 已合併至 main，本次 merge main 後，原先待其他分支處理的位置已在本 PR 完成：

| 本分支檔案＋行號 | 處理方式 |
| --- | --- |
| `public/index.html:1957` | 可點擊名稱：`displaySolutionName(solution.name)`；缺漏加 `sf-name-missing`，保留 openCompanySolution 點擊行為 |
| `public/index.html:1958` | 純文字名稱：同樣套用 helper 與缺漏 class，涵蓋已下架／無詳細頁方案 |
| `public/index.html:1941` | 保留 showDelisted 篩選，之後穩定排序同來源組內的缺漏名稱至最後；不改來源群組順序或原始 solutions 陣列 |
| `public/index.html:2027` | 方案詳情標題仍套用 helper，並保留最新 main 的公司查詢按鈕、companyLoading 與 aria-label |
| `public/index.html:160、1115、1116、1758` | 保留 ROI 名稱／缺漏旗標、首頁卡片顯示；相關性、價格及公司名稱同組排序改動均保留 |

已重新搜尋 renderCompany：直接顯示方案名稱僅有上表兩處；`solution_id` 是識別碼、company_name 是公司名稱，不套用名稱缺漏規則。由公司清單打開的詳情共用 `renderDetail`，已保留原有 displaySolutionName。公司搜尋候選頁只顯示公司名稱，沒有額外方案名稱顯示點。

本機合成資料已覆蓋 null／「缺」、可點擊／純文字、showDelisted 關／開、組內順序及點擊詳情 handler。正式資料的「元翰智慧科技有限公司」（90541148）／SOL-0075 尚未實際查詢；部署後仍需驗證真實案例。這項整合不再留待 feat/company-frontend 分支。

## 4. 驗收逐項結果與測試輸出

**僅完成本機 mock／靜態驗證，尚未真實環境驗證。** 未部署正式環境、未將 PR #262 合併至 main、未執行任何資料遷移；Edge Function 的正式部署與正式網站／MCP 實測仍待後續部署流程。GitHub 的 Vercel 自動 Preview 檢查在實作 commit 7d42a40 顯示 success；此建置結果不等於網站或 MCP 實際驗收。

| 規格驗收項目 | 結果與依據 |
| --- | --- |
| 缺漏判斷單元測試 | PASS；null、undefined、空字串、空白及全部 11 個佔位字均通過，含前後空白；律果簽、HackMD、AI 及正常名稱的前後空白保持原值 |
| 全部前端方案名稱顯示點 | PASS；main 已包含查公司，10 個直接元素已列於上表，沒有待其他分支套用的名稱位置 |
| null／「缺」mock 渲染 | PASS；10 元素 × 3 輸入共 30 組，20 組缺漏皆為「（名稱未提供）」、`rgb(107, 114, 128)`、字重 `400`；10 組正常名稱保持 HackMD；另有完整 renderCompany 的 null／缺 × 開關兩狀態 mock |
| MCP 名稱及 outputSchema | PASS；20 種輸入各跑四個名稱回傳位置；正常 false、缺漏 true；刪除 name_missing 或傳字串均無法通過實際 SDK schema 驗證 |
| MCP 未授權 | PASS；八工具均先 touch 一次，42501 回傳 isError 並停止 handler，不執行後續查詢／whoami；伺服器 mock 日誌有紀錄，用戶回應不含 SQL、錯誤碼或私人技術細節 |
| 其他 touch 錯誤 | PASS；一般錯誤、連線例外仍執行工具並記錄；原有限流 observe-only 行為保留 |
| summary_line 台北市 → 臺北市 | PASS；兩搜尋工具均驗證臺北市、臺中市、臺東縣；RPC 原輸入及 keyword 保持不變 |
| describe_data 完整第一句 | PASS；目錄 11 節皆取完整句，略過無句尾的引導標題；mapping 不再顯示「需求 → keyword：。」；all 與各節原文保持相同 |
| 既有測試、搜尋案例產生器 | PASS；全部 241 項測試成功，28 組產生器成功；產生的 SQL 未執行，因此不宣稱完成資料庫 parity 實測 |
| SERVER_VERSION | PASS；1.2.1，whoami 的實際 SDK mock 回傳亦驗證此版本 |
| 禁止變更項目 | PASS；無資料庫／遷移／套件／API／輸入參數修改，保留搜尋分數及 MCP RPC 順序；未改顯示已下架方案開關 |

測試命令與輸出摘要（公司頁修正 commit 621a5fb；所有測試採合成資料，沒有正式網路／資料庫查詢）：

```text
node --test tests/*.test.mjs tests/sf-mcp/sf-mcp-v1-2.test.mjs
tests 241
pass 241
fail 0
cancelled 0
skipped 0
todo 0
```

```text
# 在 repo 外 QA 目錄執行，避免把產出 SQL 當成 migration 納入本 PR
node ../solution-name-missing/tests/sf-mcp/sf_search_parity_gen_test.js
案例數: 28 ｜fixture.sql 4978 bytes｜cases.sql 12539 bytes
範例（A1 預期）: S09,S10,S27,S16,S01,S03,S04,S05,S26,S06,S07,S22
```

```text
node ../_solution_name_validation/visual-check.cjs
PASS: 9 inline scripts parse; 30 real-source mock elements render;
20 missing elements gray rgb(107,114,128), weight 400; 10 valid names retained.

node ../_solution_name_validation/company-page-check.cjs
PASS: actual renderCompany JSX, null/缺 × showDelisted false/true, clickable and plain names,
missing-last stable order, detail button handlers, gray text and weight 400.

git diff --check
exit 0
```

瀏覽器驗證以實際來源碼的 JSX／HTML 名稱元素搭配本次共用 CSS 渲染，並解析全站內嵌腳本；不是完整網站端到端流程，也未模擬正式 OAuth。截圖：[mock 顯示驗證](solution-name-missing_mock.png)。完整本機輸出在同層 `_solution_name_validation/company-merge-tests.txt`，該 QA 目錄未納入 PR。Node 的既有 module-type／experimental warnings 不影響通過；沒有為消除警告而改套件或專案模組設定。

## 5. MCP mock 範例回應

以下為實際 SDK mock 回應的名稱欄位節錄；完整 structuredContent 與 content 在 [mock 回應 JSON](solution-name-missing_mock-responses.json)，正常成功回應的兩者一致。

```json
{
  "search_solutions.results[0]": {
    "id": "SOL-MOCK-1", "name": "（名稱未提供）", "name_missing": true
  },
  "search_companies.companies[0].solutions[0]": {
    "id": "SOL-MOCK-1", "name": "（名稱未提供）", "name_missing": true
  },
  "get_solution.solution": {
    "solution_id": "SOL-MOCK-1", "solution_name": "（名稱未提供）",
    "name": "（名稱未提供）", "name_missing": true
  },
  "get_solutions.results[0]": {
    "id": "SOL-MOCK-1", "name": "（名稱未提供）", "name_missing": true
  }
}
```

正常名稱例如 `HackMD` 對應 `name: "HackMD"`、`name_missing: false`。缺漏 mock 的搜尋方案來源是「缺」，其餘範例來源是 null，皆通過各自的 outputSchema。

未授權 mock（`sf_mcp_touch` 回傳 `code: "42501"`，以 `count_solutions` 為例；八工具皆有相同阻擋測試）：

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "{\"error\":\"此帳號未開通 SF資料庫查詢權限，請洽管理者。\",\"next_step\":[\"請洽管理者開通權限\"]}"
    }
  ]
}
```

伺服器 mock 日誌：`[sf-mcp] count_solutions sf_mcp_touch 失敗： private permission detail`。用戶回應沒有上述技術內容，工具 handler 未執行。


## 6. PR #262 前次審查修正（歷史紀錄，行號及測試數為該次結果）

修正 commit：[6db3be291535400e4d8e33babf1049611d84da93](https://github.com/Pcc329/solution-finder/commit/6db3be291535400e4d8e33babf1049611d84da93)。沿用本 PR、同一分支，沒有另開 PR 或 merge。

1. **Dashboard 單檔部署**：移除 `import '../../../public/solution-name.js'` 與讀取 globalThis 的型別轉換。在 `index.ts:15`、`:17`、`:21` 直接定義佔位字清單、`isMissingSolutionName`、`displaySolutionName`。保留的五個匯入全部為 `npm:`／`jsr:`，不新增本地相對匯入。
2. **獨立定義一致性測試**：MCP 測試先載入實際 index.ts 的內嵌函式；另於獨立 VM 載入瀏覽器 helper 並捕捉其 Set 初始化清單。斷言兩份完整清單（含順序）一致，再以 null／undefined／空白、全部佔位字及其前後空白、正常名稱、大小寫與非字串邊界值逐一比對兩個函式的結果。MCP 測試載入器已移除原本的 public helper 匯入改寫，避免測試掩蓋部署依賴。
3. **ROI state 名稱**：`openROIModal` 的 name 明確改為 `displaySolutionName(name)`；有 `s` 欄位時以 s 為準，否則讀 name。另保存 `nameMissing`，因為 state.name 已是顯示文字，畫面需靠原始判斷旗標保留 `sf-name-missing`。測試直接執行實際 openROIModal，驗證兩種欄位輸入、缺值／佔位字／正常名稱、月費與缺漏 class。

本次變更檔案：`supabase/functions/sf-mcp/index.ts`、`public/index.html`、`public/solution-name.js`（更新說明註解）、`tests/sf-mcp/sf-mcp-v1-2.test.mjs`、`tests/solution-name.test.mjs` 與本 SYNC。上文的現況說明、行號及測試數均已同步更新。

驗證結果：全部 219 項測試通過（原 216 項及本次新增三項）；瀏覽器 mock 再驗證 9 個內嵌腳本解析、24 組名稱元素渲染均通過；`git diff --check` 通過。既有 28 組搜尋案例產生器前次已通過，本次未改搜尋邏輯，未重跑或執行其 SQL。仍僅完成本機 mock／靜態驗證，沒有正式 Dashboard 部署或正式環境實測。


## 7. 合併 main／PR #263 與公司頁驗證

- 開始時工作目錄乾淨，位於 `fix/solution-name-missing-2026-10-19`。依指定方式 `git merge origin/main`，merge commit 79670cf 的兩個 parent 分別為原分支 541be9e 與最新 main 30fded6；`git merge-base --is-ancestor origin/main HEAD` 成功。未使用 rebase、未 force push，也未將 PR #262 合併至 main。
- 唯一衝突在 `public/index.html` 的方案詳情標題／公司連結；解法同時保留本 PR 的灰色名稱 helper 與 main 的查公司按鈕、載入指示及無統編時的純文字公司名稱。其餘查公司內容由 Git 正常合併。相對最新 origin/main，api/companies.js、_lib/company-search.js、public/sources.html、vercel.json 及既有公司搜尋測試沒有額外差異。
- 本次功能修正 commit：621a5fb751a19d47cb7b0ff596abec130574b66e；變更僅 public/index.html、tests/solution-name.test.mjs，另更新本 SYNC 與 mock 證據圖。
- 新增 7 項公司清單測試：null／「缺」／HackMD 各驗證 button 與 p 的實際顯示表達式及缺漏 class，共 6 項；另 1 項執行實際 visible filter/sort，驗證開關、穩定末尾排序與不改原陣列。
- 合併後所有測試：241 pass、0 fail、0 skipped（含 main 新增的公司搜尋測試、原有 MCP 單檔部署／兩份定義一致性及 ROI 測試）。9 個內嵌腳本解析與 30 組來源元素渲染通過。另以 Babel 編譯完整實際 renderCompany JSX，驗證 null／缺 × showDelisted false／true、兩種名稱元素、詳情按鈕 handler、灰色 rgb(107,114,128) 與字重 400。
- 僅本機 mock／靜態驗證，沒有正式網站／MCP 實測。截圖：[公司頁 JSX mock](company-name-missing_mock.png)；未載入完整網站 Tailwind 版面，此證據圖只用於名稱與缺漏樣式驗證。

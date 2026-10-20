# SYNC：方案名稱缺漏顯示 / MCP 1.2.1

依據：完整閱讀附件 `SPEC_方案名稱缺漏顯示_2026-10-19.md` 後實作。使用者補充指示優先：本 PR 僅改 main 已有頁面；不修改尚未合併的「查公司」分支，只列出接續套用位置。26 筆資料與 SOL-0075 為規格提供的背景，本次未讀寫正式資料庫。

## 1. 分支、隔離與交付

- Branch：`fix/solution-name-missing-2026-10-19`
- Base：執行 `git fetch origin main` 後確認最新 `origin/main`、`FETCH_HEAD` 與本任務起點皆為 `d392cbc1702e23536227df453ffda22980e4479a`。
- 初次實作 commit：[7d42a40c2d2da0a2684b135798aba1a56ab6a268](https://github.com/Pcc329/solution-finder/commit/7d42a40c2d2da0a2684b135798aba1a56ab6a268)
- 審查修正 commit：[6db3be291535400e4d8e33babf1049611d84da93](https://github.com/Pcc329/solution-finder/commit/6db3be291535400e4d8e33babf1049611d84da93)
- PR：[https://github.com/Pcc329/solution-finder/pull/262](https://github.com/Pcc329/solution-finder/pull/262)，base `main`，保持 open，未 merge。
- 開始前已執行 `git status`：原工作目錄 `solution-finder-contact-info` 在 `feat/company-frontend`，沒有未提交修改。仍另建同層 worktree `solution-name-missing`，避免切換或修改另一個對話使用的分支。
- 原工作目錄維持乾淨，HEAD 維持 `25c607c8ba3988042d35e395bb6c6c653b0a5d22`；未 commit、覆蓋或帶入「查公司」功能。
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
| `tests/solution-name.test.mjs`（新增） | 28 項（含 ROI state／樣式回歸）：缺值、完整佔位字、正常名稱保留、排序、共用資源引入 |
| `tests/sf-mcp/sf-mcp-v1-2.test.mjs` | 保留既有回歸；新增四種名稱輸出與 schema、八工具未授權、縣市、摘要、分數與 RPC 順序測試 |
| `_handover/SYNC_solution-name-missing_2026-10-20.md`（新增） | 本交接文件 |
| `_handover/solution-name-missing_mock.png`（新增） | 24 組瀏覽器 mock 顯示截圖 |
| `_handover/solution-name-missing_mock-responses.json`（新增） | 實際 SDK mock 呼叫的四工具完整回應、未授權回應與 mock 伺服器日誌 |

佔位字集中於 `public/solution-name.js:3`：`缺`、`缺漏`、`待補`、`無`、`-`、`—`、`N/A`、`NA`、`null`、`?`、`？`。以 trim 後的值判斷；正常名稱回傳原值，不自行 trim 或改名。依 PR #262 審查修正，MCP 在 `supabase/functions/sf-mcp/index.ts:15` 內嵌相同清單與兩個函式，讓 Supabase Dashboard 可只貼上單一 index.ts。兩份定義由測試分別載入，斷言清單完全相同且對相同測試值的判斷與顯示結果一致；Edge Function 僅保留 npm:/jsr: 匯入，不依賴本地相對路徑。

### 前端所有名稱顯示點（本 PR 行號）

| 檔案＋行號 | 顯示位置 |
| --- | --- |
| `public/index.html:160` | ROI 試算視窗名稱；`openROIModal` 在 `:1010` 先以 `displaySolutionName` 正規化 state.name，並在 `:1011` 保留 nameMissing 旗標以維持缺漏樣式 |
| `public/index.html:1637` | 首頁搜尋方案卡片 |
| `public/index.html:1744` | 首頁方案詳情標題 |
| `public/compare.html:389` | 比較表的方案名稱列 |
| `public/dashboard.html:2087` | 近期更新列表的方案名稱（`type !== 'case'`） |
| `public/diagnosis.html:641` | 舊智能探索方案卡片 |
| `public/manufacturing.html:1472` | 方案探索詳情標題 |
| `public/manufacturing.html:1964` | 方案探索推薦卡片（兩種來源共用） |

額外的 AI 文字顯示輸入也先經過 helper，避免把原始佔位字送去生成摘要：`public/index.html:1033`、`public/compare.html:432`、`public/diagnosis.html:695`、`public/manufacturing.html:2442`。只建立顯示用 payload，不修改 allData、原始資料或 sessionStorage 中的方案。

已檢索 `public/` 全部 HTML/JS；其餘 `item.name` 為獎項、分類、案例或公司名稱，`item.s` 的其他用途為搜尋比對、評分、key 或原始比較資料，不是直接顯示點。`sources.html`、`strategy-guide.html`、`feedback.html` 沒有方案名稱列表。

排序：首頁 `public/index.html:835` 起，保留原相關性／價格／公司排序優先條件，只在相同分數、價格或公司組內把缺漏名稱放最後；名稱 A-Z 則先區分缺漏，再比較正常原名，缺漏彼此維持穩定順序。`public/diagnosis.html:571`、`public/manufacturing.html:1870` 同樣只處理同組順序。比較頁保留使用者選取順序，儀表板保留近期更新順序。MCP 保留資料庫分頁與排名順序，未修改搜尋或 SQL。

### MCP 名稱輸出與 schema

- `supabase/functions/sf-mcp/index.ts:387`：`search_solutions.results[]`。
- `supabase/functions/sf-mcp/index.ts:458`：`search_companies.companies[].solutions[]`。
- `supabase/functions/sf-mcp/index.ts:534`：`get_solution.solution`；既有 `solution_name` 改為統一顯示，另附同值的 `name` 與布林 `name_missing`。
- `supabase/functions/sf-mcp/index.ts:594`：`get_solutions.results[]`。
- `:214` 起的 solution/company outputSchema 明確要求 `name: string`、`name_missing: boolean`；詳情另保留 `solution_name: string`。其他原有欄位透過 passthrough 保留。
- `:36`：`SERVER_VERSION = '1.2.1'`。未更動工具輸入 schema／參數。

## 3. 「查公司」分支的後續套用位置

分支：`feat/company-frontend`；本次唯讀參考 HEAD `25c607c8ba3988042d35e395bb6c6c653b0a5d22`。依使用者明確指示，不採用附件「同步修改該分支」一項，改由該功能 PR 自行套用以下位置。下列行號屬於此分支，與本 PR 行號不同。

| 該分支檔案＋行號 | 接續工作 |
| --- | --- |
| `public/index.html:8` 起 head | 整合本 PR 後確認載入 `/solution-name.js`、`/solution-name.css`，維持 `<script type="text/babel">` 原樣 |
| `public/index.html:1946` | `renderCompany` 中可點擊的方案名稱按鈕：改用 `displaySolutionName(solution.name)`，缺漏加 `sf-name-missing` |
| `public/index.html:1947` | 無詳細頁／已下架方案的純文字名稱：相同處理；使用者提供的 SOL-0075 會走這個分支 |
| `public/index.html:1931` | `rows.filter(...)` 後，在同來源的可見方案中穩定排列缺漏名稱至最後；維持 `showDelisted` 條件、預設值與來源群組排序 |
| `public/index.html:158、1748、2016` | 整合本 PR 既有 ROI／首頁卡片／詳情顯示修改，避免解 conflict 時還原 helper |

由「查公司」PR 在整合後驗收：搜尋「元翰智慧科技有限公司」（90541148），勾選「顯示已下架方案」，確認 SOL-0075 顯示灰色、不加粗的「（名稱未提供）」並在同來源組末端；取消勾選後照原行為隱藏。**本 PR 未宣稱該未合併頁面已修正或實測。**

## 4. 驗收逐項結果與測試輸出

**僅完成本機 mock／靜態驗證，尚未真實環境驗證。** 未部署正式環境、未 merge、未執行任何資料遷移；Edge Function 的正式部署與正式網站／MCP 實測仍待後續部署流程。GitHub 的 Vercel 自動 Preview 檢查在實作 commit 7d42a40 顯示 success；此建置結果不等於網站或 MCP 實際驗收。

| 規格驗收項目 | 結果與依據 |
| --- | --- |
| 缺漏判斷單元測試 | PASS；null、undefined、空字串、空白及全部 11 個佔位字均通過，含前後空白；律果簽、HackMD、AI 及正常名稱的前後空白保持原值 |
| 全部前端方案名稱顯示點 | PASS（main 範圍）；8 個直接元素已列於上表；未合併「查公司」依使用者指示留交接 |
| null／「缺」mock 渲染 | PASS；8 元素 × 3 輸入共 24 組，16 組缺漏皆為「（名稱未提供）」、`rgb(107, 114, 128)`、字重 `400`；8 組正常名稱保持 HackMD |
| MCP 名稱及 outputSchema | PASS；20 種輸入各跑四個名稱回傳位置；正常 false、缺漏 true；刪除 name_missing 或傳字串均無法通過實際 SDK schema 驗證 |
| MCP 未授權 | PASS；八工具均先 touch 一次，42501 回傳 isError 並停止 handler，不執行後續查詢／whoami；伺服器 mock 日誌有紀錄，用戶回應不含 SQL、錯誤碼或私人技術細節 |
| 其他 touch 錯誤 | PASS；一般錯誤、連線例外仍執行工具並記錄；原有限流 observe-only 行為保留 |
| summary_line 台北市 → 臺北市 | PASS；兩搜尋工具均驗證臺北市、臺中市、臺東縣；RPC 原輸入及 keyword 保持不變 |
| describe_data 完整第一句 | PASS；目錄 11 節皆取完整句，略過無句尾的引導標題；mapping 不再顯示「需求 → keyword：。」；all 與各節原文保持相同 |
| 既有測試、搜尋案例產生器 | PASS；全部 219 項測試成功，28 組產生器成功；產生的 SQL 未執行，因此不宣稱完成資料庫 parity 實測 |
| SERVER_VERSION | PASS；1.2.1，whoami 的實際 SDK mock 回傳亦驗證此版本 |
| 禁止變更項目 | PASS；無資料庫／遷移／套件／API／輸入參數修改，保留搜尋分數及 MCP RPC 順序；未改顯示已下架方案開關 |

測試命令與輸出摘要（審查修正 commit 6db3be2；所有測試採合成資料，沒有正式網路／資料庫查詢）：

```text
node --test tests/*.test.mjs tests/sf-mcp/sf-mcp-v1-2.test.mjs
tests 219
pass 219
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
PASS: 9 inline scripts parse; 24 real-source mock elements render;
16 missing elements gray rgb(107,114,128), weight 400; 8 valid names retained.

git diff --check
exit 0
```

瀏覽器驗證以實際來源碼的 JSX／HTML 名稱元素搭配本次共用 CSS 渲染，並解析全站內嵌腳本；不是完整網站端到端流程，也未模擬正式 OAuth。截圖：[mock 顯示驗證](solution-name-missing_mock.png)。完整本機輸出在同層 `_solution_name_validation/review-tests.txt`，該 QA 目錄未納入 PR。Node 的既有 module-type／experimental warnings 不影響通過；沒有為消除警告而改套件或專案模組設定。

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


## 6. PR #262 審查修正

修正 commit：[6db3be291535400e4d8e33babf1049611d84da93](https://github.com/Pcc329/solution-finder/commit/6db3be291535400e4d8e33babf1049611d84da93)。沿用本 PR、同一分支，沒有另開 PR 或 merge。

1. **Dashboard 單檔部署**：移除 `import '../../../public/solution-name.js'` 與讀取 globalThis 的型別轉換。在 `index.ts:15`、`:17`、`:21` 直接定義佔位字清單、`isMissingSolutionName`、`displaySolutionName`。保留的五個匯入全部為 `npm:`／`jsr:`，不新增本地相對匯入。
2. **獨立定義一致性測試**：MCP 測試先載入實際 index.ts 的內嵌函式；另於獨立 VM 載入瀏覽器 helper 並捕捉其 Set 初始化清單。斷言兩份完整清單（含順序）一致，再以 null／undefined／空白、全部佔位字及其前後空白、正常名稱、大小寫與非字串邊界值逐一比對兩個函式的結果。MCP 測試載入器已移除原本的 public helper 匯入改寫，避免測試掩蓋部署依賴。
3. **ROI state 名稱**：`openROIModal` 的 name 明確改為 `displaySolutionName(name)`；有 `s` 欄位時以 s 為準，否則讀 name。另保存 `nameMissing`，因為 state.name 已是顯示文字，畫面需靠原始判斷旗標保留 `sf-name-missing`。測試直接執行實際 openROIModal，驗證兩種欄位輸入、缺值／佔位字／正常名稱、月費與缺漏 class。

本次變更檔案：`supabase/functions/sf-mcp/index.ts`、`public/index.html`、`public/solution-name.js`（更新說明註解）、`tests/sf-mcp/sf-mcp-v1-2.test.mjs`、`tests/solution-name.test.mjs` 與本 SYNC。上文的現況說明、行號及測試數均已同步更新。

驗證結果：全部 219 項測試通過（原 216 項及本次新增三項）；瀏覽器 mock 再驗證 9 個內嵌腳本解析、24 組名稱元素渲染均通過；`git diff --check` 通過。既有 28 組搜尋案例產生器前次已通過，本次未改搜尋邏輯，未重跑或執行其 SQL。仍僅完成本機 mock／靜態驗證，沒有正式 Dashboard 部署或正式環境實測。

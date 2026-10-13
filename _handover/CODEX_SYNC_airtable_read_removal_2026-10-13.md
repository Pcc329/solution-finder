# SYNC：移除 Airtable 讀取分支

日期：2026-10-13（Asia/Taipei）

## Git 與部署

- 起點：最新 `origin/main`，`a64548bf28fc445211834d970ad119903a8b8df0`，已包含 PR #204 的 merge commit；另以 Git ancestor 檢查確認 `da942d1` 在 main 歷史中。
- Branch：`refactor/supabase-only-reads-2026-10-13`，獨立 worktree，沒有帶入其他工作目錄異動。
- 程式／測試 commit：`23b4066454845bbe76be3442d945fd101a9c077d`
- PR：[Pcc329/solution-finder#205](https://github.com/Pcc329/solution-finder/pull/205)，一般 PR，未 merge。
- [Preview](https://solution-finder-git-refactor-e2bf93-patrick0814-6136s-projects.vercel.app)
- 程式 commit 的 Vercel 部署檢查：success。線上功能及案例比對仍待 PPC 執行，部署成功不等於完成驗收。
- 透過既有 GitHub 連線提交，核對遠端／本機 tree 相同後同步分支；沒有更改 Git 全域設定或工具認證。

## 第二節前置條件（照錄 PPC／Claude 已確認結果）

三個 `DB_SOURCE_*` 在 Vercel 設為 **Secret**（只能寫、不能讀），無法直接查看值。改以間接證據判斷 Production 的實際來源：

| API | 證據 | 結論 |
| --- | --- | --- |
| `solutions` | 正式站方案卡片顯示「臺北市」——此寫法為 10/5 只在 Supabase 更新，Airtable 仍為「台」 | Supabase |
| `companies` | 同上（縣市來自公司資料） | Supabase |
| `stats` | 儀表板公司數 1,102、資料維護卡片正常（Airtable 公司表為 834 筆） | Supabase |
| `cases` | 無直接證據（成功路徑不寫 log） | **未確定**；須以下方正式站／Preview 案例比對驗證 |

以上是使用者要求照錄的已確認前置條件，不是 Codex 在本輪重新讀取 Secret。**本次完全沒有修改 Vercel 環境變數。任何人不得在這三個 Secret 的空白 Value 編輯畫面按 Save。** `AIRTABLE_TOKEN` 與三個 `DB_SOURCE_*` 都保持原樣，保留到觀察期結束（2026-11-12）。

## 改動檔案與行號

| 檔案 | 修改後位置 | 內容 |
| --- | --- | --- |
| `api/solutions.js` | 第 1–304 行；Supabase 主路徑第 85 行起 | 移除 Airtable helper／分支與開關，直接執行原 Supabase 主路徑 |
| `api/cases.js` | 第 1–158 行；主路徑第 139–153 行 | 移除 Airtable 案例讀取／正規化與開關，保留公開白名單及 industry_codes 對照 |
| `api/stats.js` | 第 1–270 行；第 119–170 行資料讀取 | 移除兩個來源開關與 Airtable 特殊公司篩選，直接用原 Supabase 結果 |
| `api/companies.js` | 第 1–212 行；主路徑第 121–207 行 | 移除 Airtable 公司／方案 join，保留原 Supabase 計算、排序、篩選與上限 |
| `public/strategy-guide.html` | 第 740 行 | 僅替換指定 footer 一句文字 |
| `tests/program-badge-allowlist.test.mjs` | mock fetch／最後一項測試 | 移除已不存在的 Airtable mock；改驗證舊旗標不再改變 Supabase 路徑 |
| `tests/fixtures/supabase-read.fixture.mjs` | 全文 | 同一份合成 Supabase fixture |
| `tests/supabase-read-equivalence.test.mjs` | 全文 | 54 項等價性、失敗路徑、查詢契約與靜態檢查 |
| 本 SYNC | 全文 | 前置條件、驗證、PPC 操作及回滾 |

縮排調整是原 Supabase 區塊從 `if (source === 'supabase')` 搬入 `try` 後的層級變化，不是重新撰寫查詢或輸出邏輯。

## 移除的函式／分支

| API | 移除內容 |
| --- | --- |
| `solutions` | `DEFAULT_SOLUTIONS_SOURCE`、Airtable 用 `ACTIVE_SOLUTIONS_FILTER`／`TOKEN`／`BASE_ID`；`logAirtableError`、`sleep`、`fetchAirtableWithRetry`、Airtable `fetchAll`、`getSolutionsSource`；整個 Airtable Solutions／Companies join 與 converted 分支 |
| `cases` | `BASE_ID`、`CASES_TABLE_ID`、`DEFAULT_CASES_SOURCE`；`getCasesSource`、`logAirtableError`、`sleep`、`fetchAirtableWithRetry`、`fetchAllAirtable`、`normalizeAirtableCase`；Airtable token 缺失 500 分支與讀取分支 |
| `stats` | 兩個 `DEFAULT_*_SOURCE`、Airtable 用 `ACTIVE_SOLUTIONS_FILTER`／`TOKEN`／`BASE_ID`、Airtable 特殊篩選用 `SUSPENDED_COMPANY_STATUS`；`logAirtableError`、`sleep`、`fetchAirtableWithRetry`、Airtable `fetchAll`、`getSource`；兩個來源 ternary 分支、恆真 `needsSupabase`、Airtable 專用 JavaScript 公司篩選 |
| `companies` | `DEFAULT_COMPANIES_SOURCE`、Airtable 用 `ACTIVE_SOLUTIONS_FILTER`／`TOKEN`／`BASE_ID`；`logAirtableError`、`sleep`、`fetchAirtableWithRetry`、Airtable `fetchAll`、`getCompaniesSource`；僅供 Airtable 使用的 `parseYear`／`solutionCompanyKeys`，及 Airtable 公司／方案 join |

`stats` 的 `company_status: 'neq.暫停營業'` 保持原樣；不再補做原 Airtable 的 JavaScript 篩選，與原 Supabase 路徑結果一致。Supabase 缺少 URL／anon key 時仍回同一個 500 JSON；沒有新增 Airtable fallback，也沒有改動既有 Supabase 錯誤 log 格式。

### 保留內容

- `solutions` 第 253 行：`id: String(row.airtable_rec_id || row.solution_id || '').replace(/^\uFEFF/, '')`。
- `companies` 第 138 行：`id: row.airtable_rec_id ?? ''`。
- `solutions` 的 `emptyToBlank`、空陣列／空字串／NULL 相容處理、其他衍生欄位保留。
- PR #204 的 `PROGRAM_EVIDENCE_SOURCES`、`pgc`／`pgList` 計算保留。
- `cases` 公開欄位／confidentiality 白名單、industry_codes 查詢、已知碼顯示名稱與未知碼 fallback 保留。
- `stats.fetchMaintenance()` 第 45–73 行逐字不變；既有失敗時 `maintenance: null` 行為保留。
- 全部 Supabase SELECT／篩選／排序／分頁保留，不新增查詢、不修改資料庫。
- 三支寫入 API、`_lib/supabase-insert.js`、`tests/airtable-write-migration.test.mjs` 都與 main 相同。

### 唯一前端文字改動

```text
前：產業策略智庫 2026 · 共用 solution-finder Airtable 與 Vercel API · iii 內部顧問工具
後：產業策略智庫 2026 · 共用 solution-finder 資料庫與 Vercel API · iii 內部顧問工具
```

## 等價性測試

### 基準與 fixture

- 舊版：固定 `main` commit `a64548bf28fc445211834d970ad119903a8b8df0` 的四支 API，用 `git show` 在本機取得原始碼，來源旗標設為 `supabase`。
- 新版：本分支目前四支 API，全部走 Supabase。
- 舊版 import 僅重定位 auth 模組路徑供 Node 載入，沒有改動原 API 邏輯；兩者均執行真實 handler。
- 同一個 `tests/fixtures/supabase-read.fixture.mjs`：6 筆 Solutions（含正常、疑似已下架、已下架_資料異常、NULL；多產業陣列、空陣列、NULL、無統編、找不到公司），4 筆 Companies（含暫停營業、空統編、空標籤），4 筆 Cases（含公開／內部／非公開、真實／示範、未知行業碼與 NULL）及產業碼、計畫登錄、CDM、獎項、maintenance fixture。
- 測試 mock 依原查詢實作篩選／projection／排序／分頁；另產生 1,001 筆與 1,000 筆的分頁情境、205 家公司的上限情境。
- **不排除任何回應欄位。** 將兩次執行的時鐘固定為 `2026-10-13T04:00:00Z`，讓 stats 的本週／本月計數一致；輸入 created_at 仍原樣比對。
- 同時檢查 JSON `deepStrictEqual` 與 `JSON.stringify` 相同，涵蓋欄位型別、物件欄位順序、陣列排序；另比對 URL、SELECT、filters、order、Range、headers、maintenance POST body 與 log 文字。
- log 中 Error 物件只比較 name／message，不比較隨程式位置變化的 stack trace；API 回應的 error 欄位沒有排除。
- 測試完全使用本機合成資料，不連線 Supabase／Airtable，不執行 SQL。
- 重跑需本機 Git 歷史包含上述固定 main revision；一般完整 clone 可直接執行，shallow checkout 須先取得該 revision，測試不會自動下載歷史。

### 結果

```text
node --test tests/supabase-read-equivalence.test.mjs
54 tests / 54 pass / 0 fail

node --test tests/*.test.mjs
118 tests / 118 pass / 0 fail

node --check api/solutions.js
node --check api/cases.js
node --check api/stats.js
node --check api/companies.js
全部通過

git diff --check
通過
```

涵蓋成功、缺少各 Supabase 設定、HTTP 500、網路失敗、舊來源開關值 airtable／未設定／非法值均被忽略、原 auth 行為、companies 七種 filter／預設上限、cases 405／產業碼 lookup 失敗、maintenance 失敗、可選 data_source 失敗、多頁與既有 416 結束規則。

另用 AST 定位並比較 main 與新檔的 Supabase query helpers、industry-code／case projection helpers、companies 篩選／標籤 helpers、`fetchMaintenance`，確認原始函式內容不變。Node 既有 module type 警告不影響通過，未為此改 package.json 或工具設定。

## 既有測試與靜態檢查

- 四支 API 與 `public/` 的 `api.airtable.com`、`AIRTABLE_TOKEN`、`DB_SOURCE_`、`fetchAirtableWithRetry`：**全部 0**；額外搜尋整個 `api/` 亦為 0。
- `airtable_rec_id` 相容 ID 仍在，fixture 驗證 solutions 的 `rec-solution-01`、companies 的 `rec-company-01` 值不變。
- 原 `program-badge-allowlist.test.mjs` 最後一項原本要求 Airtable 分支 `pgc=0`，該分支已按規格移除，改為舊 Airtable 旗標被忽略、仍輸出 Supabase 六來源計數；其他徽章條件測試保留，10 項全部通過。
- `airtable-write-migration.test.mjs` 原檔不動，54 項全部通過。
- `tests/sf-mcp/sf_search_parity_gen_test.js` 未修改：唯一相關字樣是生成 Supabase 相容 schema 的 `airtable_rec_id` 欄位，不是 Airtable API 連線，也不是需移除的來源開關。
- 原 generator 在 repo 外 QA 目錄執行，28 組案例產生成功。只產出 fixture.sql／cases.sql／expected.json，**沒有執行產出的 SQL**，不宣稱這 28 組已經過資料庫 parity 驗證；生成檔不納入本 PR。

## Preview 驗收：待 PPC 執行

所有以下線上驗收尚未由 Codex 代做；使用上方 Preview，不要編輯或 Save Vercel Secret：

1. 首頁：搜尋與篩選、卡片與詳情正常；方案數與同時刻正式站一致（規格基準 2,268）。確認 legacy ID 對應頁面仍可使用。
2. 方案探索：產生推薦，檢查列表、分類篩選與行內詳情正常；PR #204 的計畫佐證徽章保持。
3. 儀表板：方案數／公司數／案例數與同時刻正式站一致（規格基準方案 2,268、公司 1,102，案例數以實際正式站為準）；資料維護卡片正常。
4. 公司圖譜／列表：卡片、公司資料、方案數、平均分數、filter 與排序正常。
5. **案例知識庫：正式站與 Preview 並排。** 先記錄兩邊案例總數，再隨機選同三個案例，逐筆比較標題、產業／行業碼、內容。若有任一差異，立即停止並回報案例識別資訊與差異，不得 merge；不得因本機 fixture 相等就認定 Production cases 一定是 Supabase。

### 案例比對結果（待 PPC 提供）

| 項目 | 正式站 | Preview | 結論 |
| --- | --- | --- | --- |
| 案例總數 | 待 PPC | 待 PPC | 未驗證 |
| 隨機案例 1：標題／產業／內容 | 待 PPC | 待 PPC | 未驗證 |
| 隨機案例 2：標題／產業／內容 | 待 PPC | 待 PPC | 未驗證 |
| 隨機案例 3：標題／產業／內容 | 待 PPC | 待 PPC | 未驗證 |

## 回滾方式

若本 PR 上線後出問題：**revert 本 PR**，即可恢復由 `DB_SOURCE_*` 決定來源的版本。`AIRTABLE_TOKEN` 和三個 Secret 一直保留原值、沒有修改，所以 revert 後能恢復目前的讀取選擇。不要為回滾按空白 Secret Value 的 Save，不需改資料庫或執行 SQL。

## 驗收清單

- [x] 起點是包含已合併 PR #204 的最新 main。
- [x] 第二節前置條件照錄，保留 cases 未確定的結論。
- [x] 四支 API 只讀 Supabase；移除 Airtable 連線與來源開關。
- [x] Supabase 查詢內容、輸出格式、篩選、排序、分頁及原錯誤 log 保持。
- [x] `airtable_rec_id`、空值相容處理、industry_codes、fetchMaintenance、PR #204 允許清單保持。
- [x] 同 fixture 四支 API 輸出 deep-equal，沒有排除任何回應欄位。
- [x] 靜態禁用字串為 0，全部 118 項測試通過。
- [x] 前端只有 strategy-guide 指定一句文字；其他前端／寫入 API 未改。
- [x] 沒有更動 Vercel 環境變數、資料庫或執行任何 SQL。
- [x] 新獨立分支／新 PR，未 merge。
- [ ] 首頁功能與方案數：待 PPC 執行。
- [ ] 方案探索：待 PPC 執行。
- [ ] 儀表板與資料維護：待 PPC 執行。
- [ ] 公司圖譜／列表：待 PPC 執行。
- [ ] 正式站／Preview 案例總數與三筆內容比對：待 PPC 執行；有差異則停止，不 merge。

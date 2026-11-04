# SYNC SF MCP v1.3.0 capital

日期為 2026-11-04，時區 Asia/Taipei。

## 交付與 Git

- Repository 為 Pcc329/solution-finder。
- Branch 為 `codex/sf-mcp-v1-3-capital`。
- 開始前已成功 `git fetch origin`，起點為 `59c425616d98f600d9df8f557c36a7a362c0ae97`。
- 實作 commit 與 PR 連結將於發布後補齊。
- 本次只處理 capital。既有 it_code_rank 欄位沿用，未新增其篩選。
- 已完成本機 Edge SDK 與 PostgreSQL 合成資料測試。線上資料驗收待使用者執行 SELECT 並回貼結果。
- 本次未執行正式環境 SQL，未執行正式 migration，未部署 Edge Function。正式部署由使用者在 PR review 後自行處理。

## 實際變更

| 檔案 | 變更 |
| --- | --- |
| `supabase/functions/sf-mcp/index.ts` | 版本 1.3.0。companySearchInput、searchMeta、capitalDisclosure、toolOutputs、search_companies、get_solution、get_solutions、DATA_GUIDE／describeTopic 的 capital 內容 |
| `migrations/20261104_sf_mcp_v1_3_capital.sql` | 替換 public.sf_search_companies，新增 public.sf_capital_coverage |
| `tests/sf-mcp/sf-mcp-v1-2.test.mjs` | 沿用實際 SDK 測試入口，新增資本額 schema、傳參、NULL／0、空頁、動態涵蓋率及錯誤測試，更新版本與目錄預期 |
| `tests/sf-mcp/sf-mcp-v1-3-capital-sql.test.mjs` | 使用 PGlite 在記憶體中實際執行舊函式與 migration，驗證計數、排序、相容性與權限 |
| `tests/sf-mcp/package.json`、`package-lock.json` | 測試指令納入 SQL 測試，固定測試依賴 @electric-sql/pglite 0.5.15 |
| `_handover/VERIFY_sf-mcp-v1.3-capital_2026-11-04.sql` | 01–08 編號的線上 SELECT 查詢，每組附用途，可在新版 RPC 部署前執行 |
| 本 SYNC | 實作、驗證狀態、口徑與部署交接 |

## DB function 與執行順序

`sf_search_companies` 保留原 17 個參數的順序、名稱與預設，尾端新增 `p_min_capital numeric default null` 與 `p_max_capital numeric default null`。Edge 對應 `min_capital`／`max_capital`，單位為元，含邊界。

函式 CTE 依序為 `r → city_filtered → f → g → tot → pg`。

- `r` 沿用既有 `sf_private.sf_ranked` 的方案母體與篩選，再 LEFT JOIN companies 取得 capital。
- `city_filtered` 沿用台／臺正規化、縣市條件及無公司編號方案的獨立 company_key。
- `f` 以 `(p_min_capital is null or capital >= p_min_capital)` 與 `(p_max_capital is null or capital <= p_max_capital)` 篩選，任一界限存在時 NULL 自然被排除。
- `capital_unknown` 對已套用其他條件與縣市的母體，在資本額篩選前 `count(distinct company_key)`。同公司多筆方案只算一組，無公司編號方案及找不到公司資料的群組視為資本額未知，沿用舊分組語意。
- `g` 按公司分組，`tot` 在全部結果計數，`pg` 最後才套 limit／offset。每組最多 5 筆方案預覽。
- `capital_desc` 在 `pg` 與最終輸出均以 capital DESC NULLS LAST 排序，同額沿用 first_rank。內部方案採 relevance 排名，因此公司內的方案預覽仍遵循既有相關性邏輯。
- 空結果與 offset 超界保留一列總數 sentinel，包含 capital_unknown_count。Edge 只移除 sentinel 並格式化當頁資料。
- `city_unknown_count` 保留原本的方案筆數單位，帶資本額時先套資本額條件，再計算無法判斷縣市的方案數。

migration 在單一交易中移除舊簽章、建立尾端帶預設參數的新簽章，避免 PostgREST overload 歧義。舊 Edge 只傳既有參數仍可呼叫。沒有 CASCADE。兩個函式均為 STABLE、SECURITY INVOKER、固定 search_path，撤銷 PUBLIC／anon 執行權並授權 authenticated，沿用登入者 RLS。

## 回傳與動態但書

`search_companies` 每家公司都有 capital。`get_solution.company` 與 `get_solutions.results[].company` 也帶 capital。NULL 照實回傳，0 保留為 0。未找到單筆方案時維持 found=false，批次全未找到時維持空結果。

所有包含資本額的成功結果附 capital_disclosure。search_companies 即使空頁也附但書。coverage 格式如下。

```json
{
  "with_capital": 8,
  "total_companies": 10,
  "percentage": 80,
  "denominator": "companies 全表公司數（不套用方案、下架狀態或本次搜尋條件）"
}
```

以上數字僅為本機合成資料範例。正式值每次呼叫 `sf_capital_coverage`，以同一句 `select count(capital), count(*) from public.companies` 計算，不建立快取表。分母為呼叫者依既有 RLS 可讀的 companies 全表，計入沒有符合方案的公司。百分比四捨五入至兩位小數，空表時 percentage=null。涵蓋率查詢失敗則整次工具回傳既有消毒錯誤，不提供虛構涵蓋率。

capital_disclosure.notes 包含規格指定的固定但書，以及「本結果僅含 SF 資料庫中有上架方案的廠商」。另說明這是預設搜尋母體，實際搜尋狀態依 status_scope，詳情工具依指定 ID 回傳，以銜接既有 include_delisted 與詳情行為。帶資本額條件時，頂層 notes 另載「有 N 家公司未填資本額，無法納入此篩選」。

`describe_data(topic="capital")` 與 index 目錄已更新，包含登記資本定義、來源清洗中、引用「已知資本額中」、即時涵蓋率與分母，以及不代表營收或企業規模的說明。

實作選擇包括只在 search_companies 提供新篩選與排序、金額參數接受非負 number 且上限 Number.MAX_SAFE_INTEGER，min 大於 max 時拒絕輸入。公司資料沒有新增 capital 以外的業務欄位。

## 兩種統計口徑

函式口徑以符合方案篩選條件的公司分組。預設方案條件為 `s.record_status is null or s.record_status not like '已下架%'`，仍包含疑似下架。normal_only=true 另排除疑似狀態，include_delisted=true 依原行為包含已下架，兩者同時 true 時 normal_only 優先。

companies 全表口徑直接對公司欄位套相同資本額與縣市條件，不要求有符合方案。差異來自無方案或只有已下架方案的公司。未帶資本額時，函式另保留無公司編號的獨立方案群組，不能直接把分組總數當成已登記公司數。帶任一資本額界限時，這些未知資本額群組會被排除。

正式數字須以使用者回貼的同次查詢結果填入，附件背景數字未當作本次驗證結果。

| 線上驗證條件 | 函式口徑公司數 | companies 全表公司數 | 對照 SQL |
| --- | --- | --- | --- |
| min_capital=100000000 | 待回貼 | 待回貼 | 03 第 1 列 |
| min_capital=100000000 且 city=[臺北市] | 待回貼 | 待回貼 | 03 第 2 列 |
| max_capital=100000000 | 待回貼 | 待回貼 | 03 第 3 列 |
| 10000000 ≤ capital ≤ 100000000 | 待回貼 | 待回貼 | 03 第 4 列 |
| capital=100000000 | 待回貼 | 待回貼 | 03 第 5 列 |
| max_capital=0 | 待回貼 | 待回貼 | 03 第 6 列 |

驗證時 companies 總筆數、有 capital 筆數與涵蓋率均待 SQL 01 結果。正式資料來源指定為 Supabase 專案 `apdbvjruevjprslhhvlx` 的 companies／solutions 即時資料，實際查詢時間以 SQL verified_at 為準。SQL 08 可在 PPC 補資料後重跑，未安排修改正式資料以驗證。

## 本機驗證與限制

重現方式為在 tests/sf-mcp 執行 `npm ci --ignore-scripts --no-audit --no-fund`，再執行 `npm test`。

- 84／84 通過，包含 76 項 Edge SDK 測試及 SQL 測試主項與 7 個子項。
- SQL 引擎為 PGlite 0.5.15，記憶體中使用 10 家合成公司，初始 8 家有 capital，包含 0、NULL、沒有方案、只有已下架方案、疑似下架及無公司編號方案。
- migration 已在本機記憶體 PostgreSQL 實際執行。不是正式 Supabase migration 執行結果。
- 6 組舊查詢逐列比較所有舊欄位、順序與總數，全部相同，包含無條件、縣市＋關鍵字、價格排序與分頁、normal_only 與 include_delisted 衝突、含已下架及超界空頁。
- SQL 篩選範例中 min=1 億為函式 5 家、全表 7 家，臺北市＋min=1 億為函式 3 家。max=1 億為函式 4 家，精確 1 億為 3 家，max=0 為 1 家。這些全部是合成資料結果。
- capital_desc 全域排序、跨頁一致、NULL 最後、公司 6 筆方案但只預覽 5 筆均通過。
- 在記憶體合成資料補一筆 NULL 為 1 後，coverage 由 8／10 變為 9／10，再還原測試資料，沒有重新部署。
- anonymous 執行權撤銷、authenticated 可執行、STABLE／SECURITY INVOKER 與舊 overload 移除均通過。
- 交付的 8 組 SELECT 全部在本機合成資料執行通過。
- Edge 核心以 TypeScript 5.9.3 strict／noEmit 檢查通過，僅在工作區暫存副本改寫 npm import，隔離 OAuth／Deno 啟動段。這不等於 Deno 或正式部署驗證。
- `git diff --check` 通過。

本次沒有使用 CSV 或線上快照。尚未完成正式 MCP 端到端呼叫、線上 RLS 身分驗證及正式資料筆數驗收。使用者要求禁止操作 Chrome 線上環境後，後續線上 SQL 由使用者執行。

## 驗收狀態

| 驗收項目 | 狀態 |
| --- | --- |
| min_capital 計數等於相同方案母體 SQL | 本機通過，線上待 SQL 03 |
| notes 的資本額未知公司組數 | 本機通過，線上待 SQL 05 |
| min_capital＋臺北市組合篩選 | 本機通過，線上待 SQL 03 |
| capital_desc 最大值第一、NULL 最後 | 本機通過，線上待 SQL 04，部署後 MCP 待驗 |
| get_solution／get_solutions capital 與 NULL | Edge SDK 通過，線上候選見 SQL 07，部署後 MCP 待驗 |
| 補資料後 coverage 自動更新 | 本機 SQL 與 Edge SDK 通過，線上待 SQL 01／08 與部署後 MCP |
| 至少 3 組不涉及資本額的舊查詢回歸 | 本機 SQL 6 組通過，Edge 既有測試通過，線上基準見 SQL 06 |
| 前端、API、其他公司資料、業務寫入工具 | diff 核對符合本次範圍；原有用量紀錄 sf_mcp_touch 沿用 |

## 部署交接

1. 使用者完成 PR review 後，**先執行 migration，再部署 sf-mcp Edge Function**。
2. 於 Supabase Dashboard SQL Editor 執行 `migrations/20261104_sf_mcp_v1_3_capital.sql`，確認交易成功。
3. 沿用 Supabase Dashboard 部署單一 `supabase/functions/sf-mcp/index.ts`，Verify JWT 維持現有關閉設定。
4. 部署後所有使用者 Disconnect 再 Connect，重新取得 tools/list，將新工具設為 Always allow。
5. 執行資本額搜尋、詳情與 coverage 的正式 MCP 驗收，將同次 SQL 對照數字補入本 SYNC。

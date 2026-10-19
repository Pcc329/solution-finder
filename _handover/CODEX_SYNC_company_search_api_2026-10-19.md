# CODEX SYNC — 公司查詢 API（PR 2／3，2026-10-19）

## Git 與交付

- Repo：https://github.com/Pcc329/solution-finder
- 已 `git pull --ff-only origin main`，實際基準：`d392cbc1702e23536227df453ffda22980e4479a`（PR #259 merge 後），與指定基準相同。
- Branch：`feat/company-search-api`。程式 commit：`a3c4059e11df3d59f3da2473447f4b9d183a5534`（後續文件更新不改程式）。
- 一般 [PR #260](https://github.com/Pcc329/solution-finder/pull/260)：open、非 Draft、不 merge、不啟用 auto-merge。
- 依附件及 v2.1 範本實作（repo 未含 sop 該檔，已讀取下載資料夾同名 v2.1 範本）；使用者另核准跨檔路由整併。相對 main 共五檔：新增 `_lib/company-search.js`、`tests/company-search.test.mjs`、本 SYNC；最小修改 `api/companies.js`、`vercel.json`。原先新增的 `api/company-search.js` 已移除。
- `api/companies.js` 只新增 import 及 handler 第一行的 search action 分派；其餘程式逐字保留。`vercel.json` 僅新增一條 rewrite，既有 entries 保留。
- 函式數：12（變更前後皆為 12，以 main 的 `api/*.js` 與本分支檔案數核對）。
- 無前端、認證 helper、寫入 helper、資料庫結構／權限變更，無新增套件。
- 本功能先於 Preview 完成驗收，PPC 向組長報告後才由人類決定 merge；Codex 不 merge、不啟用 auto-merge。

## 實作與位置

| 檔案／helper | 行號 | 用途 |
|---|---|---|
| `_lib/company-search.js` `checkRateLimit` | 12 | 獨立 Map，每 60 秒 60 次，第 61 次為 429；清除過期視窗 |
| `normalizeQuery` | 27 | 全形英數與空白正規化，去頭尾與壓縮連續空白 |
| `toCore` | 33 | 依序去一次公司後綴，再移除所有空白 |
| `sanitizeForIlike` | 37 | 移除規格列出的 PostgREST 特殊字元 |
| `parseQuery` | 41 | 1～50 字、統編 8 碼、名稱 core 與清理後 core 至少 2 字 |
| `textOrBlank`／`numberOrNull` | 56／60 | 明確的文字及數字空值處理 |
| `classifyStatus` | 66 | 已下架／疑似前綴分類，其他含 NULL 為 normal |
| `logReadError` | 73 | 僅狀態碼、表名、時間，無上游錯誤原文或金鑰 |
| `fetchSupabaseRows` | 77 | 全部讀取使用 anon key；完整方案與獎項採穩定排序分頁，支援尾頁 416；選配表失敗回空陣列 |
| `buildCompanyProfile` | 110 | 公司八欄與能量／資安／獎項欄位白名單 |
| `buildSolution` | 130 | 保留全部狀態，優先舊方案識別碼、移除開頭 BOM，數字欄位轉數字或 null |
| `summarizeSolutions` | 144 | total／normal／suspected／delisted 與來源計數；空來源為未標示 |
| `buildExactResult` | 155 | 精確命中時合併全部方案與選配資料；選配表各自容錯 |
| `briefCompany`／`quoteFilterValue` | 172／180 | 候選三欄白名單與批次篩選值跳脫 |
| `searchCompany` | 184 | 統編精確查詢；名稱先取最多 20 筆判斷唯一等 core，否則回最多 10 筆候選；查無再取前兩字提示最多 5 筆 |
| `handler` | 224 | 固定檢查順序與錯誤回應 |
| `api/companies.js` | 3／5 | import 搜尋模組及最前方 search action 分派 |
| `vercel.json` | 19 | `/api/company-search` → `/api/companies?action=search`；q 已經 Preview 實測保留 |
| `_lib/company-search.js` named exports | 257–262 | 匯出 handler 與全部 17 個具名 helper |
| `tests/company-search.test.mjs` | 全檔 | 15 項 mock fetch 測試與子案例；匯入 `_lib` |

檢查順序：OPTIONS 204（228）→ 非 GET 405（229）→ 限流（231）→ requireAuth（232）→ 參數檢查（233–234）。

候選計數只送一個 `solutions` 批次查詢，使用 `company_id=in.(...)` 與 `select=company_id,record_status`，只計算實際回傳的最多 10 家，沒有逐公司查詢。

成功回應前在 247–253 行獨立 try/catch 內 await `insertSupabase('search_logs', row)`，254 行才回 200。只填 search_query、log_type=company_search、input_type、match_type、result_count，不填 source。非 200 不寫入。

## 本機驗證

- `node --test tests/*.test.mjs`：140/140 PASS（原有 125＋新增 15）。
- `node --test tests/sf-mcp/sf-mcp-v1-2.test.mjs`：33/33 PASS。
- 總計 173/173 PASS，無新增套件。
- `node --check _lib/company-search.js`、`git diff --check`：PASS。

| # | 測試內容 | 結果 |
|---|---|---|
| 1 | 統編 exact、公司／方案白名單、summary、BOM 與完整分頁 | PASS；另測 2,000 筆與尾頁 416 |
| 2 | NULL／疑似／已下架前綴與數字空值 | PASS |
| 3 | 全形英數、空白、連字號統編 | PASS |
| 4 | 7／9 碼數字為 400 且無讀寫 | PASS |
| 5 | 名稱含／不含後綴 exact；選配表失敗各自容錯 | PASS；三張選配表各涵蓋 500、網路例外及 JSON 解析錯誤 |
| 6 | partial 最多 10、先查 20、計數只查一次、重複等 core 不誤判 exact | PASS |
| 7 | none、near 最多 5、統編查無不讀提示 | PASS |
| 8 | 特殊字元不進入名稱或提示篩選值，清理後過短為 400 | PASS |
| 9 | 空值、超過 50、core 過短與 50 字邊界 | PASS |
| 10 | 各回應路徑皆無聯絡欄位、不讀聯絡表 | PASS |
| 11 | 每次 200 恰一筆且 await；寫入錯誤回應不變；非 200 不寫 | PASS；含讀取必要表失敗、設定缺失的 500 |
| 12 | 全部讀取皆用 anon；有效工作階段亦同 | PASS |
| 13 | 第 61 次 429，先限流再認證；OPTIONS／方法檢查在前；60 秒到期重置 | PASS |
| 14 | 與 main `d392cbc` 實際 handler 比對：無 action、q、其他 action、全部公司圖譜篩選、未認證及設定缺失 | PASS；HTTP、JSON 字串及欄位順序、標頭、讀取與 log 完全相同 |
| 15 | companies search action 轉交 q，成功／400 回應與直接 handler 相同，不帶圖譜快取標頭 | PASS |

## 五之二：PPC 在 Preview 前提供的正式欄位查詢結果

- [x] PPC 已執行附件五之二的 information_schema SELECT 並提供以下完整 28 列，必要欄位齊全。
- 分組計數：companies 8、solutions 9、awards 4、gov_registrations 1、company_cdm_categories 1、search_logs 5，共 28。
- 此為 PPC 於本回合、Preview 驗收開始前提供的正式結果；不是 mock 或歷史 snapshot。

| table_name | column_name |
|---|---|
| awards | award_category |
| awards | award_name |
| awards | award_year |
| awards | company_id |
| companies | city |
| companies | company_id |
| companies | company_name |
| companies | is_startup |
| companies | it_code_rank |
| companies | logo_url |
| companies | region |
| companies | tax_primary_name |
| company_cdm_categories | company_id |
| gov_registrations | company_id |
| search_logs | input_type |
| search_logs | log_type |
| search_logs | match_type |
| search_logs | result_count |
| search_logs | search_query |
| solutions | airtable_rec_id |
| solutions | company_id |
| solutions | has_ai |
| solutions | monthly_price |
| solutions | price |
| solutions | program_type |
| solutions | record_status |
| solutions | solution_id |
| solutions | solution_name |

## 第三段：真實 Preview 驗收

### 部署、路由與資料來源

- 初版新增第 13 個函式，超過 Hobby 上限。使用者核准跨檔整併後，搜尋移至 `_lib/company-search.js`，由 companies action 分派。
- Preview：https://solution-finder-mpnnwtvnm-patrick0814-6136s-projects.vercel.app/
- [Vercel 部署](https://vercel.com/patrick0814-6136s-projects/solution-finder/4FKDpy4zhr98VYTNfruB9B8B39Qh)：Ready；commit `a3c4059`；部署時間 2026-10-19 16:12:30（Asia/Taipei）。GitHub Vercel status success。
- [部署資源](https://vercel.com/patrick0814-6136s-projects/solution-finder/4FKDpy4zhr98VYTNfruB9B8B39Qh/resources) 顯示 **Functions 12**；函式數：12（變更前後皆為 12）。
- 驗證時間：2026-10-19 16:13:39–16:17:34（Asia/Taipei）；PPC 自行登入本次 Preview。資料來自線上即時 API 與正式 search_logs 的唯讀 SELECT，無使用歷史 CSV。
- 所有搜尋皆以瀏覽器網址列呼叫 `/api/company-search?q=…`，未直接呼叫內部 action 路徑。統編、全形及中文 q 均正確回傳正規化 query 與預期結果，確認 rewrite 保留 query string。
- [Vercel HTTP／執行紀錄](https://vercel.com/patrick0814-6136s-projects/solution-finder/4FKDpy4zhr98VYTNfruB9B8B39Qh/logs)：搜尋共九次 GET 200、兩次 GET 400、一次 GET 401；九次成功的 Message 皆空，無 Supabase 讀取或寫入錯誤。401 首次冷啟動只有執行平台既有的 Node url.parse 棄用警告。

summary 縮寫順序為 total／normal／suspected／delisted；每筆另核對 by_source。

| # | 查詢 | HTTP | match_type／result_count／summary | 結果 |
|---|---|---|---|---|
| 1 | 24542716 | 200 | exact／1；精誠科技整合；1／0／1／0；臺灣雲市集=1 | PASS |
| 2 | ２４５４２７１６ | 200 | exact／1；query 正規化為 24542716；1／0／1／0；臺灣雲市集=1 | PASS |
| 3 | 54688786 | 200 | exact／1；順立智慧；6／0／6／0；臺灣雲市集=6 | PASS |
| 4 | 國興資訊股份有限公司 | 200 | exact／1；17／9／7／1；商業服務業專區=6、臺灣雲市集=8、農業雲市集-數位館=3 | PASS |
| 5 | 國興資訊 | 200 | exact／1；公司同 #4；17／9／7／1；by_source 同 #4 | PASS |
| 6 | 愛吠的狗 | 200 | partial／1；愛吠的狗娛樂股份有限公司；solution_count=15、active_solution_count=15；無 summary | PASS |
| 7 | 智遊 | 200 | partial／1；智遊旅程股份有限公司；solution_count=7、active_solution_count=7；無 summary | PASS |
| 8 | 方鼎資訊股份有限公司 | 200 | none／0；near=[]；無 summary | PASS |
| 9 | 90867101 | 200 | exact／1；智雲聯網；1／0／0／1；全部方案 delisted；臺灣雲市集=1 | PASS |
| 10 | 1234567 | 400 | 統編須為 8 碼數字；無 match_type／result_count／summary | PASS |
| 11 | a | 400 | 公司名稱至少需要 2 個字；無 match_type／result_count／summary | PASS |
| 12 | 未登入，以 24542716 查詢 | 401 | 未授權，請先登入；無 match_type／result_count／summary | PASS |

- [x] 12 項回應遞迴檢查皆無任何聯絡欄位；未登入測試為不帶登入憑證的獨立請求。
- [x] search_logs 新增恰九筆；#10–#12 不寫入。查詢時間 08:13:39.863599+00 時 count=0；08:17:34.629184+00 時 count=9。期間沒有其他 company_search 紀錄。
- [x] 既有首頁、方案詳情、聯絡卡與公司圖譜抽查正常，見下段。

### search_logs 真實唯讀 SQL 證據

[已保存的 SQL](https://supabase.com/dashboard/project/apdbvjruevjprslhhvlx/sql/0f2194c8-f09c-4af7-b47f-48e09e547e6e)（需專案權限）：

```sql
select now() as verified_at, count(*) as company_search_count
from public.search_logs where log_type = 'company_search';

select search_query, input_type, match_type, result_count, created_at
from public.search_logs where log_type = 'company_search'
order by created_at desc limit 15;
```

第二段實際回傳 9 rows；時間為 UTC：

| search_query | input_type | match_type | result_count | created_at |
|---|---|---|---|---|
| 90867101 | tax_id | exact | 1 | 2026-10-19 08:15:27.110851+00 |
| 方鼎資訊股份有限公司 | name | none | 0 | 2026-10-19 08:15:17.983356+00 |
| 智遊 | name | partial | 1 | 2026-10-19 08:15:16.572985+00 |
| 愛吠的狗 | name | partial | 1 | 2026-10-19 08:15:14.672512+00 |
| 國興資訊 | name | exact | 1 | 2026-10-19 08:15:13.627115+00 |
| 國興資訊股份有限公司 | name | exact | 1 | 2026-10-19 08:15:08.029585+00 |
| 54688786 | tax_id | exact | 1 | 2026-10-19 08:15:05.444199+00 |
| 24542716 | tax_id | exact | 1 | 2026-10-19 08:15:03.063453+00 |
| 24542716 | tax_id | exact | 1 | 2026-10-19 08:14:47.823763+00 |

兩筆 24542716 分別為半形及全形輸入，均按正規化後的值儲存。有效 exact 四家公司合計 25 筆方案（重複查詢國興與精誠各以一家公司計），partial 兩家公司各 15／7 筆；狀態計數與實際回傳陣列相符。

### 既有功能抽查

- 16:16–16:17，首頁正常載入 2,268 筆可搜尋方案；ERP 搜尋透過既有 `/api/claude` 回 200，畫面顯示 25 筆「生產物流 · ERP」結果。清除條件回復 2,268 筆。
- 點選 Lawsnote 法學搜尋系統企業方案，正常顯示方案詳情、費用、介紹與功能清單。
- 展開聯絡卡，`aria-busy=false`、一組聯絡欄位與稅籍主業正常呈現、無重試按鈕；只記錄載入狀態，不複製聯絡內容。既有 `/api/company-detail` 回 200（16:16:42）。
- `/dashboard.html#companies` 公司圖譜正常顯示 200 家；「新創」64 家，切回「全部」200 家，氣泡與公司名稱正常呈現。既有 `/api/companies` 無 action 的請求兩次均為 200（16:16:10／16:16:16），讀取 log 顯示 2,268 筆方案。

## 四之二：優雅降級

- 本機：三個選配表的讀取 500／網路／JSON 錯誤均為 200，對應欄位為 false／[]，每次只有一行安全讀取錯誤。
- 本機：search_logs POST 500 或網路例外仍回 200，整份 JSON 與成功寫入時相同。
- Preview：九筆成功搜尋的 runtime Message 均空，無讀取或寫入錯誤；SQL 證實九筆完成。未在正式環境刻意製造失敗。

## 五之三：驗證方式聲明（僅勾一項）

- [x] 已在真實 Preview 環境驗證，證據見第三、五之二段。
- [ ] 僅完成 mock／本機驗證，尚未真實環境驗證。

本 PR 已完成本機與真實 Preview 驗收。維持一般 open PR、不 merge、不啟用 auto-merge，待 PPC 向組長報告後才由人類決定 merge。

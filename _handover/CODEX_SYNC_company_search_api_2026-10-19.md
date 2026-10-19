# CODEX SYNC — 公司查詢 API（PR 2／3，2026-10-19）

## Git 與交付

- Repo：https://github.com/Pcc329/solution-finder
- 已 `git pull --ff-only origin main`，實際基準：`d392cbc1702e23536227df453ffda22980e4479a`（PR #259 merge 後），與指定基準相同。
- Branch：`feat/company-search-api`。程式 commit／一般 PR：建立後補入。
- 依附件及 v2.1 範本實作。變更限新增 `api/company-search.js`、`tests/company-search.test.mjs` 與本 SYNC。
- 無前端、既有 API、認證 helper、寫入 helper、Vercel 設定或資料庫結構／權限變更，無新增套件。
- 本功能先於 Preview 完成驗收，PPC 向組長報告後才由人類決定 merge；Codex 不 merge、不啟用 auto-merge。

## 實作與位置

| 檔案／helper | 行號 | 用途 |
|---|---|---|
| `api/company-search.js` `checkRateLimit` | 12 | 獨立 Map，每 60 秒 60 次，第 61 次為 429；清除過期視窗 |
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
| `tests/company-search.test.mjs` | 全檔 | 13 項 mock fetch 測試與子案例 |

檢查順序：OPTIONS 204（228）→ 非 GET 405（229）→ 限流（231）→ requireAuth（232）→ 參數檢查（233–234）。

候選計數只送一個 `solutions` 批次查詢，使用 `company_id=in.(...)` 與 `select=company_id,record_status`，只計算實際回傳的最多 10 家，沒有逐公司查詢。

成功回應前在 247–253 行獨立 try/catch 內 await `insertSupabase('search_logs', row)`，254 行才回 200。只填 search_query、log_type=company_search、input_type、match_type、result_count，不填 source。非 200 不寫入。

## 本機驗證

- `node --test tests/*.test.mjs`：138/138 PASS（原有 125＋新增 13）。
- `node --test tests/sf-mcp/sf-mcp-v1-2.test.mjs`：33/33 PASS。
- 總計 171/171 PASS，無新增套件。
- `node --check api/company-search.js`、`git diff --check`：PASS。

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

Preview URL／部署 commit／驗證時間：待部署後補入。

| # | 查詢 | HTTP | match_type／result_count／summary | 狀態 |
|---|---|---|---|---|
| 1 | 24542716 | 待驗 | exact；精誠科技整合；1 筆 suspected | 待驗 |
| 2 | ２４５４２７１６ | 待驗 | 同 #1 | 待驗 |
| 3 | 54688786 | 待驗 | exact；順立智慧；total≥5 | 待驗 |
| 4 | 國興資訊股份有限公司 | 待驗 | exact | 待驗 |
| 5 | 國興資訊 | 待驗 | exact | 待驗 |
| 6 | 愛吠的狗 | 待驗 | partial；含愛吠的狗娛樂 | 待驗 |
| 7 | 智遊 | 待驗 | partial；含智遊旅程 | 待驗 |
| 8 | 方鼎資訊股份有限公司 | 待驗 | none；result_count=0 | 待驗 |
| 9 | 90867101 | 待驗 | exact；全 delisted，delisted≥1 | 待驗 |
| 10 | 1234567 | 待驗 | 400 | 待驗 |
| 11 | a | 待驗 | 400 | 待驗 |
| 12 | 未登入呼叫 | 待驗 | 401 | 待驗 |

- [ ] 以上 12 項回應皆無聯絡欄位。
- [ ] search_logs 新增 company_search 筆數為 9，#10–#12 不寫；待附正式 SELECT 結果。
- [ ] 既有首頁搜尋、方案詳情頁、聯絡卡抽查不變。

## 四之二：優雅降級

- 本機：三個選配表的讀取 500／網路／JSON 錯誤均為 200，對應欄位為 false／[]，每次只有一行安全讀取錯誤。
- 本機：search_logs POST 500 或網路例外仍回 200，整份 JSON 與成功寫入時相同。
- Preview：待檢查真實請求紀錄未出現寫入錯誤；不在正式環境刻意製造失敗。

## 五之三：驗證方式聲明（僅勾一項）

- [ ] 已在真實 Preview 環境驗證，證據見第三、五之二段。
- [x] 僅完成 mock／本機驗證，尚未真實環境驗證。

本 PR 尚未完成真實驗收；後續先安排 Preview 驗證，不 merge。

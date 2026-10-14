# SYNC: SF MCP v1.2.0

日期：2026-10-14（Asia/Taipei）

## 狀態與 Git

- PR：https://github.com/Pcc329/solution-finder/pull/256 （一般 PR，未 merge）
- Branch：`feat/sf-mcp-v1-2-2026-10-14`
- 起點：最新 main `a91e900893fbb68bb0b574c488f38bf9afbe2b9e`，包含 PR #205。
- 實作 commit：`31cf01c88190bdb24cbd0f8cc660b084b71aa6d0`（本 SYNC 以後續文件 commit 補入同一 PR）。
- 遠端發布採 GitHub connector；已 fetch 並核對本機與遠端 tree 相同，未 force push。
- **僅完成 mock／靜態驗證，尚未真實環境驗證。**沒有執行任何資料庫指令、沒有部署 Edge Function、沒有修改 Vercel 環境變數。
- 依 PPC 本次直接指示，遷移已於 2026-10-14 執行並完成交易外驗證；本 PR 只逐字保存附件，不重跑遷移。
- 部署後須重新連線 MCP，更新 `tools/list` 的新參數、title、outputSchema。真實查詢驗收待 PPC／Claude 完成；Vercel Preview 不等於 Supabase Edge Function 已部署。

## 改動範圍

| 檔案 | 內容 |
|---|---|
| `supabase/functions/sf-mcp/index.ts` | v1.2.0、兩個搜尋 RPC、回應分級、topic、結構化輸出、共用 runTool／用量與錯誤處理 |
| `docs/sf-mcp-skill/SKILL.md` | 規格附錄一原文，逐字複製，未安裝至本機 Skills |
| `migrations/20261014_sf_mcp_v1_2.sql` | SQL 附件逐 byte 複製，僅入版控，未執行 |
| `.gitattributes` | 新增上述 SQL、Skill 的 `-text`，避免 Windows autocrlf 改動逐字附件 |
| `tests/sf-mcp/sf-mcp-v1-2.test.mjs` | 實際固定 SDK＋mock Supabase 的 31 項測試 |
| `tests/sf-mcp/package.json`、`package-lock.json`、`.gitignore` | 測試依賴固定 server 2.0.0／Zod 4.6.5，忽略 node_modules；不影響舊 CommonJS 產生器 |
| 本 SYNC | 回報、mock 範例與部署後待驗事項 |

`public/`、`api/` 均無改動。沒有新增業務寫入工具或查詢；唯一用量寫入路徑是 `sf_mcp_touch`。沒有直接呼叫 `sf_private`。

刪除：`PAGE`、`SCAN_CAP`、`scanPages`、`fetchPage`、`filterByCity`、`groupByCompany`、`normCity`，及工具說明／第十節的舊掃描上限文字。

## 關鍵位置與實作

位置皆指本次實作 commit 的 `supabase/functions/sf-mcp/index.ts`：

- 第 20 行 `asText`：同一物件 JSON 序列化後，同時供應 `structuredContent` 與文字 content；避免 undefined 導致兩份內容不同。
- 第 25 行 `SERVER_VERSION = '1.2.0'`，第 26 行 `RATE_LIMIT_ENFORCE = false`。
- 第 138 行 `normal_only`：預設 false，說明逐字依規格；與 include_delisted 同時為 true 時，原樣傳入 RPC，由已交付 SQL 的正常條件優先生效，notes 另說明。
- 第 142 行 topics／`describeTopic`：index 預設為 11 行目錄＋第一二節全文；13 個 topic 均驗證，all 只有規格指定的三處文字差異。
- 第 161 行 `nextSteps`：四類建議均有測試；false 的 is_*、0 的 max_price 也視為已帶條件。空陣列不列入。
- 第 177 行 `searchMeta`：summary_line 使用 RPC 全體總數（不是當頁長度），status_scope、必讀 notes 最多三條、notes_more；合併範圍提醒以保留衝突、部分失敗與疑似下架提醒。
- 第 209 行 `toolOutputs`：八工具的 Zod outputSchema；第 224 行中文 title 對照。
- 第 235 行 `createSfServer`：抽出每次請求建立 server 的工廠，仍由原 OAuth/RLS middleware 取得登入者 client，未改認證或資料權限。
- 第 236 行 `runTool(name, handler)`：八工具一律先呼叫 touch，再執行 handler；touch 失敗只記 sanitized console.error，超量且開關 false 只 warn。測試注入 true 與固定秒數，驗證阻擋訊息與 next_step。
- 第 272 行 `enrichRows`：只取當頁公司／方案的稅籍、獲獎、產業別；移除 city select／cityMap，縣市改由 RPC 原樣提供。部分失敗不回傳原始資料庫錯誤；未知獲獎資訊回 null，不假冒「沒有獲獎」。
- 第 305 行 `registerTool`：統一加 title、outputSchema、runTool，八工具都經過此入口。
- 第 331 行 `search_solutions`：單次 sf_search_solutions，新增 p_cities、p_normal_only；總數來自 total_matches／suspected_total／city_unknown_count。
- 第 408 行 `search_companies`：單次 sf_search_companies；先保留總數，再排除 company_key=null 的計數列；不在 Edge 重新分組，無公司編號的獨立組不合併。
- 第 651 行起 `whoami`：保留 auth.getUser 查詢，只移除舊 email 輸出，符合本次不得回傳 email 的較明確限制。
- 第 683 行 `Deno.serve`：維持 withOAuthProtectedResource／withSupabase(auth:user) 與 createMcpHandler 流程。

`get_solution`、`get_solutions`、`data_status`、`whoami`、`count_solutions` 的業務查詢及 handler 本體已與基準逐字比對測試；除 whoami 移除 email 回傳外相同。聯絡人仍只查 contact_name、title、office_phone；未新增完整 description、email、手機查詢。

## SDK 支援與錯誤 schema

D 已完整實作，**沒有升級或更換 Edge import 的任何版本**。

- 直接檢視並執行 npm 發布的 `@modelcontextprotocol/server@2.0.0`，不是假 SDK。
- `registerTool` 支援 outputSchema，`validateToolOutput` 驗證成功回應的 structuredContent。
- 同一 SDK 的 `validateToolOutput` 遇到 `result.isError` 會直接 return，不做成功 schema 驗證。
- 本次錯誤回應不帶 structuredContent，只帶 isError＋JSON 文字 `{error,next_step}`；避免將錯誤誤作成功資料。
- 測試證明：isError 無 structuredContent 可通過；拿掉 isError 後同一回應會被 SDK 拒絕（no structured content）。
- 額外用真實 SDK 的 HTTP handler 實測 tools/list 與 tools/call（in-process Request，mock DB，無網路），確認 wire 回應保留 title／object outputSchema／結構化與文字同值。
- 用量超過限制的拒絕只在測試注入 `rateLimitEnforce:true`；正式常數仍 false。

## 驗證結果

環境：Windows、Node v24.14.1。驗證來源僅測試程式內 mock Supabase，**沒有線上資料筆數或真實使用者數可回報**。

重現方式（Node 需支援 stripTypeScriptTypes，本次使用 24.14.1）：

```powershell
cd tests/sf-mcp
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

實際結果：

```text
SF MCP v1.2 tests: 31 / 31 PASS, fail 0
Existing API regression tests: 118 / 118 PASS, fail 0
sf_search_parity_gen_test.js: 案例數 28，exit 0
node --check tests/sf-mcp/sf-mcp-v1-2.test.mjs: exit 0
node --check tests/sf-mcp/sf_search_parity_gen_test.js: exit 0
git diff --check / git diff --cached --check: exit 0
```

另在 repo 外暫存目錄使用 TypeScript 5.9.3 對 Edge 核心進行 `--strict --noEmit --skipLibCheck --module NodeNext --target es2022` 檢查，固定 SDK／Zod 型別，exit 0。只將 npm import 路徑改成測試安裝路徑，隔離 Deno/OAuth 啟動段；這不是 Deno 部署檢查（本機沒有 Deno）。未改 Edge 套件版本。

舊 28 案例產生器只在 repo 外 QA 目錄產生 fixture.sql／cases.sql／expected.json，**沒有執行 SQL**。因此不能宣稱本次完成資料庫舊參數 parity 實測；PPC 已完成遷移驗證的資訊來自本次使用者指示。

| 規格驗收 | 結果 |
|---|---|
| 舊掃描常數／函式／300 筆文字移除 | 通過靜態測試 |
| search_solutions 帶／不帶 city 都單次搜尋 RPC | 通過；另外一次 touch 是用量紀錄，不是重複搜尋 |
| search_companies 單次 RPC、全體家數不等於當頁家數 | 通過；mock 為 152 家／390 方案，當頁 1 家 |
| 僅計數 sentinel 列不成為廠商卡，仍保留總數 | 通過，含 offset 超界情境 |
| summary_line 使用 RPC 總數 | 有列／公司 sentinel 通過；方案空頁限制見下節 |
| normal_only 傳入與衝突說明 | 通過 |
| 八工具 title／outputSchema／成功內容一致 | 逐一通過，含實際 SDK HTTP |
| handler 錯誤中文化、不含 SQL／連線字串／stack | 通過 |
| 0 筆 next_step 四類條件與縣市未知筆數 | 通過；keyword、city、篩選、normal_only 分別測試 |
| touch 失敗 fail-open／只記錄超量／注入強制拒絕 | 通過三種分支及 thrown touch |
| describe_data 預設 index、每個 topic、all 保留原文 | 通過 |
| 既有 28 案例產生器 | 產生器通過；未執行資料庫 SQL，parity 仍待真實環境確認 |
| 版本 1.2.0／唯讀限制／無網站改動 | 通過靜態測試與 diff 核對 |

## 附件 hash 與已知 RPC 邊界

SQL SHA-256（原附件、工作檔、Git index 三者一致）：

```text
0c06539e6472b1a5160f87e7543d3b0ef06e2bf66528169baf50f106205c7b5f
```

Skill 附錄內容 2,131 bytes，SHA-256：

```text
5077479ab8513d5316c14bc5acb5cc376b68170d9f3f69ec345a60d2c12e1d8c
```

兩項介面限制如實回報，未私改已驗證遷移檔、未增發 DB 查詢：

1. `sf_search_solutions` 以 window count 附在明細列上；完全無結果或 offset 超界時回傳空陣列，沒有總數／縣市未知列。空頁總數欄位沿用 0 預設，不冒稱取得 RPC 的真實全體數字；offset>0 時 notes／next_step 明確要求 offset=0 重查。帶 city 的空頁也明示 city_unknown=0 不代表已確認沒有缺口，可改查 search_companies。公司 RPC 自帶 sentinel，不受此限制。
2. include_delisted=true 時 RPC 沒有獨立的已下架計數，只提供總數與疑似數。依介面保留 `totals.normal = total - suspected`，但 summary_line 改明示「非疑似下架（含已下架）」，notes_more 也說明該欄位限制，避免將已確認下架誤稱正常。預設與 normal_only 模式維持規格的正常／疑似呈現。

## 三組 mock 回應

以下前兩組為成功回應的完整 structuredContent；content[0].text 由同一物件 JSON.stringify 產生。名稱／ID／數字都是 mock，不是線上查證結果。

### 1. 帶縣市有結果

呼叫：search_companies，city=["臺北市"]、keyword="AI"、limit=1。

```json
{
  "summary_line": "臺北市，關鍵字「AI」：152 家廠商、390 筆方案（正常 360、疑似下架 30）；另有 12 筆縣市未填未納入。",
  "status_scope": "正常＋疑似下架",
  "notes": [
    "縣市指公司總部所在地。",
    "疑似下架方案請在回答中逐筆標「⚠疑似下架」，最後一句總說明即可；使用者問到才說明原因（原因可用 data_status 查）。"
  ],
  "notes_more": [],
  "companies_total": 152,
  "solutions_total": 390,
  "totals": { "companies": 152, "solutions": 390, "normal": 360, "suspected_delisted": 30, "city_unknown": 12 },
  "returned": 1,
  "offset": 0,
  "next_offset": 1,
  "next_step": null,
  "page_summary": { "companies": 1, "solutions": 9, "normal": 7, "suspected_delisted": 2 },
  "companies": [{
    "company_id": "MOCK-C1",
    "company": "Mock 廠商",
    "company_city": "臺北市",
    "company_region": "北部",
    "tax_primary_industry": "程式設計",
    "it_code_rank": 1,
    "has_company_award": true,
    "company_award_best_level": "國際級",
    "solutions_count": 9,
    "normal_count": 7,
    "suspected_delisted_count": 2,
    "solutions": [{
      "id": "SOL-MOCK-1", "name": "Mock AI 方案", "source": "測試來源",
      "price": 1000, "pricing_model": ["訂閱制"], "status": "正常", "score": 100
    }]
  }]
}
```

### 2. 0 筆不是錯誤

呼叫：search_companies，city=["臺北市"]、keyword="入住自動化"；RPC 僅回計數列。

```json
{
  "summary_line": "臺北市，關鍵字「入住自動化」：0 家廠商、0 筆方案（正常 0、疑似下架 0）；另有 12 筆縣市未填未納入。",
  "status_scope": "正常＋疑似下架",
  "notes": ["縣市指公司總部所在地。"],
  "notes_more": [],
  "companies_total": 0,
  "solutions_total": 0,
  "totals": { "companies": 0, "solutions": 0, "normal": 0, "suspected_delisted": 0, "city_unknown": 12 },
  "returned": 0,
  "offset": 0,
  "next_offset": null,
  "next_step": [
    "改用較短的關鍵字（例如「入住」）",
    "拿掉縣市篩選，或改用 region",
    "另有 12 筆縣市未填，未納入"
  ],
  "page_summary": { "companies": 0, "solutions": 0, "normal": 0, "suspected_delisted": 0 },
  "companies": []
}
```

### 3. 工具拋錯

Mock RPC 故意拋出含 SQL、連線字串與 stack 的例外；實際工具回應已消毒：

```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "{\"error\":\"「搜尋方案」暫時無法完成，請稍後再試。\",\"next_step\":[\"稍候再試\",\"確認查詢條件，或聯絡資料維護者\"]}"
  }]
}
```

## 部署後待驗

1. PPC 部署此 PR 的 sf-mcp Edge Function；不需要重跑本次 SQL。
2. 重新連線後查 tools/list 的版本／title／normal_only／topic／outputSchema。
3. Claude 以真實 MCP 查帶／不帶縣市的兩種搜尋、推薦 normal_only、計數、分頁、零筆、資料詳情與用量；依上方兩項 RPC 邊界一起核對。
4. 本 PR 不自行 merge，不執行資料庫指令，也不宣稱真實環境已通過。

# SYNC：Airtable 寫入遷移 Supabase

日期：2026-10-12（Asia/Taipei）

## Git 與範圍

- 起點：重新 fetch 後的 `origin/main`，`b12e424`；獨立乾淨 worktree，沒有帶入任何舊工作目錄異動。
- Branch：`feat/airtable-write-migration-2026-10-12`
- 程式／測試／SQL commit：`396afbe63d3738ef3817698e94737d0048ea4bf6`
- PR：[Pcc329/solution-finder#203](https://github.com/Pcc329/solution-finder/pull/203)，一般 PR，**未 merge**。
- [Vercel Preview](https://solution-finder-git-feat-airt-e7d916-patrick0814-6136s-projects.vercel.app)
- 程式 commit 的 Vercel 部署檢查為 SUCCESS，2026-10-12 14:49（Asia/Taipei）。部署成功不等於已驗證寫入；三支 API 的線上提交仍待 PPC 執行。
- 與 PR #202 無關，沒有修改其分支。

## 改動檔案與位置

| 檔案 | 位置／函式 | 實際改動 |
| --- | --- | --- |
| `api/ask.js` | 第 3 行、18–25 行 `writeLog()`、123 行呼叫 | 移除 Airtable token／寫入／重試；改寫 `ask_logs` |
| `api/claude.js` | 第 4 行、17–22 行 `writeLog()`、114 行呼叫 | 移除 Airtable token／寫入／重試；改寫 `search_logs` |
| `api/feedback.js` | 第 2 行、42–44 行設定檢查、98–111 行寫入 | 移除 Airtable base/table ID、typecast、寫入／重試；改寫 `feedback_submissions` |
| `_lib/supabase-insert.js` | 第 1–46 行，`logWriteError()`／`insertSupabase()` | 共用單次寫入與去內容化錯誤紀錄 |
| `migrations/20261012_create_airtable_replacement_tables.sql` | 第 1–115 行 | 附件原檔逐位元組存檔，**未執行** |
| `.gitattributes` | 第 1 行 | 僅對這份 SQL 設定 `-text`，防止 Windows autocrlf 在日後 checkout 變更換行 |
| `tests/airtable-write-migration.test.mjs` | 第 1–195 行 | Node 原生測試，沒有新增套件 |
| 本 SYNC | 全文 | 實作對照、驗證結果、PPC 操作與 SQL |

未改動前端、`api/solutions.js`／`cases.js`／`stats.js`／`companies.js` 的讀取分支、`api/csp-report.js`、`_lib/auth.js`、`vercel.json`、資料庫或 Vercel 環境變數。

## 三支 API 改動前後

### ask.js

改前：`writeLog(token, {...})` 以 Airtable `fields` 包裝，送到 Ask_Logs，API 本身產生 timestamp，429 最多重試 3 次。

改後：

```js
async function writeLog({ question, resultCount, searchQuery, answerLength }) {
  await insertSupabase('ask_logs', {
    question,
    search_query: searchQuery || '',
    result_count: resultCount,
    answer_length: answerLength,
  });
}
```

仍在取得回答後、回傳前 `await writeLog(...)`。helper 回 false 時不往上拋錯，仍回 `200 { answer }`。

### claude.js

改前：`writeLog(token, { query })` 寫 Airtable Search_Logs／Logs，包含 timestamp 與 Airtable fields 包裝、429 重試。

改後：

```js
async function writeLog({ query }) {
  await insertSupabase('search_logs', {
    search_query: query,
    log_type: 'ai_search',
  });
}
```

仍在解析 AI JSON 後、回傳前呼叫。寫入失敗不影響原本搜尋結果。

### feedback.js

改前：檢查 `AIRTABLE_TOKEN`，把驗證後值組成 Airtable 中文欄位 `fields`，使用 `records: [{ fields }]`／`typecast: true`。

改後：

```js
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' });
}
```

```js
const stored = await insertSupabase('feedback_submissions', {
  name,
  department,
  milestone,
  detail,
  score,
  relevant_count: relevantCount,
  path_choice: pathChoice,
  would_cite: wouldCite,
});

if (!stored) {
  return res.status(502).json({ error: 'Storage write failed' });
}
```

optionalString／optionalInteger 既有 null 行為維持，不以 truthy 判斷遺漏合法的 `relevant_count: 0`。成功仍回 `200 { ok: true }`。

### 共用寫入契約

- `POST /rest/v1/<table>`，單筆 JSON 物件、不雙寫、不重試。
- headers：`apikey` 與 `Authorization: Bearer ...` 都用 `SUPABASE_SERVICE_ROLE_KEY`，另有 `Content-Type: application/json`、`Prefer: return=minimal`。
- 不使用 anon key；body 不送 `id`／`created_at`／`source`，交給資料庫預設值。
- HTTP 失敗只讀取 JSON `code`，只接受長度 1–64 的英數／底線 token；其他值、JSON 解析失敗一律 `unknown`，避免 code 被異常內容污染。
- 網路錯誤、URL 設定錯誤或缺少設定沒有實際 HTTP status，記 `status=unknown code=unknown`；不印 exception、request、回應 body。
- 唯一寫入錯誤紀錄格式：

```text
[Supabase Error] status=400 table=ask_logs code=23514 time=<ISO時間>
```

## 本機驗證

來源：合成測試資料與 mock fetch，**沒有呼叫真實 Supabase 或 Anthropic、沒有線上寫入或 SQL 執行**。Node `v24.14.1`。

```text
node --test tests/airtable-write-migration.test.mjs
tests 54 / pass 54 / fail 0
```

測試範圍：

- 三支 API 成功、400／500／429、網路 exception、非 JSON 錯誤回應、含內容的偽造 code、各環境變數缺失。
- 每次最多一次儲存請求；缺設定 0 次；apikey／Authorization 確認是 service-role 而非刻意設置的合成 anon key。
- 各 JSON 欄位精確相等，且不含 `id`／`created_at`／`source`。
- AI 寫入失敗仍回 200；feedback 儲存失敗 502、缺設定 500。
- 錯誤紀錄只含 status／table／code／time，合成私密標記不會出現在 log。
- 三支 API requireAuth 拒絕未登入請求；ask／claude OPTIONS 維持不需登入。
- feedback 必填、長度、允許值、整數範圍、JSON 格式、optional null 與合法 0；同 IP 第 4 次限流 429，另一 IP 正常。
- `node --check`：三支 API、helper、測試檔均通過；`git diff --check` 通過。
- Node 會提示既有 repo 未宣告 module type，重新解析為 ESM；不是測試失敗，沒有為此新增 package.json 或更動工具設定。

與起點 main 逐段字串比對（僅正規化檔案 CRLF／LF 後比對）：feedback 的 allowlists、requireAuth、IP 取得、rate limit、parseBody／requiredString／optionalString／optionalInteger、欄位驗證與 catch 區塊均相同；ask／claude 的模型、prompt、AI request／response 區塊均相同。

### SQL 原檔核對

- 使用 `Copy-Item` 複製附件，不經文字解碼／重寫。
- 附件：7,717 bytes，UTF-8 無 BOM、115 個 LF、0 個 CRLF。
- 附件、本機 migrations 檔案、Git 儲存 blob 的 SHA-256 相同：

```text
a8961212bab2f91a37cd071cb65d863f065ea3154561999c8ced017e71ba3003
```

Windows Git 的 `core.autocrlf=true` 可能在日後 checkout 改變換行，因此 `.gitattributes` 只對這份 SQL 設定 `-text`，保持原始 bytes；其他檔案的換行規則不變。本機檔案與 Git 原始 blob 都實際核對 hash。SQL 只有存檔，沒有建表、改權限或匯入歷史資料。

## Preview 操作：待 PPC 執行

這些不是已完成的線上驗收，請 PPC 使用 PR #203 的 Preview，**不要用 Production**：

1. 在 Vercel Environment Variables 檢查 **Preview** 有 `SUPABASE_URL`／`SUPABASE_SERVICE_ROLE_KEY`，不要貼出值；如缺少請回報。本次 Codex 未讀取金鑰或自行新增／修改設定，因此存在性目前也待 PPC 確認。
2. 登入 Preview，首頁搜尋 `【測試】請找適合中小企業的人資方案` 一次。Network 的 `/api/claude` 應為 200 且回篩選 JSON，介面正常出現結果。這才是本規格的 AI 搜尋 API；manufacturing Agent 的其他 API 不屬本次範圍。
3. 在有結果的搜尋頁「詢問 AI」送出 `【測試】請簡述這些方案適用情境` 一次。`/api/ask` 應為 200、答案正常顯示。
4. 開 Preview 的 `/feedback.html`，姓名填 `測試`，選「其他回饋」，回報內容填 `【測試】Supabase 寫入遷移驗證`，選填欄位可留空。只送出 1 次，`/api/feedback` 應回 200 `{ "ok": true }`。
5. 在 SQL Editor 由 PPC 執行下方唯讀 SQL。首次測試預期三張表各 1 筆測試；若曾重測，先記錄基準筆數，確認各增加 1 筆，不要把重測筆數誤判成重複寫入。
6. 前兩張 `source` 應是 `api`；`feedback_submissions` **沒有 source 欄位**，不要對它查 source。三張表 ID／created_at 應由 DB 產生。檢查 Vercel logs 沒有此三次提交的儲存錯誤。

## 唯讀驗證 SQL（只提供，未執行）

```sql
SELECT 'ask_logs' AS table_name,
       count(*) AS total_rows,
       count(*) FILTER (WHERE left(question, 4) = '【測試】') AS test_rows,
       count(*) FILTER (WHERE left(question, 4) = '【測試】' AND source = 'api') AS api_test_rows
FROM public.ask_logs
UNION ALL
SELECT 'search_logs', count(*),
       count(*) FILTER (WHERE left(search_query, 4) = '【測試】'),
       count(*) FILTER (WHERE left(search_query, 4) = '【測試】' AND source = 'api')
FROM public.search_logs
UNION ALL
SELECT 'feedback_submissions', count(*),
       count(*) FILTER (WHERE left(detail, 4) = '【測試】'),
       NULL::bigint
FROM public.feedback_submissions;

SELECT id, created_at, question, search_query, result_count, answer_length, source
FROM public.ask_logs WHERE left(question, 4) = '【測試】' ORDER BY id DESC;

SELECT id, created_at, search_query, log_type, source
FROM public.search_logs WHERE left(search_query, 4) = '【測試】' ORDER BY id DESC;

SELECT id, created_at, name, department, milestone, detail,
       score, relevant_count, path_choice, would_cite
FROM public.feedback_submissions WHERE left(detail, 4) = '【測試】' ORDER BY id DESC;
```

## 測試資料清除 SQL（只提供，未執行）

只針對 question／search_query／detail **開頭**等於 `【測試】` 的列。先檢查範圍是否符合要清除的測試，不會刪除未帶此標記的正式資料。預設最後是 **ROLLBACK**，可先確認刪除前／刪除筆數／刪除後筆數；PPC 確認範圍後自行把最後一行改成 `COMMIT;` 再執行才會真的刪除。

```sql
BEGIN;

SELECT 'before' AS phase, 'ask_logs' AS table_name, count(*) AS test_rows
FROM public.ask_logs WHERE left(question, 4) = '【測試】'
UNION ALL
SELECT 'before', 'search_logs', count(*) FROM public.search_logs WHERE left(search_query, 4) = '【測試】'
UNION ALL
SELECT 'before', 'feedback_submissions', count(*) FROM public.feedback_submissions WHERE left(detail, 4) = '【測試】';

WITH deleted AS (
  DELETE FROM public.ask_logs WHERE left(question, 4) = '【測試】' RETURNING id
)
SELECT 'ask_logs' AS table_name, count(*) AS deleted_rows FROM deleted;

WITH deleted AS (
  DELETE FROM public.search_logs WHERE left(search_query, 4) = '【測試】' RETURNING id
)
SELECT 'search_logs' AS table_name, count(*) AS deleted_rows FROM deleted;

WITH deleted AS (
  DELETE FROM public.feedback_submissions WHERE left(detail, 4) = '【測試】' RETURNING id
)
SELECT 'feedback_submissions' AS table_name, count(*) AS deleted_rows FROM deleted;

SELECT 'after' AS phase, 'ask_logs' AS table_name, count(*) AS test_rows
FROM public.ask_logs WHERE left(question, 4) = '【測試】'
UNION ALL
SELECT 'after', 'search_logs', count(*) FROM public.search_logs WHERE left(search_query, 4) = '【測試】'
UNION ALL
SELECT 'after', 'feedback_submissions', count(*) FROM public.feedback_submissions WHERE left(detail, 4) = '【測試】';

ROLLBACK; -- 預設演練；確認刪除範圍後，由 PPC 改為 COMMIT。
```

## 驗收清單

- [x] 三支 API 無 Airtable 網址、token、retry helper、base/table ID；不雙寫。
- [x] 三支 API 經共用 helper 使用 service-role，不以 anon 寫入。
- [x] 單筆 JSON 不送 id／created_at／source。
- [x] 錯誤 log 僅 status／table／code／time，不含 message／details／hint／request body。
- [x] feedback 驗證、允許值、requireAuth 與限流比對 main 相同。
- [x] 原檔 SQL hash 符合規格，沒有執行 SQL。
- [x] 本機模擬 Supabase 400／500：ask／claude 結果正常，feedback 502。
- [x] 本機模擬設定缺失：ask／claude 結果正常，feedback 500。
- [x] 新獨立分支／新 PR 已建立，未 merge。
- [ ] Preview service-role 設定存在性：待 PPC 確認。
- [ ] Preview AI 顧問問答測試：待 PPC 執行。
- [ ] Preview AI 搜尋測試：待 PPC 執行。
- [ ] Preview feedback 提交測試：待 PPC 執行。
- [ ] 三張表各新增 1 筆測試、前兩表 source=api：待 PPC 執行唯讀 SQL 確認。

在上述 Preview 實測確認前，不宣稱線上遷移已驗收，不 merge。

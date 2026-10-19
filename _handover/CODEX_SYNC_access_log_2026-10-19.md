# CODEX SYNC — 聯絡資訊存取紀錄與搜尋紀錄欄位（2026-10-19）

## 交付與基準

- Repo：https://github.com/Pcc329/solution-finder
- 已 `git pull --ff-only origin main`，實際基準：`4d47b897f9dfc13f9315dcd12f8802c69332f09c`，與指定基準相同。
- Branch：`feat/contact-access-log`。程式 commit：`7519a55138d3391d0dc34cd0f0262de461cde593`。
- 一般 [PR #259](https://github.com/Pcc329/solution-finder/pull/259)：OPEN、非 Draft，不 merge。
- 本次附件與下載資料夾的 `codex_規格書範本_v2.md` v2.1 已核對；repo 本身無 `sop/` 目錄。
- 使用者另已確認 SYNC 可作為第 4 個檔案，並在原 migration COMMIT 後要求新增 append-only migration 作為第 5 檔。產品程式及既有 migration 不再變更，無新增套件宣告。
- 正式 Supabase migration 由 PPC 執行；Codex 未執行正式 migration，亦未讀取或輸出 LOG_HASH_SALT。

## 改動清單與位置

| 檔案 | 函式／內容 | 位置 |
|---|---|---|
| `api/company-detail.js` | `hashForLog`：Node crypto HMAC-SHA256，無 salt 回 null | 60–63 |
| `api/company-detail.js` | `buildAccessLogRow`：有效 session 優先；過濾後 contacts 計算筆數與存在旗標；無 salt 一行安全錯誤 | 65–80 |
| `api/company-detail.js` | `handler`：既有 payload 保存為 responseBody，await insertSupabase 並隔離任何紀錄錯誤 | 149、178–183 |
| `migrations/20261019_contact_access_logs.sql` | 新表、9 欄中文 COMMENT、4 索引、RLS／REVOKE／service_role 權限；search_logs 三個 nullable 欄與 1 索引；自檢、驗證、回滾、180 天清理註解 | 全檔 |
| `migrations/20261019b_contact_access_logs_append_only.sql` | 收回 service_role 的 UPDATE、DELETE、TRUNCATE、TRIGGER、REFERENCES；直接及有效權限皆須恰為 INSERT、SELECT；附獨立驗證與回滾 | 全檔 |
| `tests/contact-access-log.test.mjs` | mock fetch 的七項測試，與 main 原始 handler 做完整 JSON 比對 | 全檔 |
| `_handover/CODEX_SYNC_access_log_2026-10-19.md` | 本交接紀錄 | 全檔 |

API 寫入順序：

```js
await insertSupabase('contact_access_logs', buildAccessLogRow(req, companyId, responseBody.contacts, clientIp));
// 上述位於獨立 try/catch，任何失敗保留既有狀態碼與 JSON。
return res.status(200).json(responseBody);
```

## 本機測試

- `node --test tests/contact-access-log.test.mjs`：7/7 PASS。
- `node --test tests/*.test.mjs`：125/125 PASS（含本次 7 項；既有根層測試 118 項）。
- `node --test tests/sf-mcp/sf-mcp-v1-2.test.mjs`：33/33 PASS。
- 合計 158/158 PASS。MCP 測試先以既有 lockfile 執行 `npm ci --ignore-scripts --no-audit --no-fund` 還原既有相依，未改 package.json／lockfile。
- `node --check api/company-detail.js`、`git diff --check`：PASS。
- Node 僅有既有 ESM package type 與 stripTypeScriptTypes 實驗功能提示，沒有測試失敗。

| 規格測試 | 結果 |
|---|---|
| 1. 成功 200 恰好 1 次 POST、service_role headers、欄位及型別完整 | PASS；也驗證 POST 完成後才回應，空 contacts 與全被過濾時旗標為 false |
| 2. body 不含原始 IP／session | PASS；同時檢查 email、mobile 未進入紀錄 |
| 3. 相同 IP 與 salt 相同雜湊，不同 salt 不同 | PASS；也檢查 forwarded 第一個 IP 與 socket fallback |
| 4. 未設定／空 salt → 兩 hash null，仍 200 | PASS；只記一行 code=missing_hash_salt，完整 payload 與 main 相同 |
| 5. POST 500、表不存在 42P01、fetch throw | PASS；仍 200，完整 payload 與 main 相同，僅一行不含內容的錯誤 |
| 6. 404／401／429 不寫入 | PASS；另涵蓋 400、讀取／設定 500、OPTIONS、405；第 31 次保留既有 429 |
| 7. api_key → session_hash=null | PASS；兩種認證皆有效時 session 優先 |

## migration 本機 PostgreSQL 16 模擬

使用本次新建的隔離 cluster、兩個專用測試資料庫與三角色；僅 loopback 連線，結束已關閉伺服器。最小 search_logs 與 20261012 既有欄定義相同，預置 1 筆 synthetic 歷史搜尋。設定新表預設 ALL 授權予 anon／authenticated／service_role，重現 Supabase 預設授權，驗證明確 REVOKE 有效。

失敗案例在 **REVOKE 之後、DO 自檢之前** 注入 `GRANT SELECT ... TO anon`。若只在 migration 前 GRANT，會被正式 REVOKE 清掉，無法證明自檢能攔截錯誤。注入只作用於本機測試輸入，未修改交付 migration。

### 第一次：原檔成功、獨立驗證與 service_role 寫入探針

```text
BEGIN
CREATE TABLE
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
ALTER TABLE
REVOKE
GRANT
ALTER TABLE
COMMENT
COMMENT
COMMENT
CREATE INDEX
DO
COMMIT
       relname       | rls | public_grants |                 service_role_privileges                 | policies 
---------------------+-----+---------------+---------------------------------------------------------+----------
 contact_access_logs | t   |             0 | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE |        0
(1 row)

     table_name      |  column_name  |        data_type         
---------------------+---------------+--------------------------
 contact_access_logs | id            | bigint
 contact_access_logs | created_at    | timestamp with time zone
 contact_access_logs | company_id    | text
 contact_access_logs | contact_count | smallint
 contact_access_logs | has_email     | boolean
 contact_access_logs | has_mobile    | boolean
 contact_access_logs | auth_method   | text
 contact_access_logs | session_hash  | text
 contact_access_logs | ip_hash       | text
 search_logs         | input_type    | text
 search_logs         | match_type    | text
 search_logs         | result_count  | integer
(12 rows)

      tablename      |                 indexname                  |                                                             indexdef                                                              
---------------------+--------------------------------------------+-----------------------------------------------------------------------------------------------------------------------------------
 contact_access_logs | contact_access_logs_company_created_at_idx | CREATE INDEX contact_access_logs_company_created_at_idx ON public.contact_access_logs USING btree (company_id, created_at DESC)
 contact_access_logs | contact_access_logs_created_at_idx         | CREATE INDEX contact_access_logs_created_at_idx ON public.contact_access_logs USING btree (created_at DESC)
 contact_access_logs | contact_access_logs_ip_created_at_idx      | CREATE INDEX contact_access_logs_ip_created_at_idx ON public.contact_access_logs USING btree (ip_hash, created_at DESC)
 contact_access_logs | contact_access_logs_session_created_at_idx | CREATE INDEX contact_access_logs_session_created_at_idx ON public.contact_access_logs USING btree (session_hash, created_at DESC)
 search_logs         | search_logs_log_type_created_at_idx        | CREATE INDEX search_logs_log_type_created_at_idx ON public.search_logs USING btree (log_type, created_at DESC)
(5 rows)

 input_type | match_type | result_count |       search_query        
------------+------------+--------------+---------------------------
            |            |              | synthetic-existing-search
(1 row)

BEGIN
SET
INSERT 0 1
ROLLBACK
 contact_rows_after_probe 
--------------------------
                        0
(1 row)


```
### 第二次：故意授權給 anon，自檢失敗且整筆回滾

```text
BEGIN
CREATE TABLE
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
ALTER TABLE
REVOKE
GRANT
ALTER TABLE
COMMENT
COMMENT
COMMENT
CREATE INDEX
GRANT
ROLLBACK
ERROR:  自檢失敗：表 1/1、RLS 1/1、公開角色授權 1（應0）、service_role INSERT 1/1、policy 0（應0）、搜尋欄位 3/3、索引 5/5
CONTEXT:  PL/pgSQL function inline_code_block line 29 at RAISE
 contact_table_absent | new_columns | new_indexes | existing_rows 
----------------------+-------------+-------------+---------------
 t                    |           0 |           0 |             1
(1 row)


```
### 第三次：直接執行檔尾回滾 SQL

```text
BEGIN
DROP TABLE
ALTER TABLE
DROP INDEX
COMMIT
 contact_table_absent | new_columns | new_indexes | existing_rows 
----------------------+-------------+-------------+---------------
 t                    |           0 |           0 |             1
(1 row)


```

結果：兩種回滾後表不存在、新欄 0、新索引 0，原有搜尋資料仍為 1 筆。service_role 寫入探針也在獨立交易 ROLLBACK，正常資料庫在執行檔尾回滾前存取紀錄為 0 筆。

## 四之二：真實 Preview 反向測試

- Preview：https://solution-finder-hhrssq8wy-patrick0814-6136s-projects.vercel.app/
- 固定分支 Preview：https://solution-finder-git-feat-cont-677095-patrick0814-6136s-projects.vercel.app/
- 部署：https://vercel.com/patrick0814-6136s-projects/solution-finder/84GXEBivpAfebHL2PaKGGGPGtXEx
- 部署 commit：`7519a55`，2026-10-19 12:22:59（Asia/Taipei）Ready，GitHub Vercel status success。
- 驗證時間：2026-10-19 12:42:21–12:42:24（Asia/Taipei）。資料來源為真實 Preview 與對應 Vercel request log，無 mock。
- 使用者自行登入後，搜尋順立、開啟 SOL-0852「Cyberbiz 電商一站式開店系統｜專業版」（前端 ID `recSJDpPgvmokqngm`），展開聯絡資訊。
- Vercel 確認 `GET /api/company-detail`、Search Params `company_id=54688786`，HTTP **200**。該次恰好 1 次 `POST /rest/v1/contact_access_logs`；新表尚不存在，未建立紀錄。
- UI 聯絡人、公司電話（含分機）、Email 正常顯示；手機仍為「暫無資訊」，無錯誤訊息。未將真實聯絡值放入本文件。
- 該次僅 1 行寫入錯誤，內容如下（另外 1 行為冷啟動時 Node 既有 `DEP0169 url.parse()` 棄用提示，非紀錄寫入錯誤）：

```text
[Supabase Error] status=404 table=contact_access_logs code=PGRST205 time=2026-10-19T04:42:24.891Z
```

- `PGRST205` 為 PostgREST 回報表不存在；API 仍成功回傳聯絡資料，符合四之二。沒有 `missing_hash_salt`，未讀取或輸出 salt。
- Request ID：`5nwr9-1792384941838-669590f7bf55`。
- [該次 Vercel 請求紀錄](https://vercel.com/patrick0814-6136s-projects/solution-finder/84GXEBivpAfebHL2PaKGGGPGtXEx/logs?selectedLogId=5nwr9-1792384941838-669590f7bf55)。此證據來自 Vercel，不是 Chrome Network 面板。
- 反向測試通過後已通知 PPC 執行原 migration；PPC 已回報 COMMIT 與獨立驗證符合預期。發現 Supabase 預設 ALL 後，依使用者要求先補 append-only migration，待 PPC 執行後才進行第三段真實寫入驗收。

## 第三段：PPC 執行 migration 後的真實驗收

| 驗收項目 | 狀態 |
|---|---|
| 原 migration 獨立 SQL：RLS=true／公開授權 0／policy 0／欄位 12 列／索引 5 列 | PASS；PPC 回報後，Codex 已於 SQL Editor 以只讀 SELECT 直接查核 |
| append-only migration：service_role_privileges 恰為 INSERT,SELECT | PASS；PPC 回報 COMMIT、七種有效權限僅 INSERT／SELECT 為 true；Codex 再查直接授權確為 INSERT,SELECT |
| SOL-0852：新增 1 筆、contact_count>=1、session、兩 hash 64 字元十六進位 | PASS；0→1，id=1，contact_count=1，兩 hash 長度 64、hex 檢查 true |
| 同家收合再展開不新增；另一家展開新增 1 筆 | PASS；快取重開維持 1 筆；卓碼 42714922 展開後 1→2 |
| manufacturing 公司面板新增 1 筆 | PASS；塔台智能 54931699 公司介紹面板開啟後 2→3，contact_count=2 |
| 登出 401 不新增 | PASS；PPC 登出 200 後開啟未快取盛網 91013840，Vercel 401、No outgoing requests，SQL 重查仍為 3 筆 |
| anon REST 讀取 401／403 或空陣列 | PASS；Codex 直接以公開 anon key 發出 REST GET，HTTP 401、42501 permission denied，未讀到紀錄 |
| 聯絡資訊卡抽查 2 家，顯示與既有一致 | PASS；順立有效公司電話含分機與 Email 正常；卓碼公司電話／手機仍為暫無資訊，Email 正常 |

## 五之二：欄位存在性與 select 比對

- [x] company-detail.js 的三個 select 字串與 `4d47b89` 完全相同；diff 沒有修改 select 的增刪行。相關 diff 上下文：

```diff
     const [contacts, awards] = await Promise.all([
       fetchSupabase('contacts', 'contact_name,title,office_phone,email,mobile'),
       fetchSupabase('awards', 'award_name,award_level,host_org,award_year,match_method'),
     ]);

-    return res.status(200).json({
+    const responseBody = {
```

公司 select 維持：`company_id,company_name,logo_url,ceo_name,capital,established_date,website,company_intro,employee_range,company_type`。

- [x] 正式 SQL 12 列逐欄原始輸出：Codex 已在 SQL Editor 直接以只讀 SELECT 查詢，結果見下方「第三段真實驗收證據」。上方 migration 模擬的逐欄輸出仍僅為本機資料。

## 五之三：驗證方式聲明（僅勾選一項）

- [x] 已在真實 Preview 環境驗證，證據見第三、五之二段。
- [ ] 僅完成 mock／本機驗證，尚未真實環境驗證。

本 PR 已完成規格各項驗收；兩份正式 migration 皆由 PPC 執行，Codex 僅執行只讀查核及正常 Preview 操作。依使用者要求維持一般 PR open、非 Draft，不 merge。

## 追加修正：service_role append-only 權限

PPC 已執行原 migration 並回報正式結果：RLS=true、public_grants=0、policies=0、欄位 12 列、索引 5 列。然而 Supabase 預設 ALL 使 service_role 保有 DELETE、REFERENCES、TRIGGER、TRUNCATE、UPDATE；單純 GRANT SELECT, INSERT 不會撤銷這些既有權限。依使用者要求新增後續 migration，不修改已執行的原檔。

- 新檔：`migrations/20261019b_contact_access_logs_append_only.sql`。
- 單一 BEGIN／COMMIT；撤銷 UPDATE、DELETE、TRUNCATE、TRIGGER、REFERENCES。
- DO 自檢要求直接授權與有效表權限皆恰為 INSERT、SELECT，並檢查不得殘留欄位 UPDATE／REFERENCES 權限；不符即整筆回滾。
- 檔尾獨立驗證預期 `service_role_privileges = INSERT,SELECT`，且七種有效表權限只有 INSERT、SELECT 為 true。
- 回滾 SQL 僅恢復本次撤銷的五種權限，不刪資料；會重新放開修改／刪除，僅供 PPC 必要時手動執行。
- 原檔 180 天清理 SQL 之後須由 PPC 以管理者身分執行，service_role 不再能 DELETE。

### insertSupabase 不需要 UPDATE 的證據

`_lib/supabase-insert.js:14–24` 使用一般 `POST /rest/v1/${table}`、`Prefer: return=minimal` 與 JSON row。endpoint 未設定任何 query parameters；沒有 upsert、on_conflict 或 resolution=merge-duplicates。`api/company-detail.js:178` 直接呼叫該 helper，故寫入不需要 UPDATE 權限；helper 與 API 程式於此次追加修正均未改動。

除靜態確認外，本機以 `SET ROLE service_role` 在僅有 INSERT、SELECT 的狀態實際執行 INSERT（identity 自動產生）成功，再 SELECT 得到 1 筆；UPDATE、DELETE、TRUNCATE 都得到 SQLSTATE 42501，既有測試列內容保持原樣。

### 本機 PostgreSQL 16 輸出

使用既有隔離 cluster，新建本次專用測試資料庫。先設定預設 ALL，再執行原 migration 重現 PPC 狀態，接續執行新 migration。另驗證檔尾回滾、在 REVOKE 後注入 UPDATE 可被自檢攔下並整筆回滾，最後重套新 migration 成功。全程僅本機 loopback，結束已關閉伺服器；未操作正式 Supabase。

```text
BEFORE: inherited Supabase-style default ALL
                 service_role_privileges
---------------------------------------------------------
 DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
(1 row)

 privilege  | allowed
------------+---------
 DELETE     | t
 INSERT     | t
 REFERENCES | t
 SELECT     | t
 TRIGGER    | t
 TRUNCATE   | t
 UPDATE     | t
(7 rows)


MIGRATION AND INDEPENDENT VERIFICATION
BEGIN
REVOKE
DO
COMMIT
 service_role_privileges
-------------------------
 INSERT,SELECT
(1 row)

 privilege  | allowed
------------+---------
 DELETE     | f
 INSERT     | t
 REFERENCES | f
 SELECT     | t
 TRIGGER    | f
 TRUNCATE   | f
 UPDATE     | f
(7 rows)


ACTUAL INSERT AND SELECT AS service_role (no UPDATE permission)
SET
INSERT 0 1
 inserted_rows
---------------
             1
(1 row)

RESET

REJECTED UPDATE
SET
ERROR:  42501: permission denied for table contact_access_logs
LOCATION:  aclcheck_error, aclchk.c:2814

REJECTED DELETE
SET
ERROR:  42501: permission denied for table contact_access_logs
LOCATION:  aclcheck_error, aclchk.c:2814

REJECTED TRUNCATE
SET
ERROR:  42501: permission denied for table contact_access_logs
LOCATION:  aclcheck_error, aclchk.c:2814

DATA PRESERVED
          company_id           | contact_count
-------------------------------+---------------
 synthetic-append-only-company |             0
(1 row)


FOOTER ROLLBACK RESTORES PRIOR ALL
BEGIN
GRANT
COMMIT
                       string_agg
---------------------------------------------------------
 DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
(1 row)


INJECT UPDATE AFTER REVOKE: SELF-CHECK ROLLBACK
BEGIN
REVOKE
GRANT
ROLLBACK
ERROR:  自檢失敗：service_role 授權 {INSERT,SELECT,UPDATE}、有效表權限 {INSERT,SELECT,UPDATE}（皆應僅為 INSERT,SELECT），且不得有欄位 UPDATE／REFERENCES 權限
CONTEXT:  PL/pgSQL function inline_code_block line 20 at RAISE
                       string_agg
---------------------------------------------------------
 DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
(1 row)


REAPPLY ORIGINAL APPEND-ONLY MIGRATION
BEGIN
REVOKE
DO
COMMIT
 service_role_privileges
-------------------------
 INSERT,SELECT
(1 row)

 privilege  | allowed
------------+---------
 DELETE     | f
 INSERT     | t
 REFERENCES | f
 SELECT     | t
 TRIGGER    | f
 TRUNCATE   | f
 UPDATE     | f
(7 rows)


```

### PPC 執行狀態

PPC 已回報新增的 `20261019b_contact_access_logs_append_only.sql` COMMIT，獨立驗證 service_role_privileges = INSERT,SELECT；七種有效權限僅 INSERT、SELECT 為 true，其餘五項皆 false。第三段已依此結果接續執行，未重跑原 migration、未執行正式回滾或清理 SQL。

補充檢查：追加修正後重跑 contact-access-log 七項測試 7/7 PASS；git diff --check PASS。此次只新增 append-only migration 並更新本 SYNC。

## 第三段真實驗收證據（2026-10-19，Asia/Taipei）

### 來源與範圍

- 使用上方同一個固定部署 Preview `solution-finder-hhrssq8wy-...`；API 程式與目前 PR head 完全相同，`git diff 7519a55 -- api/company-detail.js` 為空。後續 commit 僅追加 migration 與交接文件。
- 頁面使用者登入工作階段；Codex 未取得或輸出 cookie、密碼、salt。
- 真實紀錄與 schema／權限查核透過 Supabase SQL Editor 的獨立驗收查詢，只執行 SELECT；各次 SQL 與輸出記錄於本文件。[已保存的筆數複查 snippet](https://supabase.com/dashboard/project/apdbvjruevjprslhhvlx/sql/4756c089-3d10-4890-8683-85df8a71f86a) 可供後續重查。兩份正式 migration 都是 PPC 執行。
- 初始資料：2026-10-19 14:19:30.939，`total_rows=0`、`max_id=NULL`。Preview 載入方案總數 2,268。

### 真實紀錄與快取

| 操作 | 前→後筆數 | 結果 |
|---|---|---|
| 重新整理 Preview 清除前端快取，搜尋順立並展開 SOL-0852 | 0→1 | id=1，company_id=54688786，contact_count=1 |
| 同家收合再展開 | 1→1 | SQL 重查仍只有 id=1；快取命中，無新增紀錄 |
| 搜尋卓碼、展開「VPosAPP 線上商圈系統」聯絡資訊 | 1→2 | id=2，company_id=42714922，contact_count=1 |
| manufacturing：選金屬加工／10–50人／剛起步／生產排程／30萬以下；產生推薦，展開 SARA 入門版並點公司介紹 | 2→3 | id=3，company_id=54931699（塔台智能），contact_count=2 |

資料庫實際 SELECT 結果（created_at 轉為台北時間，雜湊僅保留前 8 碼）：

| id | company_id | contact_count | has_email | has_mobile | auth_method | ip_len | sess_len | ip_hex | sess_hex | ip_prefix | sess_prefix | created_at（UTC+8） |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 54688786 | 1 | true | false | session | 64 | 64 | true | true | c4e7101c | 08d316ed | 2026-10-19 14:20:13.843145 |
| 2 | 42714922 | 1 | true | false | session | 64 | 64 | true | true | c4e7101c | 08d316ed | 2026-10-19 14:21:40.039378 |
| 3 | 54931699 | 2 | true | true | session | 64 | 64 | true | true | c4e7101c | 08d316ed | 2026-10-19 14:22:56.331649 |

使用的只讀 SQL：

```sql
SELECT id, company_id, contact_count, has_email, has_mobile, auth_method,
       length(ip_hash) AS ip_len, length(session_hash) AS sess_len,
       ip_hash ~ '^[0-9a-f]{64}$' AS ip_hex,
       session_hash ~ '^[0-9a-f]{64}$' AS sess_hex,
       left(ip_hash,8) AS ip_prefix, left(session_hash,8) AS sess_prefix,
       created_at, count(*) OVER () AS total_rows
FROM public.contact_access_logs ORDER BY id DESC LIMIT 10;
```

Vercel 真實請求紀錄（台北時間；均為 GET /api/company-detail，HTTP 200）：

| 公司 | 請求時間 | HTTP |
|---|---|---|
| 順立 54688786 | 14:20:11.63 | 200 |
| 卓碼 42714922 | 14:21:38.34 | 200 |
| 塔台 54931699 | 14:22:54.71 | 200 |

三次請求未出現 Supabase 寫入錯誤；第一筆僅有 Node 既有 DEP0169 棄用提示。此為 Vercel request logs，不冒稱 Chrome Network 證據。

### 聯絡卡抽查

- 順立：聯絡人、有效公司電話與分機、Email、稅籍主業正常顯示；手機為「暫無資訊」。與反向測試及 PR #257／#258 行為一致。
- 卓碼：聯絡人、Email、稅籍主業正常；來源遮罩公司電話與手機仍為「暫無資訊」，無電話連結。無前端變更。
- manufacturing：塔台公司基本資料、公司介紹、聯絡窗口正常載入，兩筆聯絡人使 contact_count=2。

### 正式欄位與權限查核

Codex 直接在正式 SQL Editor 執行規格五之二 SELECT，12 列輸出：

```text
table_name          column_name    data_type
contact_access_logs id             bigint
contact_access_logs created_at     timestamp with time zone
contact_access_logs company_id     text
contact_access_logs contact_count  smallint
contact_access_logs has_email      boolean
contact_access_logs has_mobile     boolean
contact_access_logs auth_method    text
contact_access_logs session_hash   text
contact_access_logs ip_hash        text
search_logs         input_type     text
search_logs         match_type     text
search_logs         result_count   integer
(12 rows)
```

2026-10-19 14:23:30.984504 再查正式 RLS／授權／policy／索引：

```text
rls  public_grants policies service_role_privileges new_indexes
true 0             0        INSERT,SELECT            5
(1 row)
```

### 登出 401 與 anon REST：最終驗收

登出操作由 PPC 完成；因該 Preview 分頁自動點擊連續逾時，未快取公司面板的點擊亦由 PPC 操作。Codex 直接讀取 UI、Vercel 紀錄與正式 SQL 結果核對：

- 14:25:41.84：`POST /api/logout` → HTTP 200。
- 14:35:54.17：在同一 manufacturing 頁選盛網科技「AI 循環碳永續價值鏈與善良管理人雲管家」並點公司介紹，`GET /api/company-detail?company_id=91013840` → HTTP 401。
- UI 顯示「暫無公司資料」，沒有呈現該公司的聯絡內容。
- Vercel 該次請求明確顯示 **No outgoing requests**，沒有觸發任何 Supabase 讀寫。
- Request ID：`9lfpd-1792391754173-2ee4a958bc70`；[該次 401 請求紀錄](https://vercel.com/patrick0814-6136s-projects/solution-finder/84GXEBivpAfebHL2PaKGGGPGtXEx/logs?selectedLogId=9lfpd-1792391754173-2ee4a958bc70)。
- 14:36:15.745516：只讀 SQL 再查，仍為 total_rows=3、max_id=3。故登出後 401 無新增紀錄，PASS。

```text
total_rows max_id checked_at（UTC）
3          3      2026-10-19 06:36:15.745516+00
(1 row)
```

anon REST 初次由 PPC 在 Preview Console 嘗試時，被 Preview 的 connect-src CSP 阻擋，未送達 Supabase；該次不列為成功證據，也未修改或停用 CSP。之後 Codex 透過已登入的 Supabase 設定頁取得標示為 public 的 anon key（未讀取 service_role key），直接以 PowerShell 發送真實唯讀 GET：

```text
時間：2026-10-19 14:34:56.5099906（Asia/Taipei）
GET https://apdbvjruevjprslhhvlx.supabase.co/rest/v1/contact_access_logs?select=id&limit=1
身分：anon（apikey 與 Bearer headers 使用同一個公開 anon key；key 不記錄於此）
HTTP：401
body.code：42501
body.message：permission denied for table contact_access_logs
body.details：null
```

Supabase 已收到並拒絕實際 anon 查詢，回應沒有紀錄資料。錯誤內的 GRANT 提示僅為資料，未執行；未開放公開角色權限。anon 讀取拒絕驗收 PASS。

第三段最終筆數為 3，所有驗收項目皆 PASS。保留測試產生的三筆真實存取紀錄，未執行刪除、正式 migration、回滾或清理 SQL。PR 維持 open、非 Draft，未 merge。

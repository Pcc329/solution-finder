# CODEX SYNC — 聯絡資訊存取紀錄與搜尋紀錄欄位（2026-10-19）

## 交付與基準

- Repo：https://github.com/Pcc329/solution-finder
- 已 `git pull --ff-only origin main`，實際基準：`4d47b897f9dfc13f9315dcd12f8802c69332f09c`，與指定基準相同。
- Branch：`feat/contact-access-log`。程式 commit：`7519a55138d3391d0dc34cd0f0262de461cde593`。
- 一般 [PR #259](https://github.com/Pcc329/solution-finder/pull/259)：OPEN、非 Draft，不 merge。
- 本次附件與下載資料夾的 `codex_規格書範本_v2.md` v2.1 已核對；repo 本身無 `sop/` 目錄。
- 使用者另已確認 SYNC 可作為第 4 個檔案。產品變更只有下列三檔，無新增套件宣告。
- 正式 Supabase migration 由 PPC 執行；Codex 未執行正式 migration，亦未讀取或輸出 LOG_HASH_SALT。

## 改動清單與位置

| 檔案 | 函式／內容 | 位置 |
|---|---|---|
| `api/company-detail.js` | `hashForLog`：Node crypto HMAC-SHA256，無 salt 回 null | 60–63 |
| `api/company-detail.js` | `buildAccessLogRow`：有效 session 優先；過濾後 contacts 計算筆數與存在旗標；無 salt 一行安全錯誤 | 65–80 |
| `api/company-detail.js` | `handler`：既有 payload 保存為 responseBody，await insertSupabase 並隔離任何紀錄錯誤 | 149、178–183 |
| `migrations/20261019_contact_access_logs.sql` | 新表、9 欄中文 COMMENT、4 索引、RLS／REVOKE／service_role 權限；search_logs 三個 nullable 欄與 1 索引；自檢、驗證、回滾、180 天清理註解 | 全檔 |
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
- 驗證時間／查詢紀錄筆數：等待使用者在新 Preview 自行登入後驗證；尚未取得存取表筆數。
- 表不存在時展開 SOL-0852／公司 `54688786`：待 Preview 驗證。
- API 200、前台正常、Vercel 只有一行安全寫入錯誤碼：待 Preview 驗證。
- 尚未通知 PPC 執行 migration；須先完成上述反向測試。

## 第三段：PPC 執行 migration 後的真實驗收

| 驗收項目 | 狀態 |
|---|---|
| 獨立 SQL：RLS=true／公開授權 0／policy 0／service_role INSERT／search_logs 三欄 | 待 PPC |
| SOL-0852：新增 1 筆、contact_count>=1、session、兩 hash 64 字元十六進位 | 待 PPC |
| 同家收合再展開不新增；另一家展開新增 1 筆 | 待 PPC |
| manufacturing 公司面板新增 1 筆 | 待 PPC |
| 登出 401 不新增 | 待 PPC |
| anon REST 讀取 401／403 或空陣列 | 待 PPC |
| 聯絡資訊卡抽查 2 家，顯示與既有一致 | 待 Preview／PPC |

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

- [ ] PPC 執行 migration 後，正式 SQL 12 列欄位驗證輸出：待 PPC。上方 12 列僅為本機 PostgreSQL 輸出，不代表正式 schema。

## 五之三：驗證方式聲明（僅勾選一項）

- [ ] 已在真實 Preview 環境驗證，證據見第三、五之二段。
- [x] 僅完成 mock／本機驗證，尚未真實環境驗證。

本 PR 尚未完成驗收；接續安排真實 Preview 驗證及 PPC migration，維持 open，不 merge。

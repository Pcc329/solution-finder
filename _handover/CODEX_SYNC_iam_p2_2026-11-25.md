# SYNC｜IAM P2 個人帳號登入、停權與計量｜2026-11-25

## 交付

- Repo：`Pcc329/solution-finder`；工作目錄：`C:\Users\S25036\Documents\Codex\repos\solution-finder`。未另建 clone。
- 依使用者要求先執行 `git fetch origin`；核對 `origin/main = 2675eb5498271a65ae6e597ecbb4d2b07e28e589`（PR #318）後才建立分支。
- 分支：`feat/iam-p2-personal-login-2026-11-25`。
- PR：[PR #319](https://github.com/Pcc329/solution-finder/pull/319)，base `main`，狀態 open、未 merge，未啟用 auto-merge。Preview 實測由 PPC 依規格六執行，本次未連線正式 Supabase、Vercel 或 Anthropic。
- 分支實作、測試與證據 commit SHA：`8e491c9092dcb04374913d2df6e16e91028e88ab`。本次補記 PR 連結為後續文件 commit；最終分支 HEAD 以 [PR commits](https://github.com/Pcc329/solution-finder/pull/319/commits) 與交付回覆所列 SHA 為準（文件不能自我包含自身 commit SHA）。

## 本次行為

- 個人登入使用 Supabase password grant，僅簽發含 user UUID 的 HMAC v2 cookie；不回傳或儲存 Supabase access/refresh token。cookie 保持 7 天及原有 HttpOnly、Secure、SameSite=Lax、Path=/ 屬性。
- `requireAuth` 改為 async；以 service role 讀取角色及啟用狀態，失敗回 503 並且不快取失敗；停權／查無帳號回 401 並清 cookie。首次登入旗標在一般 API 回 403，只允許 session-check 與改密碼 action 通過。
- `SHARED_PASSWORD_ENABLED` 預設關閉，只有字串 `true` 啟用；舊 v1 cookie 簽章格式保留，API key 保留。
- 個人登入、改密碼閘門與固定使用紀錄告知已加入；共用登入入口只在 session-check 明確回 `shared_login_enabled: true` 時出現。一般業務 API 的 `403 must_change_password` 不新增攔截；重新整理後由閘門接手（規格 4.7）。
- 密碼以 Unicode code point 檢查至少 8 字、UTF-8 最多 72 bytes，檢查與舊密碼不同、不能含 email 帳號（3 字以上）及 24 項常見密碼黑名單。
- 4 個 AI 端點在 Anthropic 回應後各寫一列 usage（含非 2xx；網路例外不寫），聯絡資訊成功回應前寫一列 contact_view。寫入失敗不影響既有狀態碼及完整內容。
- usage 只含 user_id、auth_method、action、允許的 detail 欄位與 IP HMAC；時間由資料表 created_at 預設值產生。聯絡存取紀錄保留既有 HMAC 演算法，增加 user_id，user/shared 均映射為資料庫既有 session 值。

## 使用者明確補正

1. 靜態守門掃描所有 `api/` 與 `_lib/` 的呼叫（排除 `_lib/auth.js` 定義）：業務 10 處、`api/auth.js` 2 處，合計 12 處；每一處必須 await，否則列檔案及行號。此為使用者確認的規格 5.2 補正。
2. login 與 change-password 的 Supabase password grant：400 及其他非 2xx 回 401 並累計失敗；429 或 5xx 回 503「登入服務暫時無法使用，請稍後再試」，不累計帳號失敗；網路錯誤同樣回 503。兩個動作各測試 429、500、503 連續六次都回 503，之後正確 grant 仍成功，證明未被鎖定。

## 修改檔案與用途

| 檔案 | 用途 |
| --- | --- |
| `_lib/auth.js` | v1/v2 簽章、async 身分驗證、角色快取與清理、共享開關 |
| `_lib/password-policy.js`（新增） | 字數／byte 限制、相同密碼、帳號名稱及黑名單 |
| `_lib/usage.js`（新增） | detail 白名單、IP HMAC、安全計量寫入 |
| `api/auth.js` | 個人／共享登入、改密碼、session-check、分開限流；保留 logout |
| `public/auth-gate.js` | 個人登入、改密碼、共用入口、告知及錯誤顯示 |
| `vercel.json` | 只新增 `/api/change-password` rewrite |
| `api/company-detail.js` | await 驗證、user_id、contact_view 計量 |
| `api/manufacturing-analyze.js`、`api/manufacturing-recommend.js` | await 驗證與 Anthropic 回應後計量 |
| `api/companies.js`、`api/cases.js`、`api/feedback.js`、`_lib/company-search.js` | 各只改 requireAuth 那一行為 await |
| `api/solutions.js` | 只改 requireAuth 那一行為 await |
| `api/claude.js`、`api/ask.js` | 各只新增 usage import、改 await 驗證、回應後新增一行計量 |
| `tests/iam-p2.test.mjs`（新增） | 身分、快取、停權、限流、密碼、五端點計量、await 與禁區守門 |
| `tests/iam-p2-gate.test.mjs`（新增） | VM 閘門顯示、表單切換、密碼確認、告知及錯誤處理 |
| `tests/fixtures/iam-v1-auth.mjs`（新增） | 精確凍結 main 2675eb5 的同步 auth，供歷史業務等價測試 |
| `tests/company-search.test.mjs`、`tests/contact-access-log.test.mjs`、`tests/airtable-write-migration.test.mjs`、`tests/supabase-read-equivalence.test.mjs` | 規格 5.3 的契約更新，詳下一表 |
| `_handover/evidence/iam-p2-2026-11-25/` | 完整 TAP log、換行／空白整理證據與驗證 manifest |
| 本 SYNC | 交付、測試更新對照、禁區完整 diff、限制與後續操作 |

`api/stats.js`、8 個頁面的 auth-gate script 標籤、平台盤點／DASH_PASSWORD、supabase/functions、migrations 皆無修改；API 檔案維持 12 個。

## 規格 5.3：既有測試更新對照

| 測試名稱／範圍 | 原斷言／fixture | 新斷言／fixture | 對應規格 |
| --- | --- | --- | --- |
| company-search #12 | session 使用 v1；所有 fetch read 都須 anon | session 改 v2＋mock user_roles；業務 reads 仍全部 anon，另精確斷言 1 次 role read 使用 service role | 4.1、4.2、5.3 第一項 |
| company-search #14 | 歷史 companies 原始碼 import 新 auth | 歷史碼注入凍結同步 auth，當前碼使用新版；完整業務 body、headers、requests、logs 比對不變 | 5.3 第三項 |
| supabase-read-equivalence 全部歷史比較（含 solutions/cases/companies 驗證測試） | 舊版同步 handler import 當前 auth | 歷史碼注入凍結同步 auth；401 與所有驗證後業務輸出、請求比對維持原斷言 | 5.3 第三項 |
| contact-access-log 全部共用 fixture／歷史 baseline | 預設 v1；歷史碼 import 當前 auth | 預設 v2＋mock user_roles；歷史 baseline 使用 v1＋凍結同步 auth，完整 payload 等價比對不變 | 4.1、4.2、5.3 第一／三項 |
| contact-access-log #1 | 成功恰好 1 次 contact POST，欄位無 user_id | 仍恰好 1 次 contact POST，新增 user_id；另恰好 1 次 usage POST，精確驗證身份／action／detail／HMAC，原 typed fields 及 payload 比對保留 | 4.8、4.9、5.3 第二項 |
| contact-access-log #2～#5 | 僅檢視單一 contact 寫入、原 HMAC 與錯誤隔離 | contact 寫入依 table 精確識別，保留原 HMAC、隱私、錯誤格式與完整 payload 斷言；usage 由新增整合測試驗證 | 4.8、4.9、5.3 第二項 |
| contact-access-log #6 missingConfig | v1 session 通過驗證後，缺 service role 回 500 | 這一業務設定分支使用 api_key 通過驗證後仍回 500；v2 缺 service role 回 503 另由 IAM 測試覆蓋；其他原案例保留，額外斷言所有非成功分支無任何 POST／usage | 4.2 fail closed、5.3 第一項 |
| contact-access-log #7 | api_key 無 session_hash，session 優先 | 原斷言保留，session 改 v2，追加 api_key user_id 必須 null | 4.9、5.3 第一項 |
| contact-access-log #8（新增） | 無 | 明確開關 true 時 v1 可用；contact=session、usage=shared、兩者 user_id=null | 5.3 第一項保留 v1 案例 |
| airtable-write-migration ask/claude：success、400、500、429、network-error、invalid-json、unsafe-code | 全部 storage 呼叫只 1 次業務寫入 | 業務寫入仍 1 次，追加恰好 1 次 usage，精確驗證 action、方法、IP HMAC；總 storage 數為兩者之和；順序 Anthropic→usage→原業務寫入；原 payload／安全 log 斷言不變 | 4.8、5.3 第二項 |
| airtable-write-migration ask/claude：missing-url、missing-key | 原業務寫入失敗的安全 log 只有 1 筆 | 原 log 仍恰好 1 筆，另精確斷言 usage 設定缺漏 log 1 筆；兩類均驗證安全格式，HTTP/payload 不變 | 4.8、5.3 第二項 |
| airtable-write-migration ask absent search query | calls[1] 為 ask_logs，search_query='' | 以精確 table 找 ask_logs，search_query 仍為空字串；順序另有嚴格斷言 | 4.8、5.3 第二項 |

所有既有案例保留，沒有 skip、todo、刪除或放寬業務輸出比較。凍結 fixture 是 `git show 2675eb5:_lib/auth.js` 原文加一行來源註解；已獨立逐字驗證。

## 完整測試與證據

- 執行前先列出測試：`tests/` 下 `.test.mjs`／`.test.cjs` 及 `tests/sf-mcp/` 下 `.test.mjs`；命令為 `node --test --test-reporter=tap <明確列出的各檔案>`。最後 25 檔名清單在 `verification.json`。runtime 為 Node v24.14.1。
- 修改前（檔名沿用規格 red）：23 檔、483 tests、483 pass、0 fail、exit 0。實際無既有紅燈，不能偽稱失敗基準。
- 修改後：25 檔、617 tests、617 pass、0 fail、exit 0；增加 134 tests。兩次都 0 cancelled／skipped／todo。
- 另保留 `expected-contract-failures.tap.log`：程式變更後、既有測試更新前的四組測試共 137 項，106 pass／31 fail，逐項可歸因於上表預定契約變更。
- `iteration-tests.tap.log`：新增測試／既有測試更新後的開發驗證，260 項、246 pass／14 fail；14 項均為新加斷言引用 invoke 區域變數 env 的測試程式作用域錯誤；改為精確 synthetic URL 後最終完整測試全部通過。未為此改動任何業務程式或放寬斷言。
- 所有外部呼叫均 mock；僅使用 synthetic 站址、帳號、金鑰與內容，未呼叫正式服務、未讀取真實金鑰。
- 已用精確原文替換驗證禁區三檔及四個僅改 await 的檔案沒有額外差異；禁區守門測試通過，rewrite 精確只多一條，API 數量仍為 12。`git diff --check` 與 staged 內容、LF log blob 雜湊檢查均在提交前驗證。

### Log SHA-256（repo LF）

路徑共同前綴：`_handover/evidence/iam-p2-2026-11-25/`。

| Log | SHA-256（LF，repo blob） |
| --- | --- |
| `expected-contract-failures.tap.log` | `9eb9d4b9936e8b050fe1222261dcd51cee44abddc1baeb760fb8bfad30b0c8d2` |
| `green-tests.tap.log` | `16c74aacd17e14bad8dfede7461a44845e3fa6aafabf314caaba5cf022d96df1` |
| `iteration-tests.tap.log` | `63fca8ecf80b99aa3838f3e704fcd6ec3e0bcb0086e1705cebb1da934bc1021d` |
| `red-tests.tap.log` | `3e3d5d33eb3d39840aad632849593fc899f9d2ded81a40f88ccadc422d0585f9` |

計算方式：先以 Python 將執行輸出的 CRLF 正規化為 LF，再用 `hashlib.sha256` 對原始 bytes 計算。stage 後另以 `git show :<path>` 的 bytes 逐一驗證 blob 與上述 SHA 相符；commit 後以 `git show HEAD:<path>` 再驗證，避免 PowerShell 管線轉碼。red／green log 除換行正規化外不改內容。

為通過 whitespace 檢查，只有 expected-contract-failures log 的 58 個純空白行移除空格，保留空行及其餘完整內容。各 log 的原始 SHA、LF 整理前 SHA、精確行號與最終 SHA 均在 `verification.json`；iteration log 另移除第 740、741 行測試標題的各一個行尾空格（空字串開關案例）；記錄於 manifest 的 trailing_spaces_cleaned_lines。red／green 不需任何空白整理。

## 限流、快取與已改密碼但旗標未更新

- login 與 change-password 的 IP 計數、email 失敗計數分開。單 IP 每 60 秒最多 20 次，第 21 次 429；同 email 累計 5 次憑證失敗後鎖 15 分鐘，期間不發 password grant；成功清除該動作失敗紀錄；過期 Map 項目在請求時清理。
- 限流為模組層 Map，多個 Vercel 執行個體各自計數，非全域限制；快取亦各自獨立。使用者角色狀態每個執行個體最多快取 60 秒，逾期必須重新查詢，失敗不沿用舊資料。
- 改密碼成功後立即刪除當前使用者在本執行個體的角色快取；其他執行個體可能保留舊旗標最多 60 秒，若重整仍顯示改密碼請稍後再重整。
- PUT 成功但 PATCH 旗標失敗：回安全 502，明確告知「密碼已變更，但帳號狀態更新失敗」。不回滾密碼、不清除 must-change 限制。使用者以剛改好的密碼作為目前密碼，再選另一個合格新密碼重試；若持續失敗，由 super 先核實帳號再人工修復旗標。此任務未執行正式資料寫入。

## 後續驗收與上線

Claude review 禁區完整 diff；PPC 先完成 P3 建帳號與 Supabase 密碼最短 8 字設定，再依規格六於 Preview 驗證首次改密碼、usage、停權及恢復。全部確認後由 PPC 決定切換日 merge。merge 時共享密碼預設關閉，緊急開關需 `SHARED_PASSWORD_ENABLED=true` 並 redeploy。此任務不 merge、不操作部署。

除上述使用者確認的兩項規格補正，沒有自行加入規格外程式修改。

## 禁區三檔完整 diff（相對 2675eb5）

以下使用 `--unified=0` 保留全部變更行，省略未變動的上下文行。

```diff
diff --git a/api/ask.js b/api/ask.js
index 5da9805..a982db9 100644
--- a/api/ask.js
+++ b/api/ask.js
@@ -2,0 +3 @@ import { requireAuth } from '../_lib/auth.js';
+import { recordUsage } from '../_lib/usage.js';
@@ -16 +17 @@ export default async function handler(req, res) {
-  if (!requireAuth(req, res)) return;
+  const auth = await requireAuth(req, res); if (!auth) return;
@@ -110,0 +112 @@ export default async function handler(req, res) {
+    await recordUsage(req, auth, 'ai_ask', { endpoint: 'ask', ok: response.ok, status: response.status });
diff --git a/api/claude.js b/api/claude.js
index 30dbd0d..7021363 100644
--- a/api/claude.js
+++ b/api/claude.js
@@ -3,0 +4 @@ import { requireAuth } from '../_lib/auth.js';
+import { recordUsage } from '../_lib/usage.js';
@@ -12 +13 @@ export default async function handler(req, res) {
-  if (!requireAuth(req, res)) return;
+  const auth = await requireAuth(req, res); if (!auth) return;
@@ -100,0 +102 @@ export default async function handler(req, res) {
+    await recordUsage(req, auth, 'ai_search', { endpoint: 'claude', ok: response.ok, status: response.status });
diff --git a/api/solutions.js b/api/solutions.js
index 62a06e4..7b52d49 100644
--- a/api/solutions.js
+++ b/api/solutions.js
@@ -24 +24 @@ export default async function handler(req, res) {
-  if (!requireAuth(req, res)) return;
+  if (!(await requireAuth(req, res))) return;
```

## 提交後確認

- `git diff --cached --check` 通過，29 個檔案皆明確列名 stage。
- 四份 log 已逐一用 `git show HEAD:<path>` 的原始 bytes 再驗證為 LF，SHA-256 全部符合 verification.json 與本文件。
- 實作 commit 一般 push 至指定功能分支，未推 main、未 force。PR #319 建立時 base SHA 仍為 `2675eb5498271a65ae6e597ecbb4d2b07e28e589`，head SHA 即上述實作 commit。
- 補記 PR 後的 commit 僅更新本 SYNC，程式、測試及 evidence log 不再變更；沒有因文件補記重跑相同測試。

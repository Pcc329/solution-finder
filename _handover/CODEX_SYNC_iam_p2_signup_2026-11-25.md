# SYNC｜IAM P2.1 帳號申請制｜2026-11-25

## 交付與基準

- Repo：`Pcc329/solution-finder`；工作目錄：`C:\Users\S25036\Documents\Codex\repos\solution-finder`，未另建 clone。
- 建分支前已執行 `git fetch origin`，確認 `origin/feat/iam-p2-personal-login-2026-11-25` 為 `d9f1529645db57c1fcb84943e9912ad14d556565`。工作目錄乾淨後才建立新分支。
- 新分支：`feat/iam-p2-signup-request-2026-11-25`。
- PR base：`feat/iam-p2-personal-login-2026-11-25`，疊在 [PR #319](https://github.com/Pcc329/solution-finder/pull/319)；不 merge，不推 main 或 base 分支。
- PR：[PR #320](https://github.com/Pcc329/solution-finder/pull/320)，base `feat/iam-p2-personal-login-2026-11-25`；已確認 base SHA 仍為 `d9f1529645db57c1fcb84943e9912ad14d556565`，open、未 merge。
- 程式、測試、證據與本文件初版 commit：`b2a2ea90f65bd6dc7b7b2773119691c73698cc6b`。最後一筆僅補記交付資訊的文件 commit，見 [PR commits](https://github.com/Pcc329/solution-finder/pull/320/commits) 與 PR 描述所列最終 HEAD SHA；文件無法自我包含自身 commit SHA。

## 完成行為與修改檔案

| 檔案 | 用途 |
| --- | --- |
| `api/auth.js` | 新增 signup action；獨立 IP 限流；驗證姓名、院內網域與原密碼政策；service role Admin 建帳號、插入待核准列、失敗補償刪除；待核准登入訊息 |
| `_lib/auth.js` | select 與型別驗證新增 signup_source、approved_at；getUserRole 回傳 signupSource、approvedAt；requireAuth 身分物件與既有行為不變 |
| `public/auth-gate.js` | 個人表單申請連結、四欄申請表單、密碼確認、原告知全文、textContent 錯誤、成功訊息與返回登入；成功不 reload |
| `vercel.json` | 只新增 /api/signup → /api/auth?action=signup 一條 rewrite |
| `tests/iam-p2.test.mjs` | 僅規格 5.2 與使用者補正允許的 fixture、select、rewrite 守門更新 |
| `tests/company-search.test.mjs`、`tests/contact-access-log.test.mjs` | 各僅一處 user_roles mock 補欄位，使用者已明確核准；原斷言完全保留 |
| `tests/iam-p2-signup.test.mjs` | 新增 77 項 synthetic fetch 與 VM 測試；含逐字禁區與精確 rewrite 額外守門 |
| `_handover/evidence/iam-p2-signup-2026-11-25/` | 修改前後完整 TAP log、執行命令／檔案清單、LF SHA-256 與範圍驗證 |
| 本文件 | 交付、規格補正、證據與人工處理方式 |

成功只回 201 `{ ok: true, pending: true }`，不簽發 session cookie，不寫 usage_logs。角色列固定 role=user、signup_source=self、is_active=false、must_change_password=false，不設定 approved_at。尚未核准的 self 帳號登入回 403 pending_approval；曾核准後停權維持原訊息。

申請使用 service role Admin API，未開放或呼叫公開 /auth/v1/signup；未建立管理介面。非 POST（含 signup OPTIONS）回 405；其他 action 原有 OPTIONS 行為保留。

## 使用者確認的規格補正與 5.2 對照

| 檔案／範圍 | 原規格或既有內容 | 最終內容與授權 |
| --- | --- | --- |
| Admin 建帳號錯誤分類 | 原規格將所有 HTTP 422 視為 email 已存在 | 使用者補正：只有 error_code／code 為 email_exists 或 user_already_exists 才回 409；其餘 422 回 400「申請資料不符合要求，請確認 email 與密碼」。新增 weak_password、validation_failed、未知 code 與非 422 duplicate 測試 |
| `tests/iam-p2.test.mjs` user_roles select | email,role,is_active,must_change_password | 加上 ,signup_source,approved_at；保留精確相等斷言，依原規格 5.2 |
| 同檔 user_roles mock | 四個舊欄位 | 新增 signup_source='super'、approved_at='2026-11-25T06:54:39Z'；使用者補正啟用帳號應使用核准時間字串，非 null |
| 同檔 rewrite 守門 | 相對 2675eb5 只新增 change-password | 精確只多 change-password、signup 兩條，其他設定完整相等；依原規格 5.2 |
| `tests/company-search.test.mjs:61` | 啟用中的 user_roles mock 缺兩欄，新驗證會 fail closed | 使用者確認僅補 signup_source='super'、approved_at='2026-11-25T06:54:39Z'；保留全部既有斷言 |
| `tests/contact-access-log.test.mjs:70` | 同上 | 同上；其餘檔案內容與原基準逐字相同 |
| 新增待核准測試 | 無 | 僅待核准情境用 signup_source='self'、is_active=false、approved_at=null；停權 self 保留原核准時間 |

以上兩個未在原允許清單的檔案，已先依規格八第 7 點列出行號與建議，再取得使用者明確授權後修改。沒有其他規格外的程式修正；沒有刪除、跳過或放寬既有測試。

## 測試與證據

- Node v24.14.1。明確列出 `tests/` 的 .test.mjs／.test.cjs 與 `tests/sf-mcp/` 的 .test.mjs，以 `node --test --test-reporter=tap <各檔案>` 執行；兩次命令與完整清單分別存於 baseline-verification.json、final-verification.json。
- 修改前：25 檔、617 tests／617 pass、0 fail，exit 0。
- 修改後：26 檔、694 tests／694 pass、0 fail，exit 0；新增 77 項，兩次 cancelled／skipped／todo 均為 0。
- 完整測試前的受影響五組測試另通過 233／233。
- 新測試涵蓋精確兩步請求與 headers／role body、Unicode 姓名及密碼長度、兩網域正規化、驗證失敗零 fetch、60 分鐘限流與計數隔離、409 與補正 422、Admin 失敗、一次補償 DELETE、滿額分類、孤兒固定 log、回應與 log 隱私、待核准與停權、型別失敗不快取、VM 表單與成功不 reload。
- 所有外部流量均為 synthetic mock，未連線正式 Supabase、Vercel 或 Anthropic，未讀取或印出任何真實金鑰。
- api/solutions.js、api/claude.js、api/ask.js、api/stats.js 相對 d9f1529 零變更；API 維持 12 個 Function；requireAuth 呼叫仍為業務 10＋auth 2＝12 且全部 await。未更動 migrations、supabase/functions、八個頁面的 script 標籤。
- 原有守門保留；新測試另外與 d9f1529 比較四個禁區檔案及精確新增一條 rewrite。verification.json 另記受保護檔案的 LF SHA-256，並精確驗證既有測試只包含允許變更。

### 完整 log SHA-256（LF）

共同目錄：`_handover/evidence/iam-p2-signup-2026-11-25/`。

| Log | SHA-256 |
| --- | --- |
| baseline-tests.tap.log | 9937348e6bb78ed03a50f185be20cd818a5905292d6ffe6a325150faae02e70a |
| final-tests.tap.log | 6e78acb9a1efbfa269aeb1d4008ad8c0cd31852cd9b38bd3f156db0f46c04ab7 |

方法：Python subprocess 直接擷取 node stdout／stderr 的 bytes，串接後僅以 bytes.replace 將 CRLF 正規化為 LF，再用 hashlib.sha256 計算；沒有用 PowerShell 文字管線轉碼。完整 log 沒有行尾空白，無須刪除任何內容。stage 及 commit 後再以 git show 的原始 blob bytes 驗證相同 SHA-256。

## 限流與孤兒 Auth 帳號處理

申請使用獨立模組層 Map，同一 IP 固定 60 分鐘視窗最多 5 次請求，驗證不合格也計數；第 6 次起回 429，滿 60 分鐘恢復。IP 取法與 login 相同（x-forwarded-for 第一個值 trim，否則 socket.remoteAddress，否則 unknown），過期記錄於申請請求時清理；不與 login／change-password 共用計數。多個 Vercel 執行個體各自計數，並非跨執行個體的全域限流；待核准上限依已存在的資料庫約束執行，沒有修改資料庫。

角色列新增回非 2xx 或網路失敗後，僅對本次 Admin 回傳的 UUID 呼叫一次 service role DELETE。刪除若也失敗，回原本的安全 503，僅記 `[Signup Error] code=orphan_auth_user`；不記 email、UUID、密碼、key 或上游原文。滿額仍回「目前待核准的申請已滿，請洽系統管理者」。

PPC 人工清理方式（本任務未執行）：在 Supabase SQL Editor 先以唯讀查詢找候選孤兒，依事故時間、已核實申請人與 Auth 建立時間逐一確認；不能憑固定 log 直接識別某一帳號，也不要批次刪除所有無角色帳號。

```sql
select u.id, u.email, u.created_at
from auth.users as u
left join public.user_roles as r on r.user_id = u.id
where r.user_id is null
order by u.created_at desc;
```

確認候選確為本次申請失敗留下、且沒有其他保留用途後，PPC 可在 Supabase Dashboard 的 Authentication / Users 找到該 UUID 並刪除，或在可信任管理環境對該 UUID 重試 Admin DELETE。勿在聊天、交接或一般 log 中貼入真實金鑰。清理後讓本人重新申請。

## 待 PPC Preview 驗收

本 PR 保持未合併。由 PPC 依規格六在 Preview 驗證申請、核准前登入訊息、SQL 核准後登入無需改密碼，以及同 email 重複申請 409。正式資料庫與 Supabase 公開註冊設定均由 PPC 維護，本次沒有操作。

## 提交後確認

- 14 個檔案逐一列名 stage，`git diff --cached --check` 通過；兩份完整 log 已使用 `git show HEAD:<path>` 原始 blob bytes 再驗證，均為 LF 且 SHA-256 符合上表。
- 實作 commit 已一般 push 至新分支，未推 main 或 PR #319 分支、未 force。已建立 PR #320，明確 base 為 PR #319 的功能分支。
- 本次後續文件 commit 僅補記 PR 與交付資訊，程式、測試和 evidence 無變更，無須重跑相同測試。最終文件 commit SHA 同時記錄於 PR 描述與交付回覆。

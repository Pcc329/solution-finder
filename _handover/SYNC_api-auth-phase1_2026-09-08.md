# SYNC: API 身分驗證 Phase 1

日期：2026-09-08

## 改動範圍

- 新增 `_lib/auth.js`：session HMAC 驗證、API Key allowlist 預留位與 `requireAuth`。
- 新增單一 `api/auth.js`，由 `vercel.json` rewrites 提供 `/api/login`、`/api/logout`、`/api/session-check` 三個對外端點。
- 加入保護的既有端點：`ask.js`、`cases.js`、`claude.js`、`companies.js`、`company-detail.js`、`feedback.js`、`manufacturing-analyze.js`、`manufacturing-recommend.js`、`solutions.js`。
- `api/stats.js` 維持公開，未修改。
- 新增 `public/auth-gate.js`，並在 `index.html`、`manufacturing.html`、`diagnosis.html`、`compare.html`、`dashboard.html`、`feedback.html`、`sources.html`、`strategy-guide.html` 的 `<head>` 載入。
- `vercel.json` 新增三個 auth rewrites。Vercel Hobby 的 Function Count Limit 使既有 10 支 API 無法再新增三支獨立函式；helper 也移出 `api/`，使新增函式數保持為 1 支。

## 驗證設計

- `sf_session` 格式為 `{expiry}.{hmacHex}`。`verifySession` 驗證 expiry 尚未過期，再以 `SESSION_SECRET` 重新計算 HMAC-SHA256；兩段簽章長度一致時才使用 `crypto.timingSafeEqual`。
- `verifyApiKey` 比對 `x-api-key` 與逗號分隔的 `API_KEYS_ALLOWLIST`，本次不產生或設定任何實際 Key。
- `requireAuth` 允許有效 session 或 allowlisted API Key 任一通過；否則回 `401 { error: '未授權，請先登入' }`。
- 登入成功設定 7 天 HttpOnly、Secure、SameSite=Lax cookie；登出以 `Max-Age=0` 清除。

## 本機驗證

以下驗證未設定 `SESSION_SECRET`、`SITE_PASSWORD` 或 API Key，也未呼叫 Airtable、Supabase、Claude：

| 端點 | 方法 | 結果 |
| --- | --- | --- |
| solutions、companies、cases、ask、claude、company-detail、feedback、manufacturing-analyze、manufacturing-recommend | 各自合法方法 | 全數 `401 { error: '未授權，請先登入' }` |
| session-check | GET | `401 { authenticated: false }` |
| logout | POST | `200 { ok: true }` 且回傳 `sf_session=...; Max-Age=0` |

- `node --check`：新增檔案、九支受保護端點與 `public/auth-gate.js` 全數通過。
- `git diff --check`：通過。
- `api/stats.js` 經 diff/搜尋確認未加入 `requireAuth`。

## Vercel Preview 驗證

Preview：`https://solution-finder-8fs1y84zc-patrick0814-6136s-projects.vercel.app/`

- 首次部署失敗原因為 Vercel Hobby 的 Function Count Limit；收斂為單一 `api/auth.js`、將 helper 移出 `api/` 後，commit `785d228` 的 Preview 狀態為 Ready。
- 以 Node `fetch` 對真實 Preview 發送匿名請求：`solutions`、`companies`、`cases`、`company-detail` 的 GET，以及 `ask`、`claude`、`feedback`、`manufacturing-analyze`、`manufacturing-recommend` 的空 JSON POST，全部回 `401 { error: '未授權，請先登入' }`。
- `GET /api/session-check` 回 `401 { authenticated: false }`；`POST /api/logout` 回 `200 { ok: true }` 與清除 cookie；空 JSON `POST /api/login` 回 `401 { error: '密碼錯誤' }`，確認三條 rewrite 路由都可存取。
- `GET /api/stats` 回 `200`，包含 `total=2462`、`aiCount=985`、`companyTotal=929`、`medianPrice=40000`。
- 無登入 cookie 開啟首頁，實際顯示「內部系統登入」全螢幕遮罩、共用密碼欄位與登入按鈕，底下頁面不可互動。
- 外部 `weekly-report/weekly.html` 等待資料載入後正常顯示 KPI：2,462／985／929／NT$ 40,000。

本次未以任何密碼登入，因此登入成功、合法 cookie 後的 200 與登入後畫面仍需由 PPC 輸入共用密碼執行最終人工驗收。Codex 未經手、未讀取、未產生 `SITE_PASSWORD`、`SESSION_SECRET` 或 API Key 的實際值。

## Git

- Branch：`feat/api-auth-phase1-2026-09-08`
- 實作 commit：`752ef063afd58b0f827135a8662e3721ee6beb3c feat(security): add phase 1 API authentication`（已重新對齊 `main` 的 feedback 速率限制修正）。
- PR：https://github.com/Pcc329/solution-finder/pull/147

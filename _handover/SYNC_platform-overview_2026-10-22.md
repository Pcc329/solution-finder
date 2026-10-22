# 政府數位工具平台即時盤點頁面

- 分支：`codex/platform-overview`
- PR：建立後補入
- 路徑：`/platform-overview`、`/platform-overview.html`
- 部署與驗收說明：`docs/platform-overview.md`

新增七天 HMAC token 的 `dash-data` Edge Function、Vercel 同源轉送，以及按指定順序呈現的儀表板。
總表由 profiles 動態渲染為兩組 HTML 表格，含 ◆、附註與逐格查證日期；沒有內嵌正式資料。

密碼與簽章密鑰僅在 Supabase Secrets：`DASH_PASSWORD`、`DASH_TOKEN_SECRET`。
沿用現有閘門的 HMAC-SHA256 與 expiry.signature 格式，前端依需求使用 localStorage 與 Bearer。

## 使用者界定的範圍

- 資料庫建表、View 建立、匯入與 REVOKE 都由使用者處理；本次不執行、不提供資料寫入或 migration。
- View 權限依使用者回報：anon／authenticated 對兩個 View 均為 0，並非代理自行查得。
- Secrets 由使用者自行設定，代理不產生、不查看正式值。
- Edge Function 由使用者以 CLI 部署；本次不透過 Supabase 瀏覽器操作。
- GitHub main 合併由使用者處理，PR 分支可由 Vercel 產生預覽。

## 驗證

本機測試涵蓋 HMAC 與既有閘門格式相容、七天效期、錯誤密碼、無 token／到期／竄改拒絕、service-role 唯讀分頁、資料重讀、布林型別、統編前導零、AI 範圍、72 格兩組總表、HTML／URL 注入防護、同源轉送及登出／離頁清除資料。
測試資料皆為合成輸入，沒有正式資料檔、密碼或金鑰。

尚待部署後驗收：正式 View 的工業館 288／11、商服 100／16；72 列 profiles；使用者修改一格後重新整理更新。
參考 HTML 未取得；視覺預覽未獲授權，尚未完成與 Claude 原頁面逐項比對。

## CLI 部署

從 repo 根目錄執行：

```powershell
npx supabase functions deploy dash-data --project-ref apdbvjruevjprslhhvlx --no-verify-jwt
```

Vercel 沿用現有 `SUPABASE_URL`。不需新增儀表板密碼或簽章密鑰至 Vercel。

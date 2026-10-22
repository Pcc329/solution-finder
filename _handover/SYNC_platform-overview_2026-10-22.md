# 政府數位工具平台即時盤點頁面

- 分支：`codex/platform-overview`
- PR：依使用者指示暫不建立
- 路徑：`/platform-overview`、`/platform-overview.html`
- 部署與驗收說明：`docs/platform-overview.md`

新增七天 HMAC token 的 `dash-data` Edge Function，以及按指定順序呈現的儀表板；前端直接呼叫 Edge Function，Vercel 僅提供靜態頁面。
總表由 profiles 動態渲染為兩組 HTML 表格，含 ◆、附註與逐格查證日期；沒有內嵌正式資料。

密碼與簽章密鑰僅在 Supabase Secrets：`DASH_PASSWORD`、`DASH_TOKEN_SECRET`。
沿用現有閘門的 HMAC-SHA256 與 expiry.signature 格式，前端依需求使用 localStorage 與 Bearer。

## 使用者界定的範圍

- 資料庫建表、View 建立、匯入與 REVOKE 都由使用者處理；本次不執行、不提供資料寫入或 migration。
- View 權限依使用者回報：anon／authenticated 對兩個 View 均為 0，並非代理自行查得。
- Secrets 由使用者自行設定，代理不產生、不查看正式值。
- Edge Function 由使用者以 CLI 部署；本次不透過 Supabase 瀏覽器操作。
- 依使用者選定的直連架構移除轉送 API，限制 CORS 為正式站與同專案／帳戶的預覽網域；本次修改先顯示本地 diff，推送及重新部署分別等候核准。
- GitHub main 合併由使用者處理；目前只保留功能分支，不建立 PR。
- PR 說明僅寫功能、架構及測試項目，不含廠商名稱、統編、資料筆數或分析數字、正式密碼／密鑰值、甲方名稱。

## 驗證

本機測試涵蓋 HMAC 與既有閘門格式相容、七天效期、錯誤密碼、無 token／到期／竄改拒絕、service-role 唯讀分頁、資料重讀、布林型別、統編前導零、AI 範圍、72 格兩組總表、HTML／URL 注入防護、前端直連、CORS 來源及預檢限制，以及登出／離頁清除資料。
測試資料皆為合成輸入，沒有正式資料檔、密碼或金鑰。

尚待部署後驗收：執行 Supabase 端驗收 SQL，確認各項結果與預期一致；並測試修改 platform_profiles 任一格後，重新整理頁面即更新。
已取得並核對使用者提供的參考 HTML 與移植說明，補上熱圖篩選、範圍切換、欄位排序、已複核標籤與原稿靜態文案；將參考 CSS 的變數補齊，並保留動態總表。
21 項本機測試通過。視覺預覽未獲授權，尚未做瀏覽器畫面比對；本次 CORS 變更尚未重新部署或正式測試。

## CLI 部署

從 repo 根目錄執行：

```powershell
npx supabase functions deploy dash-data --project-ref apdbvjruevjprslhhvlx --no-verify-jwt
```

此頁不需要 Vercel 轉送 API 或環境變數；儀表板密碼及簽章密鑰留在 Supabase Secrets。

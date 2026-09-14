# SYNC — CSP 收集端點與 Report-Only

- 日期：2026-09-14
- 分支：`feat/csp-report-only-2026-09-14`
- 功能提交：`385cbc9b37ae2018acc9d9d50dbc5ffbf973060d`
- PR：https://github.com/Pcc329/solution-finder/pull/155
- 前置盤點：PR #154 的 `csp_resource_inventory_20260914.md`

## 新增檔案

1. `api/csp-report.js`
   - 接收 `application/csp-report`、一般 JSON，及 Reporting API 陣列格式的 CSP report。
   - 寫入 `blocked_uri`、`violated_directive`、`document_uri`；資料庫以預設值記錄 `reported_at`。
   - 不要求登入，因為瀏覽器自動 CSP 回報不能依賴登入憑證。
   - 使用與 `api/feedback.js` 相同概念的執行個體記憶體 IP 限流：每 IP 60 秒 20 次；每次最多處理 20 筆 report；request body 上限 64 KiB。
   - 略過欄位不足或超長的 report，不保存 IP、Cookie、完整 request body 或其他個資。

2. `migrations/20260914_create_csp_violations.sql`
   - 建立 `public.csp_violations`、`reported_at` 與 `blocked_uri` 索引。
   - 啟用 RLS；只有後端以 `SUPABASE_SERVICE_ROLE_KEY` 寫入，沒有公開 SELECT／INSERT policy。

3. `vercel.json`
   - 在既有全站 headers 規則新增：
     ```text
     Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://raw.githubusercontent.com; img-src 'self' http: https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report
     ```
   - 明確是 `Content-Security-Policy-Report-Only`，未使用會阻擋資源的 `Content-Security-Policy`。

## 已完成驗證

- `node --check api/csp-report.js`：通過。
- Handler smoke test：以標準 `csp-report` payload 模擬 POST，確認欄位正規化、Supabase POST payload 及 `204 No Content` 回應皆正確。
- `vercel.json`：可解析為 JSON，且只新增 `Content-Security-Policy-Report-Only`，值含 `report-uri /api/csp-report`。
- 未修改任何既有頁面資源引用、既有 API 功能或強制 CSP 標頭。

## 上線前／後待實測

此 PR 未能直接操作 Supabase SQL Editor，因此尚未執行 migration，也未宣稱已完成真實資料庫寫入驗收。合併前請先在 Supabase SQL Editor 執行：

```text
migrations/20260914_create_csp_violations.sql
```

合併部署後，使用下列測試 payload 對 Production 的 `/api/csp-report` POST，預期回應 `204`，並以 migration 末尾的 SELECT 確認新增資料：

```json
{
  "csp-report": {
    "blocked-uri": "https://csp-test.invalid/example.js",
    "violated-directive": "script-src-elem",
    "document-uri": "https://solution-finder-gray.vercel.app/"
  }
}
```

Report-Only 不會封鎖頁面資源。注意：Vercel `headers` 設定會同時出現在 Production 和 Preview；本次是以 Production 收集真實流量為目的，但 Preview 也會收到同一個非阻擋標頭。

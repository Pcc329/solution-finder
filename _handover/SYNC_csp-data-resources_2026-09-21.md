# SYNC: CSP Report-Only data: 資源允許清單

日期：2026-09-21（Asia/Taipei）
狀態：PR 待合併；Production 部署與 24 小時資料觀察待驗證

## Git
- Branch: `fix/csp-data-resources-2026-09-21`
- Code commit: `0c9587c62d72029d6f4e925267cf7cbcf98ab54c`
- PR: https://github.com/Pcc329/solution-finder/pull/166
- Preview: https://solution-finder-git-fix-csp-d-41bdd1-patrick0814-6136s-projects.vercel.app/

## 實際改動

只修改 `vercel.json` 中 `Content-Security-Policy-Report-Only` 的 `value` 字串。

改前：

```text
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://raw.githubusercontent.com; img-src 'self' http: https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report
```

改後：

```text
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://raw.githubusercontent.com; img-src 'self' http: https: data:; media-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report
```

差異只有：
- `img-src 'self' http: https:` → `img-src 'self' http: https: data:`
- 在 `img-src` 後新增 `media-src 'self' data:`

`script-src`、`style-src`、`font-src`、`connect-src`、`frame-src`、`object-src`、`base-uri`、`form-action`、`report-uri` 的內容及彼此順序不變。標頭仍是 Report-Only，未切換強制模式。`redirects`、`rewrites` 未修改。未修改 `api/csp-report.js`。

## 驗證

### 靜態檢查
- `vercel.json` 可解析為 JSON。
- 程式化比對：`redirects` 與 `rewrites` 完全相同；既有 CSP 指令相對順序相同，只插入 `media-src`。
- PR #166 建立時 changed_files=1，只有 `vercel.json` 程式碼改動；本 SYNC 文件為交接記錄。

### 實際 HTTP 回應（2026-09-21 約 10:30 Asia/Taipei）
使用 HTTP `HEAD /` 讀取正式回應標頭：

| 環境 | HTTP | `img-src` | `media-src` |
|---|---:|---|---|
| PR Preview | 200 | `'self' http: https: data:` | `'self' data:` |
| Production `solution-finder-gray.vercel.app` | 200 | `'self' http: https:` | 未定義 |

Preview 的完整 `Content-Security-Policy-Report-Only`：

```text
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://raw.githubusercontent.com; img-src 'self' http: https: data:; media-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report
```

Production 當時的完整 `Content-Security-Policy-Report-Only`：

```text
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://raw.githubusercontent.com; img-src 'self' http: https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report
```

Production 仍為舊值是預期結果：PR 尚未合併，不可宣稱已部署至正式站。

### 瀏覽器 Console
Preview 首頁目前要求「內部系統登入」共用密碼；未猜測或輸入憑證。登入後的方案列表與 Console 巡檢尚未完成，因此不能聲稱沒有 `data:` CSP 警告。

## 合併後驗收與 24 小時查核

1. 合併並完成 Production 部署後，以 `HEAD https://solution-finder-gray.vercel.app/` 確認標頭與上方 Preview 一致；記錄實際部署時間。
2. 登入正式站，瀏覽含公司頭像的方案列表與其他主要頁面，檢查 Console 是否仍有 `blocked-uri: data:` 之 `img-src` 或 `media-src` 違規。
3. 從部署時間起至少 24 小時後，於 Supabase SQL Editor 執行下列查詢。先確認時間欄位名稱，不以未知 schema 猜填結果：

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'csp_violations'
ORDER BY ordinal_position;

-- 確認時間欄位為 created_at 後，將 :deployed_at_utc 換成實際部署 UTC 時間。
SELECT violated_directive, blocked_uri, COUNT(*) AS report_count
FROM public.csp_violations
WHERE created_at >= :deployed_at_utc
  AND created_at < :deployed_at_utc + INTERVAL '24 hours'
  AND document_uri LIKE 'https://solution-finder-gray.vercel.app/%'
  AND blocked_uri LIKE 'data:%'
  AND (
    violated_directive LIKE 'img-src%'
    OR violated_directive LIKE 'media-src%'
  )
GROUP BY violated_directive, blocked_uri
ORDER BY report_count DESC;
```

目前不能提供「部署後 24 小時」結果筆數：截至本文件編寫時 Production 尚未更新，也尚未形成觀察窗口。合併與觀察完成後應補回實際查詢時間、總筆數、篩選後筆數及結果，不可預填為 0。

## 驗收狀態

- [x] Preview 標頭 `img-src` 包含 `data:`
- [x] Preview 標頭有獨立 `media-src 'self' data:`
- [x] 其他 CSP 指令內容及相對順序不變
- [x] Report-Only 模式及路由設定不變
- [ ] Production 部署後標頭驗證
- [ ] 登入後瀏覽含頭像列表，確認 Console 無 `data:` CSP 違規
- [ ] Production 部署後至少 24 小時 Supabase 報表查核

# 政府數位工具平台盤點

頁面：`/platform-overview`（亦可使用 `/platform-overview.html`）。

資料路徑：瀏覽器 → Vercel `/api/platform-overview/login|data` → Supabase `dash-data/login|data` → 既有 View／表。
瀏覽器只保存七天 HMAC token，不保存密碼或資料；重新整理一律重讀 Supabase。
Vercel 沿用已設定的 `SUPABASE_URL`，不需要儀表板密碼、簽章密鑰或 service-role key。

## 部署（由使用者執行）

從包含這次修改的 repo 根目錄執行。若 CLI 尚未登入，先完成 `npx supabase login`；這與資料庫密碼無關。

```powershell
npx supabase functions deploy dash-data --project-ref apdbvjruevjprslhhvlx --no-verify-jwt
```

只部署 `dash-data`，不會執行資料庫 migration、建表、匯入或 REVOKE。
`supabase/config.toml` 僅設定這一個 function 的 `verify_jwt = false`。
關閉的是 Supabase JWT gateway 檢查；GET `/data` 仍強制驗證本函式的 HMAC Bearer token。
函式原始碼由 `index.ts` 與同目錄的 `handler.mjs` 組成，CLI 會一併打包。

官方部署及配置文件：
- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/guides/functions/function-configuration

## Secrets（由使用者設定，不提供或讀取實際值）

需設定的自訂環境變數只有兩個：

| 名稱 | 用途 |
| --- | --- |
| `DASH_PASSWORD` | 儀表板共用密碼 |
| `DASH_TOKEN_SECRET` | HMAC-SHA256 簽章密鑰；修改後既有 token 失效 |

`SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` 使用 Supabase Edge Functions 內建環境變數。
不要將實際 Secrets、CSV、資料匯入 SQL 或完整資料快照加入 repo。
官方環境變數文件：https://supabase.com/docs/guides/functions/secrets

## 既有資料契約（僅讀取）

- `dash_platform_overview`：至少含 `platform_key`、`platform_name`、`solutions`、`ai_solutions`、`ai_pending`、`no_id_solutions`、`ai_label_method`。
- `dash_vendor_platforms`：至少含字串 `company_id`、`company_name`、`city`、`n_platforms`、`n_solutions`、`n_ai_solutions`，以及 JSON 布林值 `sme_ai`、`moea_cloud`、`startup_select`、`smebiz`、`gov_software`、`agri`、`ntpc`。
- `platform_profiles`：`platform_key`、`platform_name`、`platform_url`、`platform_order`、`dimension`、`dimension_order`、`value`、`note`、`differs_from_reference`、`source`、`verified_at`。

三個入口皆由 service role 查詢；不使用 anon key。資料庫建立、匯入與權限修改由使用者處理，本次沒有資料庫寫入程式。

API：
- `POST /functions/v1/dash-data/login`，JSON `{ "password": "…" }`，成功回傳 `{ token, expires_at }`。
- `GET /functions/v1/dash-data/data`，`Authorization: Bearer <token>`，回傳 `{ platforms, vendors, profiles, generated_at }`。
- 所有回應 `Cache-Control: private, no-store`。`generated_at` 是這次資料回應產生時間，頁面以台北時間顯示；各格查證時間另外顯示 `verified_at`。

首波名單：`n_platforms >= 2 AND n_ai_solutions >= 5`。
重疊及點陣僅比較具統編且具上述七個布林欄位的平台。
AI 佔比以 `ai_solutions / solutions` 計算；`ai_label_method` 含「複核」且有待確認件數時，上限為 `(ai_solutions + ai_pending) / solutions`。
總表按平台順序每四個一組、構面順序排序；◆ 表示差異，附註與查證日期顯示於格內。

## 權限與正式資料驗證紀錄

使用者於 2026-10-22 回報已驗證：`anon` 與 `authenticated` 對兩個 View 的權限皆為 0。
這是使用者提供的結果，並非本次代理自行連線取得。後續依使用者要求不再使用 Supabase 瀏覽器存取。

需要重查時，以下 SQL 只讀取權限，不做任何修改：

```sql
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('dash_platform_overview', 'dash_vendor_platforms')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

預期 0 列。此查詢是直接授權檢查；如需檢查 PUBLIC／繼承後的有效讀取權限，可額外唯讀查詢 `has_table_privilege`。

部署後的驗收（尚待正式環境執行）：

1. 未登入直接開頁，只見密碼頁，資料區 DOM 空白，沒有資料請求。
2. 登入後應載入既有資料；錯誤、過期或遭修改 token 回傳 401 並清空畫面及 localStorage。
3. 工業館 `ai_solutions = 288`、`ai_pending = 11`；商服 `100`、`16`。前端不可寫死這些數字。
4. 使用者在 Supabase 修改一格 profiles 後重新整理，該格應更新。代理不以修改正式資料作為測試。
5. 確認八平台、各九構面，總表分成兩組；◆、note、verified_at 顯示正確。

本機測試使用合成資料與拋棄式測試密鑰，不含正式盤點資料：

```powershell
node --test tests/platform-overview.test.mjs
```

版面依指定區塊順序及已讀取的移植說明實作。參考 HTML 檔未取得，尚未完成與原畫面的逐項視覺比對。
本機瀏覽器預覽未獲授權，因此未做瀏覽器視覺驗證；前端登入、渲染與清除資料的行為以 Node VM 測試。

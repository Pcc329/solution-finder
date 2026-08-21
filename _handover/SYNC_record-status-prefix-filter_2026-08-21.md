# SYNC — record_status 前綴過濾修正

- 日期：2026-08-21
- 分支：`fix/record-status-prefix-filter-2026-08-21`
- 基底：`feat/stats-supabase-dual-source-2026-08-19`（此基底含尚未合併的 stats Supabase 路徑）
- 決策：依規格預設，`疑似已下架_平台停止服務未逐筆驗證` 暫時保留顯示。

## 修改檔案與邏輯

| 檔案 | Airtable 路徑 | Supabase 路徑 |
| --- | --- | --- |
| `api/solutions.js` | `NOT(LEFT({record_status}, 3) = "已下架")` | `or=(record_status.is.null,record_status.not.like.已下架*)` |
| `api/stats.js` | 同上 | 同上 |
| `api/companies.js` | 同上 | 同上 |

三處舊有的精確條件 `record_status.neq.已下架_資料異常` 均已移除。新規則僅排除字面以「已下架」開頭的已確認狀態；NULL、正常，以及前綴為「疑似已下架」的低信心狀態都保留。

## 本機驗證

- `node --check api/solutions.js`：通過。
- `node --check api/stats.js`：通過。
- `node --check api/companies.js`：通過。
- 邏輯測試結果：
  - `已下架_資料異常`：排除。
  - `已下架_平台停止服務`（電子發票加值中心，SOL-1320 的狀態）：排除。
  - `疑似已下架_平台停止服務未逐筆驗證`：保留。
  - `正常`：保留。
  - NULL／空字串：保留。

## 真實 Preview 驗證

- Preview：`https://solution-finder-git-fix-recor-834295-patrick0814-6136s-projects.vercel.app`
- `GET /api/solutions`：HTTP 200，回傳 **2,333** 筆。
- `GET /api/stats`：HTTP 200，`total=2,333`、`companyTotal=906`，與 solutions 總筆數一致。
- Preview 回傳資料的 `id` 是 `airtable_rec_id`，且不公開 `solution_id`／`record_status`。因此 API 名稱搜尋「電子發票加值中心」雖得到 4 筆同名或近名方案，無法從公開回應逐筆確認其中是否就是 `SOL-1320`；不可把名稱結果誤判成前綴條件失效。

仍需具備資料庫查詢權限的人員完成以下最後核對後才可 merge：

1. 以 `solution_id=SOL-1320` 查核其 Preview/Supabase 原始 `record_status`，確認該筆不在 `/api/solutions` 回傳中。
2. 選一筆明確 `record_status=正常` 的 solution_id，確認仍可回傳。
3. 暫時將 Preview `DB_SOURCE_SOLUTIONS` 切至 Airtable，再以相同兩筆 solution_id 重測兩條資料來源。
4. `GET /api/companies`：確認公司層方案統計不包含已確認下架方案。


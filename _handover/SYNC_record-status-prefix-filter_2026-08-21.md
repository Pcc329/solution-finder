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

## 真實環境驗證待辦

此 commit 產生 Vercel Preview 後，必須以 Preview 實測，不能以本機邏輯結果取代：

1. `GET /api/solutions`：搜尋或檢查 `SOL-1320`／「電子發票加值中心」不再出現。
2. 選一筆 `record_status=正常` 的方案，確認仍可回傳。
3. 將 `DB_SOURCE_SOLUTIONS` 切換／對照 Airtable 與 Supabase 兩條路徑，確認相同的已確認下架狀態均被排除。
4. `GET /api/stats` 與 `GET /api/companies`：確認方案總數與公司層方案統計不包含已確認下架方案。

本地端沒有 Vercel Preview 的環境變數與部署控制權，因此在取得 Preview URL 前，不宣稱已完成真實 API 驗證，也不填寫資料總筆數。


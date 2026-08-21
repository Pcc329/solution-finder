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
- `GET /api/companies`：HTTP 200，回傳首頁既有上限的 200 家公司；確認 companies Supabase 路徑沒有因 `not.like` 查詢而失敗。

### SOL-1320 端到端追蹤證據

為避免同名方案誤判，曾在 Preview 暫時啟用僅限 Preview 的 trace，完成後已移除，沒有保留在最終程式碼：

```json
{
  "source": "supabase",
  "traceSolutionId": "SOL-1320",
  "rawRows": [{
    "solution_id": "SOL-1320",
    "airtable_rec_id": "reclC4TyfoJVO6Rzx",
    "record_status": "已下架_平台停止服務"
  }]
}
```

以一般 `/api/solutions` 回傳逐筆檢查：`id === "reclC4TyfoJVO6Rzx"` 的筆數為 **0**，證實 SOL-1320 已在 Supabase 查詢過濾時被排除。

人工瀏覽器用名稱搜尋仍看到的「電子發票加值中心」是另一筆資料：`id=rec4pe2a1KC56NnpW`、業者「鉅盛資訊股份有限公司」、`program_type=SME AI平台`、`data_source=中企署`。它不是 SOL-1320，不能因名稱相同而當成過濾失效。

`/api/solutions` 目前不讀取 `q` 或 `t` query parameter；帶入這些參數不會進入另一條搜尋程式分支，只是回傳同一份已套用資料來源過濾的完整集合。因此失敗回報中的 `?q=電子發票加值中心` 不會繞過 `solutionFilters`。

### 尚待補強的驗證

1. 選一筆已知 `record_status=正常` 的 solution_id，完成同樣的 source row 對照，留下保留證據。
2. 暫時將 Preview `DB_SOURCE_SOLUTIONS` 切至 Airtable，以相同已下架／正常 solution_id 重測 Airtable 路徑；目前 Preview 使用 Supabase，已完成 Supabase 實測。
3. 若要逐家公司驗證 `api/companies` 的方案數變動，需由具資料庫查詢權限者提供已下架方案對應的公司與變動前基準。


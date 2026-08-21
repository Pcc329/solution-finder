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

## Airtable 路徑端到端驗證

為驗證 Preview 上的 Airtable 路徑，曾以僅限 Preview 的來源覆寫與 trace 入口進行測試；測試完成後已完整移除，最終程式碼沒有這些 query 參數或除錯輸出。

- Airtable 原始資料中找到 **26** 筆 `record_status` 以「已下架」開頭的記錄。
- 排除樣本：`rec0MMRzXu2A0GfPm`，`solution_name=缺`，`record_status=已下架_資料異常`。
  - 以 `RECORD_ID()` 直查原始資料：找到 1 筆。
  - 以 `AND(NOT(LEFT({record_status}, 3) = "已下架"), RECORD_ID() = ...)` 查詢：`activeMatches=0`。
  - 完整 Airtable 模式 `/api/solutions`：HTTP 200、回傳 **2,459** 筆，該 record ID 不存在。
- 正常保留樣本：SOL-SME-0183 對應 Airtable record `rec4pe2a1KC56NnpW`，方案名「電子發票加值中心」，原始 Airtable `record_status` 為空字串。
  - 同一條 active filter：`activeMatches=1`。
  - 完整 Airtable 模式輸出仍含該 record，來源為 `中企署`，證實 NULL／空字串不會被誤排除。

### SOL-1320 與 SOL-SME-0183 對照

| 欄位 | SOL-1320 | SOL-SME-0183 |
| --- | --- | --- |
| 名稱 | 電子發票加值中心(無限型) | 電子發票加值中心 |
| Supabase `record_status` | 已下架_平台停止服務 | 正常營運資料（來源資料未標示已下架） |
| 回傳結果 | 已排除 | 保留 |

兩筆名稱相似但為不同方案；使用名稱搜尋不能作為 SOL-1320 過濾是否成功的判斷依據。預設保留的 `疑似已下架_平台停止服務未逐筆驗證` 仍未納入排除範圍。

## 最終驗證狀態

1. Supabase：已以 SOL-1320 完成實際排除驗證，HTTP 200。
2. Airtable：已以一筆明確「已下架_資料異常」資料完成原始資料、filter 結果與完整 API 三段驗證，HTTP 200。
3. 正常方案：SOL-SME-0183 對應記錄完整保留。
4. `api/companies.js` 的逐家公司統計差異仍需具資料庫比較基準時另行驗證；本次僅改動與 `api/solutions.js`／`api/stats.js` 一致的過濾條件。


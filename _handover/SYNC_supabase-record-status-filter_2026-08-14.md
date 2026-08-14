# SYNC：Supabase 已下架方案查詢過濾

- 日期：2026-08-14
- Branch：`fix/supabase-record-status-filter-2026-08-14`
- PR：[PR #123](https://github.com/Pcc329/solution-finder/pull/123)
- 實作 commit：`bf7b2eb98e0677b6e32867a9ba3b42a32d8ee35e`

## 實際改動

僅修改 `api/solutions.js`。

| 位置 | 變更 |
| --- | --- |
| `fetchAllSupabasePaged(..., filters = {})`（約第 67 行） | 新增可選 PostgREST query parameters，供個別資料表查詢使用。 |
| helper URL 組裝（約第 72 行） | 將 `filters` 寫入 `URLSearchParams`，仍保留原有 select、order、Range 分頁與 416 處理。 |
| Supabase `solutions` 呼叫點（約第 125 行） | 新增 `or=(record_status.is.null,record_status.neq.已下架_資料異常)`。 |

實作片段：

```js
{ or: '(record_status.is.null,record_status.neq.已下架_資料異常)' }
```

此條件只排除 `record_status = 已下架_資料異常`；NULL 保留，避免把未填狀態的舊資料一併排除。公司查詢未套用此條件。

## 未修改項目

- Airtable 路徑的 `ACTIVE_SOLUTIONS_FILTER` 維持原樣。
- `api/stats.js` 未修改：目前沒有 Supabase 分支，仍以既有 Airtable `fetchAll('Solutions', ACTIVE_SOLUTIONS_FILTER)` 取得統計，已具同一個排除條件。
- 未修改 `scoreSolution`、`getRecommendations`、`officialPrograms`、排序、輸出欄位或資料庫資料。

## 線上驗證

資料來源均為 Vercel 的即時部署，Production 以 Supabase 路徑服務方案列表。

| 驗證 | 結果 |
| --- | --- |
| 修改前 Production 首頁方案資料載入 | `2,491` 筆 |
| 修改後 PR Preview 首頁方案資料載入 | `2,465` 筆 |
| 總數差異 | `26` 筆，與已下架資料異常筆數一致 |
| Preview 搜尋 `威聯網科技` | `0` 筆；頁面顯示「找不到符合條件的方案」 |
| Preview Console | 無 application error |

Preview：
https://solution-finder-git-fix-supab-4466b6-patrick0814-6136s-projects.vercel.app/

## 驗收清單

- [x] Supabase Solutions 查詢在資料庫層排除唯一指定的已下架狀態。
- [x] NULL 狀態資料保留，不新增其他 `record_status` 過濾。
- [x] Airtable 過濾邏輯未變。
- [x] 前台即時方案總數從 2,491 降為 2,465，差 26。
- [x] 已下架公司名稱在 Preview 搜尋為 0 筆。
- [x] 僅變更 `api/solutions.js` 與本 SYNC 文件。

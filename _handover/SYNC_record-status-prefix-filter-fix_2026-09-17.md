# SYNC - 已下架篩選修正

- 日期：2026-09-17
- Branch：`fix/record-status-prefix-filter-2026-09-17`
- Base：`main` @ `3d5773ce88121b7d755483b33afd1c180f30ac28`
- PR：[PR #162](https://github.com/Pcc329/solution-finder/pull/162)
- Preview：[Vercel Preview](https://solution-finder-git-fix-recor-ea73e7-patrick0814-6136s-projects.vercel.app/)

## 改動範圍

僅修改下列三個 API，未修改前端、資料庫 schema、排序、分頁、回傳欄位或既有查詢流程。

1. `api/solutions.js`
2. `api/stats.js`
3. `api/companies.js`

程式碼 commits：

- `4cadf007a8f72f304c70a6f82891dd8bb94d5b2c` - solutions
- `b5a3b4b26e8d270aca5947be5e4f967b237a409f` - stats
- `6d28e5207c03948c3f1c990f8a1d5ee1307ae1d5` - companies

相對 `main` 的 diff 為 3 個檔案、各 3 行新增與 3 行刪除。

## 篩選規則

Airtable 三處均使用：

```js
const ACTIVE_SOLUTIONS_FILTER = "NOT(LEFT({record_status}, 3) = '已下架')";
```

Supabase 三處均使用：

```js
or: '(record_status.is.null,record_status.not.like.已下架*)'
```

因此會排除所有以「已下架」開頭的確認下架狀態，同時保留 `NULL` 與「疑似已下架」等未確認狀態。

沒有將三個 API 抽成共用 helper：三者目前各自封裝不同的資料取得流程與作用域，抽取會擴大本次 P0 修正的影響面；此次只還原相同、最小的 predicate。

## 真實資料驗證

使用已登入 Supabase SQL Editor 進行唯讀查詢：

| 指標 | 筆數 |
| --- | ---: |
| Solutions 原始總數 | 2,487 |
| 舊精確規則（僅排除 `已下架_資料異常`） | 2,462 |
| 新前綴規則 | 2,291 |
| 所有 `已下架*` 狀態 | 196 |
| 生產物流套用新規則 | 259 |

新規則相較舊精確規則減少 **171** 筆；生產物流由 261 筆降為 **259** 筆。

已下架樣本查詢到 `SOL-0607`「輕量級電力感控系統」，`record_status = 已下架_公司歇業佐證`。Preview 首頁以該名稱搜尋時，語意關鍵字「電力感控」回傳 **0 筆**，確認該下架樣本未回流到使用者結果。

## Preview 驗收

Vercel Preview 狀態為 Ready，且以實際瀏覽器登入後驗證：

1. 首頁顯示「AI 將從 2,291 筆方案中精選最佳路徑」與累計 2,291 筆。
2. 首頁點擊「生產物流」後，搜尋結果顯示 259 筆，分頁區亦顯示「共 2,291 個方案」。
3. `manufacturing.html` 顯示「已載入 2,291 筆方案」。
4. `dashboard.html` 成功載入，KPI 顯示總方案數 2,291、業者總數 1,102，表示 `stats.js` 與 `companies.js` 未因本次篩選發生 API 錯誤。

本次瀏覽器驗證畫面已於 Codex 工作執行紀錄擷取：首頁總數、生產物流 259 筆、製造業頁總數、已下架樣本 0 筆。

## Airtable 模式

目前 Vercel Preview 的 `DB_SOURCE_SOLUTIONS` 為 Supabase，因此上述正式 Preview 實測為 Supabase 路徑。Airtable 路徑已逐行核對：三個 consumer 都將既有 `fetchAll('Solutions', ACTIVE_SOLUTIONS_FILTER)` 改為前綴公式，未改動其餘 Airtable 查詢流程。

未變更共用 Preview 環境變數來強制切換 Airtable，避免影響其他 Preview 工作。若需要即時 Airtable 網路驗證，應建立隔離的 Preview 環境覆寫 `DB_SOURCE_SOLUTIONS=airtable` 後重新部署。

## 驗收結論

- [x] Solutions、Stats、Companies 都恢復前綴型已下架排除。
- [x] `NULL` 與「疑似已下架」不會被誤排除。
- [x] 已下架樣本不出現在 Preview 搜尋結果。
- [x] 首頁、製造業頁、統計與公司頁成功載入。
- [x] 無前端、DDL、排序、分頁或資料結構變更。

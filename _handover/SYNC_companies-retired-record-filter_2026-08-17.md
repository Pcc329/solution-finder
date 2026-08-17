# SYNC：companies.js 已下架方案過濾

日期：2026-08-17  
PR：[Fix companies: exclude retired solutions from company stats](https://github.com/Pcc329/solution-finder/pull/124)  
Branch：`fix/companies-retired-record-filter-2026-08-17`  
程式 Commit：`66867f678f406ee9c7f341de0add52cdd1f764d7`

## 實際改動

僅修改 `api/companies.js`。

- 新增 `ACTIVE_SOLUTIONS_FILTER` 常數。
- `fetchAll(table, filterByFormula)`：既有 Airtable 分頁流程新增可選的 `filterByFormula` 參數。
- Airtable 路徑：`fetchAll('Solutions', ACTIVE_SOLUTIONS_FILTER)`。
- `fetchSupabaseSolutions(url, anonKey)`：新增 Supabase/PostgREST `or` 條件。
- Airtable 與 Supabase 都改為從「已過濾的 Solutions 明細」重新累計 `solution_count`；`avg_score` 與 `tags` 原本就由同一份 `solutions` 陣列計算，因此三種公司層級統計現在使用同一資料集合。

未修改：`applyFilter`、`tagFromFields`、排序、回傳欄位、`slice(0, 200)`、`api/solutions.js`、`api/stats.js`。

## 過濾條件

Airtable：

```js
const ACTIVE_SOLUTIONS_FILTER = "NOT({record_status} = '已下架_資料異常')";
fetchAll('Solutions', ACTIVE_SOLUTIONS_FILTER)
```

Supabase：

```js
endpoint.searchParams.set(
  'or',
  '(record_status.is.null,record_status.neq.已下架_資料異常)'
);
```

Supabase 條件只排除明確標記為 `已下架_資料異常` 的記錄；歷史 `NULL` 狀態仍會保留。

## 為何同時重算 solution_count

原本 Airtable 會採用 Companies 的 linked-record 數量，Supabase 會採用 `companies_with_counts` view 的彙總數。兩者都可能包含下架方案，或與明細資料不同步。

本次讓兩條路徑都從過濾後的 Solutions 明細累計 `solution_count`，避免出現「標籤與平均分已排除，但方案數仍含下架資料」的不一致狀況。

## 驗證

### Preview（即時）

Preview：
https://solution-finder-git-fix-compa-036912-patrick0814-6136s-projects.vercel.app/dashboard.html

- Vercel Preview 狀態：Ready。
- 儀表板公司圖譜正常載入 200 筆，符合既有 API `slice(0, 200)` 上限，無前端錯誤。
- Preview 的 KPI 顯示：業者總數 871、有效方案總數 2,463（測試時間的即時資料）。
- 正式站與 Preview 的公司圖譜各成功載入 200 筆可見公司。

### Supabase 路徑範例

公司：`季河資訊股份有限公司`

| 環境 | 方案數 |
| --- | ---: |
| 正式站既有 companies API | 5 |
| 本 PR Preview | 20 |

差異不是 UI 上限造成。舊路徑採用 `companies_with_counts.solution_count`，新路徑依過濾後方案明細重新計數。這證明公司統計已改由單一、可套用 record_status 排除條件的 Solutions 資料集計算；舊 view 彙總不適合作為下架過濾後的基準。

### Airtable 路徑範例

公開 API 不提供切換 `DB_SOURCE_COMPANIES` 的參數，且 Preview 未公開其環境變數，因此無法在不變更部署設定的前提下，對 Airtable 路徑進行即時呼叫。

已以程式碼路徑驗證 Airtable 在取得 Solutions 時使用：

```js
fetchAll('Solutions', ACTIVE_SOLUTIONS_FILTER)
```

`fetchAll` 會將此值編碼為 Airtable `filterByFormula` 查詢參數，再沿用既有 `pageSize=100` 的分頁。故 Airtable 會只回傳非 `已下架_資料異常` 的方案，後續方案數、平均分、標籤均基於該陣列計算。

## 資料筆數說明

- 即時 Preview KPI：Companies 871、有效 Solutions 2,463。
- `/api/companies` 既有回傳上限：200 筆，未更動。
- 規格書列出的 Companies 891 與本次即時 KPI 871 不一致；此 PR 未修改 Companies 資料或 API 上限，應在資料同步層另行確認 20 筆差異。
- 原始（含下架）Solutions 總數未由公開 API 回傳，故本次不以推測數字填寫；已知 26 筆下架資料的實際原始總量須在 Airtable/Supabase 管理端驗證。

## 驗收結論

- [x] Airtable 路徑加入 `filterByFormula` 排除條件。
- [x] Supabase 路徑加入保留 NULL 的 `or` 排除條件。
- [x] `solution_count`、`avg_score`、`tags` 統一從已過濾 Solutions 明細計算。
- [x] 排序、篩選、回傳格式與 200 筆上限未變。
- [x] 程式 Commit 僅修改 `api/companies.js`（+12/-5）；PR 另含本 SYNC 文件。
- [x] Vercel Preview Ready，Dashboard 公司圖譜成功載入。
- [ ] Airtable runtime live call：受公開 API 未提供資料來源切換限制，需在 Preview 設定 `DB_SOURCE_COMPANIES=airtable` 後補驗。

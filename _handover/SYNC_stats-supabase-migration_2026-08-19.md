# SYNC — stats.js Supabase 雙軌讀取

- 日期：2026-08-20
- Branch：`feat/stats-supabase-dual-source-2026-08-19`
- Draft PR：[PR #130](https://github.com/Pcc329/solution-finder/pull/130)
- 最新程式 commit：`96cd7088bb356d7c2a3d05782016c842e9fb2fa1`
- 狀態：Companies Supabase schema 錯誤已修正，真實 Preview API 驗證通過。

## 本次修正：Companies 使用 company_status

### 根因

真實 Preview 原本回傳：

```json
{"error":"Supabase companies error: 400 - {\"code\":\"42703\",\"message\":\"column companies.record_status does not exist\"}"}
```

Solutions 使用 `record_status`；Companies 則是不同的 `company_status` enum，兩者不可共用篩選欄位或值。

### Supabase SQL 的權威確認

PM 於 Supabase SQL Editor 執行：

```sql
select distinct company_status from companies;
```

結果僅有兩個值：

- `正常營業`
- `暫停營業`

因此本次只排除 `暫停營業`，不沿用 Solutions 的 `已下架_資料異常`。

### api/stats.js 改動

| 路徑 | 修正後行為 |
| --- | --- |
| Supabase Solutions | 維持 `record_status.is.null,record_status.neq.已下架_資料異常`，未改動。 |
| Supabase Companies | select 改取 `company_status`；查詢加入 `company_status=neq.暫停營業`。 |
| Airtable Companies | JavaScript 保護改為排除 `company_status === '暫停營業'`。 |

核心片段：

```js
const activeSolutionsFilter = {
  or: '(record_status.is.null,record_status.neq.已下架_資料異常)',
};
const activeCompaniesFilter = {
  company_status: 'neq.暫停營業',
};
```

並將 Companies Supabase select 改為：

```js
'company_id,company_name,region,is_startup,city,company_status'
```

## 真實 Preview 驗證

- Preview：https://solution-finder-git-feat-stat-51381d-patrick0814-6136s-projects.vercel.app
- Endpoint：https://solution-finder-git-feat-stat-51381d-patrick0814-6136s-projects.vercel.app/api/stats
- 驗證時間：2026-08-20
- HTTP：`200`
- 重要回傳值：
  - `total: 2461`
  - `companyTotal: 906`
  - `aiCount: 985`
  - `validPriceCount: 2334`
  - `medianPrice: 40000`
  - `byRegion`、`byCity`、`latest5` 均有資料。
- 結果：已不再出現 `42703 column companies.record_status does not exist`。

本次 Preview 為 Supabase 路徑的實際呼叫；回應非 mock。Vercel 於 branch commit 後自動部署。

## 原雙軌設計維持

- `DB_SOURCE_SOLUTIONS` 與 `DB_SOURCE_COMPANIES` 可各自設定 `airtable` 或 `supabase`。
- `fetchAllSupabasePaged()` 維持 1,000 筆分頁、穩定排序與 HTTP 416 結束防護。
- Airtable Solutions 仍使用既有 `ACTIVE_SOLUTIONS_FILTER`。
- 回傳 JSON 結構未調整：`total`、`companyTotal`、`byRegion`、`byCity`、`latest5` 等維持原樣。

## 驗收狀態

- [x] Companies Supabase 查詢不再引用不存在的 `record_status` 欄位。
- [x] 已依實際 `company_status` enum 排除 `暫停營業`。
- [x] Solutions 的 `record_status` 過濾邏輯保持不變。
- [x] 真實 Preview `/api/stats` 回傳 HTTP 200，且統計值非零。
- [x] 未修改回傳 JSON 結構或前端檔案。

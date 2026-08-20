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

## 2026-08-20：newThisMonth 語意調整

### 根因

Supabase Solutions 僅有 `created_at` 時間欄位。2026-08-12 批次遷移時，2,461 筆既有方案在同一期間寫入 Supabase；因此原有程式：

```js
const newThisMonth = solutions.filter(rec => new Date(getCreatedTime(rec)) > monthAgo).length;
```

在 Supabase 路徑透過 `getCreatedTime()` 讀到的是批次寫入時間，會正確地算出「本月寫入資料庫」2,461 筆，卻不等於「本月外部發布的新方案」。這不是時區或 `new Date` 比較錯誤；`newThisWeek` 與 `newThisMonth` 使用同一個日期比較方式。

經確認不追溯 Airtable `createdTime`、不修改 Supabase 資料內容或 schema。

### 採用做法 A

保留 API 欄位 `newThisMonth` 與既有計算，僅在 `public/dashboard.html` 調整顯示語意：

```html
<!-- 改前 -->
<span class="update-label">本月新增</span>

<!-- 改後 -->
<span class="update-label">本月寫入資料庫</span>
```

理由：這是單一、可見且準確的產品文案修正，不增加 API 欄位，也不改變回傳 JSON 契約。真正的外部方案追蹤由 `source_monitoring_targets` / `source_monitoring_checks` 的定期海巡機制負責。

### 保留項目

- `newThisWeek` 計算與顯示未改動。
- `created_at`、任何資料內容、`company_status`、Solutions `record_status`、其他統計欄位均未改動。
- 本次程式改動僅為 `public/dashboard.html` 的 1 行標籤文字。

### 部署與驗證

- Vercel PR #130 deployment：Ready  
  https://solution-finder-git-feat-stat-51381d-patrick0814-6136s-projects.vercel.app/dashboard.html
- 已以 GitHub 分支檔案確認新文案存在。
- [ ] 本環境對 Preview HTML 的實際 fetch 在本次執行期間連續失敗（網路層 `fetch failed`），因此尚未能以 HTTP body 截圖／回應再次確認畫面文字。不可把 Vercel Ready 視為此項畫面驗收完成。

### PR 狀態

此語意修正已推入 PR #130 的既有分支。待可取得 Preview HTML 實際回應、確認「本月寫入資料庫」顯示後，才具備解除 Draft 並人工合併的條件。


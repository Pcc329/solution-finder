# SYNC — stats.js Supabase 雙軌讀取

- 日期：2026-08-19
- Branch：`feat/stats-supabase-dual-source-2026-08-19`
- Draft PR：[PR #130](https://github.com/Pcc329/solution-finder/pull/130)
- 狀態：實作與 mock／靜態驗證完成；Supabase schema 與真實 Preview 雙軌驗證待人工執行。

## 實際修改

檔案：`api/stats.js`

### 新增雙軌來源判斷

- `DB_SOURCE_SOLUTIONS=supabase` 時從 Supabase `solutions` 讀取統計欄位；未設定或 `airtable` 時維持原 Airtable `Solutions` 分頁讀取。
- `DB_SOURCE_COMPANIES=supabase` 時從 Supabase `companies` 讀取統計欄位；未設定或 `airtable` 時維持原 Airtable `Companies` 分頁讀取。
- 新增泛用 `fetchAllSupabasePaged()`，使用每頁 1,000 筆、穩定排序與 416 結束防護。
- Supabase 的 Solutions 與 Companies 皆帶：
  ```js
  or: '(record_status.is.null,record_status.neq.已下架_資料異常)'
  ```
  只排除明確已下架值，保留歷史 `NULL` 狀態。
- Airtable Companies 不對中文 Single Select 使用 `filterByFormula`，改為全量分頁後以 JavaScript 排除 `record_status === '已下架_資料異常'`。

### 時間與 latest5 對齊

- `getCreatedTime()`：Airtable 使用 `createdTime`，Supabase 使用 `created_at`。
- `latest5` 保持既有 `name/company/category/dataSource/createdTime` 結構。
- Supabase Companies select 額外取 `company_name`，供 `latest5.company` 以 `company_id` 對照，避免既有 dashboard 方案名稱／業者名稱顯示退化。
- Supabase Solutions select 包含 `solution_name`，維持 `latest5.name` 的既有內容。

## 靜態與 Mock 驗證

以 handler 層級 mock 驗證，未呼叫真實資料庫：

| 情境 | HTTP | total / companyTotal | 核對 |
| --- | --- | --- | --- |
| Supabase 雙軌 | 200 | 1 / 1 | `aiCount=1`、`latest5.name=即時方案`、`latest5.company=甲公司`、`latest5.dataSource=農業部`、`臺北市→台北市`；兩張查詢皆有 record_status `or` |
| Airtable fallback | 200 | 1 / 1 | Solutions 保留原 `filterByFormula`；Companies 的已下架「南部」測試記錄未進入 `byRegion` |
| 缺少 Supabase 設定 | 500 | - | 回傳既定錯誤 `SUPABASE_URL or SUPABASE_ANON_KEY not configured` |

- `api/stats.js` 以 Node ESM `SourceTextModule` 解析通過。

## 五之二：Companies schema

尚未完成真實 schema 查詢：本環境沒有 Supabase SQL Editor 或資料庫連線權限，不能捏造欄位存在性。

待在 Supabase SQL Editor 執行：

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'companies'
order by ordinal_position;
```

需要確認：`company_id, company_name, region, is_startup, city, record_status`。

## 五之三：驗證方式聲明

- [ ] 已在真實 Preview 環境驗證，含 Supabase 路徑與 Airtable 路徑兩種情境
- [x] 僅完成 mock／靜態驗證，**尚未真實環境驗證**

本環境無法直接連線 Vercel Preview API。待人工於 Preview 分別設定 `DB_SOURCE_SOLUTIONS`／`DB_SOURCE_COMPANIES` 為 `supabase` 與 `airtable` 後，記錄 `total`、`companyTotal`、`newThisWeek`、`newThisMonth`、`latest5`，並確認 API JSON 不含已下架資料。

## 驗收狀態

- [x] stats.js 支援 Solutions / Companies 雙軌讀取。
- [x] Supabase 兩張表皆帶 record_status 排除條件。
- [x] Airtable fallback 的既有回傳 JSON 結構維持。
- [x] Supabase `created_at` 與 Airtable `createdTime` 均可供近期統計使用。
- [ ] Companies schema 真實查詢。
- [ ] 真實 Preview 的 Supabase / Airtable 雙軌結果與即時筆數對照。

**依規格：真實環境驗證尚未完成前，不建議 merge。**


## Preview 部署

- Vercel Preview：[Preview](https://solution-finder-git-feat-stat-51381d-patrick0814-6136s-projects.vercel.app)
- Stats endpoint：https://solution-finder-git-feat-stat-51381d-patrick0814-6136s-projects.vercel.app/api/stats
- Deployment：[Vercel Ready](https://vercel.com/patrick0814-6136s-projects/solution-finder/5NTABfLxuDpuY4no7BjaE4pvtqxP)

### 待人工即時驗收

本環境無法連線上述 Preview endpoint，請於 Vercel Preview 依序設定並重新部署：

1. `DB_SOURCE_SOLUTIONS=supabase`、`DB_SOURCE_COMPANIES=supabase`，呼叫 `/api/stats`，記錄 `total`、`companyTotal`、`newThisWeek`、`newThisMonth`、`latest5`，並確認分布物件有資料。
2. 改為 `airtable`（或移除兩個環境變數），重複記錄相同欄位，作為 fallback 對照。
3. 先執行本 SYNC 的 Companies schema SQL，確認 `company_name` 與其他 select 欄位存在。
4. 確認兩種回應皆不計入 `record_status=已下架_資料異常` 的資料。

在上述真實驗收完成前，PR #130 必須維持 Draft。

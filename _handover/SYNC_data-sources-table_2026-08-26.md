# SYNC — data_sources 資料來源登錄表

- 日期：2026-08-26
- 分支：`feat/data-sources-table-2026-08-26`
- Migration：`migrations/20260826_create_data_sources.sql`
- 執行狀態：**待 Supabase SQL Editor 執行**
- PR：待建立

## 規格筆數判斷

規格標題寫「初始 9 筆」，但提供的 INSERT 清單為 `SRC-001` 至 `SRC-012`，驗收也明確要求 `COUNT(*) = 12`。本 migration 依清單與驗收建立 **12 筆** seed data。

## 實際 CREATE TABLE 與 INSERT

完整可執行 SQL 位於：

```
migrations/20260826_create_data_sources.sql
```

該檔案包含：

```sql
CREATE TABLE public.data_sources (
    source_id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    url TEXT,
    organizer TEXT,
    program_name TEXT,
    program_year TEXT,
    co_organizer TEXT,
    acquisition_channel TEXT,
    crawl_status TEXT,
    technical_note TEXT,
    related_source_id TEXT,
    last_liveness_check DATE,
    last_crawl_date DATE,
    record_count_estimate INTEGER,
    data_freshness_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

接著以單一 `INSERT INTO data_sources (...)` 寫入規格定義的 12 筆資料，外層包在 `BEGIN; ... COMMIT;` 交易中。欄位型態完全遵照規格；`program_year` 維持 `TEXT`，可同時存放「115年」「110年度起」及「常設平台」。

## 執行與驗證指令

請在 Supabase SQL Editor 貼上 migration 全文並執行，再執行：

```sql
SELECT COUNT(*) AS data_source_count
FROM public.data_sources;

SELECT *
FROM public.data_sources
ORDER BY source_id;

SELECT source_id, related_source_id
FROM public.data_sources
WHERE related_source_id IS NOT NULL
ORDER BY source_id;
```

預期第一個查詢為：

```
data_source_count
-----------------
12
```

預期關聯如下：

| source_id | related_source_id |
| --- | --- |
| SRC-003 | SRC-004 |
| SRC-004 | SRC-003 |
| SRC-005 | SRC-003 |
| SRC-007 | SRC-008 |
| SRC-008 | SRC-007 |

## 靜態驗證

已檢查 migration 原始 SQL：

- `CREATE TABLE public.data_sources` 存在。
- `SRC-001` 至 `SRC-012` 共 12 個 source_id。
- source_id 無重複、無缺號。
- 所有 `related_source_id` 皆指向同一份 seed 中存在的 source_id。
- 沒有修改 `solutions`、`companies`、`cases`、`record_status` 或任何 API 邏輯。

## 尚待的實際資料庫驗收

本 Codex 環境沒有 Supabase SQL connector、service role 金鑰或 SQL Editor session，故無法直接執行 migration，也無法誠實提供 `SELECT * FROM data_sources ORDER BY source_id;` 的實際資料庫回傳值。執行完成後，請將三段查詢結果貼回；我可以立即核對 12 筆內容、關聯與欄位型態。

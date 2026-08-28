# SYNC：Cases 次要產業分類欄位（S1）

- 日期：2026-08-28
- 分支：feat/cases-secondary-industry-codes-2026-08-28
- 狀態：**Draft，等待 Supabase SQL Editor 建欄與真實 Preview 驗證**

## Git 異動

僅修改 api/cases.js，新增 secondary_industry_codes 對外輸出。

### 白名單

~~~diff
   'industry',
   'industry_code',
+  'secondary_industry_codes',
   'company_size',
~~~

### 型別穩定處理

~~~js
safeFields[fieldName] = fieldName === 'secondary_industry_codes'
  ? fields.secondary_industry_codes ?? []
  : fields[fieldName] ?? '';
~~~

Supabase 正規化也只對新欄位保留陣列型態，避免在進入白名單投影前把資料庫 NULL 改成空字串：

~~~js
normalized[fieldName] = fieldName === 'secondary_industry_codes'
  ? value ?? []
  : value ?? '';
~~~

其餘既有白名單欄位仍使用原本的 value ?? '' 與 fields[fieldName] ?? '' 行為，未改欄位順序、EXCLUDED_FIELDS 或 ALLOWED_CONFIDENTIALITY。

## Supabase SQL Editor：需人工執行

### 1. 執行前確認

~~~sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cases' AND column_name = 'secondary_industry_codes';
~~~

預期：0 rows。

### 2. 新增欄位與說明

~~~sql
ALTER TABLE cases ADD COLUMN secondary_industry_codes TEXT[];

COMMENT ON COLUMN cases.secondary_industry_codes IS
  '跨產業案例的次要產業分類代碼（主分類仍在industry_code）。陣列型態，選填。2026-08-27新增，S1決策C。';
~~~

### 3. 執行後確認

~~~sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'cases' AND column_name = 'secondary_industry_codes';
~~~

預期：1 row，data_type = ARRAY、udt_name = _text。

## 驗證紀錄

- ESM 模組載入語法驗證：通過（exit code 0）。
- API 優雅降級：即使 Schema 尚未建立、Supabase 回傳物件沒有此 key，fields.secondary_industry_codes ?? [] 仍會輸出 []，不會讓 /api/cases 因本欄位缺失而 500。
- 真實 Supabase SQL 前後查詢：**待人工執行，尚無實際輸出，不能宣告完成。**
- 真實 Preview /api/cases 回應：**待 Schema 建立與 Preview 部署後驗證。**
- 筆數基準：規格書提供正式站 confidentiality 過濾後 85 筆；本 PR 尚未取得可用 Preview 部署，未重新宣告筆數。

## 驗收狀態

| 項目 | 狀態 |
|---|---|
| CASE_FIELD_WHITELIST 加入欄位 | Yes |
| NULL 對外固定為 [] | Yes（程式邏輯） |
| 不影響其他 12 個既有白名單欄位 | Yes（僅新欄位 special case） |
| Supabase text[] 欄位已建立 | Pending：需 SQL Editor |
| 既有 Cases 未回填、保持 NULL | Pending：需 SQL 查詢確認 |
| 真實 Preview API 200 且每筆含 key | Pending：需部署後測試 |
| confidentiality 過濾後 85 筆不變 | Pending：需真實 Preview 測試 |

## Preview 部署狀態

- Vercel commit status：success。
- 部署資訊頁需要已登入的 Vercel session 才會提供可呼叫的 Preview alias；本環境取得的未驗證頁面回應要求登入，無法誠實宣稱已完成真實 Preview API 呼叫。
- 因此本 PR 維持 Draft。請先依本文件 SQL 區塊完成 Schema 建立，之後再用該 PR 的 Vercel Preview 呼叫 /api/cases，確認 200、85 筆基準與每筆 secondary_industry_codes 為 [] 或 text[]。

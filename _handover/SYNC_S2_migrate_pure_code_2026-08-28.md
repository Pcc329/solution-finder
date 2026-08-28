# SYNC：S2③④ Cases 行業代碼純碼遷移

- 日期：2026-08-28
- 分支：feat/cases-industry-code-normalization-2026-08-28
- 狀態：Draft；等待 Supabase SQL Editor 執行與真實 Preview API 驗證。

## 範圍

- 僅修改 `api/cases.js`：將公開的 `industry_code` 用 `industry_codes` 對照表組回既有顯示格式。
- `provider_industry_code` 僅做資料庫層純代碼遷移，維持不在 `CASE_FIELD_WHITELIST`，不對外公開。
- 未修改前端、Airtable、白名單、`EXCLUDED_FIELDS` 或 `ALLOWED_CONFIDENTIALITY`。

## API 改動

~~~diff
+function resolveIndustryDisplay(rawValue, codeMap) {
+  if (!rawValue) return rawValue;
+  const name = codeMap.get(rawValue);
+  return name ? `${rawValue} ${name}` : rawValue;
+}
+
-function projectCases(records) {
+function projectCases(records, codeMap) {
   // ...
-  safeFields[fieldName] = fields[fieldName] ?? '';
+  safeFields[fieldName] = fieldName === 'industry_code'
+    ? resolveIndustryDisplay(fields.industry_code ?? '', codeMap)
+    : fieldName === 'secondary_industry_codes'
+      ? fields.secondary_industry_codes ?? []
+      : fields[fieldName] ?? '';
 }
~~~

`fetchIndustryCodeMap()` 以 PostgREST 讀取 `industry_codes?select=code,name`；該查詢失敗時記錄錯誤並回傳空 `Map`，Cases 主查詢仍可回傳原始純代碼，避免此查表失敗導致 `/api/cases` 500。

## 離線程式驗證

- ESM 模組載入與 helper 測試：通過（exit code 0）。
- `C08` + 對照表 → `C08 食品及飼品製造業`。
- 空字串 → 空字串。
- 不存在的 `Z99` → 原樣 `Z99`。

## Supabase SQL Editor：請先執行前快照

~~~sql
SELECT case_id, industry_code, provider_industry_code
FROM public.cases
WHERE industry_code IS NOT NULL OR provider_industry_code IS NOT NULL
ORDER BY case_id;

SELECT COUNT(*) AS cases_total_before
FROM public.cases;

SELECT COUNT(*) AS industry_codes_total_before
FROM public.industry_codes;
~~~

## Supabase SQL Editor：純代碼遷移

~~~sql
BEGIN;

UPDATE public.cases
SET industry_code = split_part(industry_code, ' ', 1)
WHERE industry_code IS NOT NULL;

UPDATE public.cases
SET provider_industry_code = split_part(provider_industry_code, ' ', 1)
WHERE provider_industry_code IS NOT NULL;

COMMIT;
~~~

## Supabase SQL Editor：執行後驗證

~~~sql
SELECT case_id, industry_code, provider_industry_code
FROM public.cases
WHERE industry_code IS NOT NULL OR provider_industry_code IS NOT NULL
ORDER BY case_id;

SELECT COUNT(*) AS cases_total_after
FROM public.cases;

-- 預期 0：不應再有含空白的混合字串
SELECT COUNT(*) AS mixed_format_count
FROM public.cases
WHERE industry_code ~ '\\s' OR provider_industry_code ~ '\\s';

-- 預期 0：所有非 NULL 的純代碼都應可對照
WITH used_codes AS (
  SELECT industry_code AS code FROM public.cases WHERE industry_code IS NOT NULL
  UNION
  SELECT provider_industry_code AS code FROM public.cases WHERE provider_industry_code IS NOT NULL
)
SELECT used_codes.code
FROM used_codes
LEFT JOIN public.industry_codes ON industry_codes.code = used_codes.code
WHERE industry_codes.code IS NULL
ORDER BY used_codes.code;
~~~

## 待完成的實證

- Supabase 執行前後完整快照：Pending，需人工 SQL Editor 執行後貼回。
- Cases 總筆數維持 115：Pending，需 SQL 結果。
- Preview API 85 筆與遷移前輸出格式比對：Pending，需在此 PR 的 Preview 執行。
- 確認 `provider_industry_code` 不在 API JSON：Pending，需 Preview JSON。

## 驗收狀態

| 項目 | 狀態 |
|---|---|
| industry_code API 回組邏輯 | Yes（離線測試） |
| 查表失敗優雅降級 | Yes（程式邏輯） |
| provider_industry_code 維持不公開 | Yes（未修改白名單） |
| Supabase 兩欄改為純代碼 | Pending：需 SQL Editor |
| 115 筆快照前後對照 | Pending：需 SQL Editor |
| 真實 Preview API 85 筆驗證 | Pending：需 Preview |

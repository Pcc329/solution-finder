-- 線上資料驗證，全部為 SELECT。可逐一執行並回貼 01–08 結果。
-- 無新版 RPC 呼叫，無 migration，無資料更新。

-- 01 用途：驗證時間、companies 全表涵蓋率（分母不套用任何搜尋條件）。
SELECT now() AS verified_at, count(*) AS total_companies,
       count(capital) AS with_capital,
       count(*) FILTER (WHERE capital IS NULL) AS missing_capital,
       round(100.0 * count(capital) / nullif(count(*), 0), 2) AS percentage
FROM public.companies;

-- 02 用途：列出兩種母體，及沒有符合預設上架條件方案的公司數。
-- 預設排除 record_status LIKE '已下架%'，保留 NULL 與疑似下架。
SELECT count(*) AS companies_all,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM public.solutions s WHERE s.company_id = c.company_id
           AND (s.record_status IS NULL OR s.record_status NOT LIKE '已下架%')
       )) AS companies_with_active_solutions,
       count(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM public.solutions s WHERE s.company_id = c.company_id
           AND (s.record_status IS NULL OR s.record_status NOT LIKE '已下架%')
       )) AS companies_without_active_solutions
FROM public.companies c;

-- 03 用途：獨立 SELECT 模擬新函式資本額條件，列出六組範例的兩種口徑。
-- JOIN 後先篩選、再 count(DISTINCT company_id)，尚未分頁。
WITH cases(test_no, purpose, min_capital, max_capital, city) AS (
  VALUES
    (1, 'min_100m', 100000000::numeric, NULL::numeric, NULL::text),
    (2, 'taipei_min_100m', 100000000, NULL, '臺北市'),
    (3, 'max_100m', NULL, 100000000, NULL),
    (4, 'range_10m_100m', 10000000, 100000000, NULL),
    (5, 'exact_100m', 100000000, 100000000, NULL),
    (6, 'max_zero', NULL, 0, NULL)
)
SELECT t.test_no, t.purpose,
       (SELECT count(DISTINCT c.company_id)
        FROM public.companies c JOIN public.solutions s ON s.company_id = c.company_id
        WHERE (s.record_status IS NULL OR s.record_status NOT LIKE '已下架%')
          AND (t.city IS NULL OR replace(coalesce(c.city, ''), '台', '臺') = t.city)
          AND (t.min_capital IS NULL OR c.capital >= t.min_capital)
          AND (t.max_capital IS NULL OR c.capital <= t.max_capital)) AS function_scope_companies,
       (SELECT count(*) FROM public.companies c
        WHERE (t.city IS NULL OR replace(coalesce(c.city, ''), '台', '臺') = t.city)
          AND (t.min_capital IS NULL OR c.capital >= t.min_capital)
          AND (t.max_capital IS NULL OR c.capital <= t.max_capital)) AS all_scope_companies
FROM cases t ORDER BY t.test_no;

-- 04 用途：capital_desc 的最大值與前 50 家，NULL 排最後。
-- 同額以公司編號呈現便於人工核對。新函式同額沿用既有 first_rank。
SELECT c.company_id, c.company_name, c.capital
FROM public.companies c
WHERE EXISTS (
  SELECT 1 FROM public.solutions s WHERE s.company_id = c.company_id
    AND (s.record_status IS NULL OR s.record_status NOT LIKE '已下架%')
)
ORDER BY c.capital DESC NULLS LAST, c.company_id
LIMIT 50;

-- 05 用途：資本額篩選之前的缺值公司組數，核對 notes 的 N。
-- 保留既有無 company_id 方案各自分組語意；找不到公司列也視為 capital 未知。
-- 全體與臺北市各一列，臺北市先套縣市再計算缺資本額的群組。
WITH base AS (
  SELECT coalesce(s.company_id, '__no_company__:' || s.solution_id) AS company_key,
         c.capital, c.city
  FROM public.solutions s LEFT JOIN public.companies c ON c.company_id = s.company_id
  WHERE s.record_status IS NULL OR s.record_status NOT LIKE '已下架%'
)
SELECT 'all_active_groups' AS scope,
       count(DISTINCT company_key) FILTER (WHERE capital IS NULL) AS missing_groups
FROM base
UNION ALL
SELECT 'taipei_active_groups', count(DISTINCT company_key) FILTER (WHERE capital IS NULL)
FROM base WHERE replace(coalesce(city, ''), '台', '臺') = '臺北市';

-- 06 用途：三組既有查詢的獨立 SQL 基準，不帶資本額且不回傳 capital。
-- AI 關鍵字仍沿用既有七個欄位的大小寫不敏感子字串比對。
WITH cases(test_no, keyword, city, normal_only) AS (
  VALUES (1, NULL::text, NULL::text, false),
         (2, NULL, '臺北市', false),
         (3, 'ai', NULL, true)
), matched AS (
  SELECT t.test_no, s.solution_id,
         coalesce(s.company_id, '__no_company__:' || s.solution_id) AS company_key,
         s.record_status
  FROM cases t CROSS JOIN public.solutions s
  LEFT JOIN public.companies c ON c.company_id = s.company_id
  WHERE (s.record_status IS NULL OR s.record_status NOT LIKE '已下架%')
    AND (NOT t.normal_only OR s.record_status IS NULL OR
         (s.record_status NOT LIKE '疑似%' AND s.record_status NOT LIKE '已下架%'))
    AND (t.city IS NULL OR replace(coalesce(c.city, ''), '台', '臺') = t.city)
    AND (t.keyword IS NULL OR EXISTS (
      SELECT 1 FROM unnest(ARRAY[s.solution_name, c.company_name, s.description,
        s.features_list, s.slogan, s.industry_category, array_to_string(c.tech_tags, ',')]) v
      WHERE position(t.keyword IN lower(coalesce(v, ''))) > 0
    ))
)
SELECT t.test_no, count(DISTINCT m.company_key) AS company_groups,
       count(m.solution_id) AS solutions,
       count(*) FILTER (WHERE m.record_status LIKE '疑似%') AS suspected_solutions
FROM cases t LEFT JOIN matched m ON m.test_no = t.test_no
GROUP BY t.test_no ORDER BY t.test_no;

-- 07 用途：找出有有效方案且 capital 為 NULL 或 0 的詳情驗證候選。
SELECT s.solution_id, c.company_id, c.capital
FROM public.companies c JOIN public.solutions s ON s.company_id = c.company_id
WHERE (s.record_status IS NULL OR s.record_status NOT LIKE '已下架%')
  AND (c.capital IS NULL OR c.capital = 0)
ORDER BY c.capital NULLS FIRST, s.solution_id
LIMIT 10;

-- 08 用途：PPC 補資料之後重跑，與 01 比較即時涵蓋率。
-- 此查詢與新 sf_capital_coverage 的 aggregate 相同，不需要先部署 RPC。
SELECT now() AS verified_at, count(capital) AS with_capital,
       count(*) AS total_companies,
       round(100.0 * count(capital) / nullif(count(*), 0), 2) AS percentage
FROM public.companies;

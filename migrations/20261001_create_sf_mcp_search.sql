-- ============================================================
-- SF MCP v1.0 搜尋與資料現況函式
-- 日期：2026-10-01　設計文件：SF_MCP設計評估_定案範圍_2026-10-01.md
--
-- sf_search_solutions：移植自 public/index.html 的篩選與評分邏輯
--   （filteredResults / getRelevanceScore / getIndustryScore / detectIndustryKey）。
--   以首頁自身程式碼為標準答案做對照測試，28 項案例全數一致（見 sf_search_parity_gen_test.js）。
--   與首頁已知的差異：
--     1. 平手時以 solution_id 排序（首頁以 API 回傳順序，Supabase 未指定順序）
--     2. 不移植 industry_vertical 篩選（api/solutions.js 將 iv 寫死為空字串，該篩選休眠）
--     3. 不移植 name_az / company_az 排序（中文排序規則在資料庫與瀏覽器不同，價值低）
--     4. 比對沿用完整 description（與首頁一致），但函式只回傳 description_short，不回傳完整描述
-- 三個函式皆為 SECURITY INVOKER，受 RLS 與 sf_mcp_ok() 白名單約束；僅 authenticated 可執行。
-- 若首頁的篩選或評分邏輯改動，必須同步修改本函式並重跑對照測試。
-- ============================================================

CREATE OR REPLACE FUNCTION public.sf_search_solutions(
  p_keyword text default null,
  p_query_text text default null,
  p_industry_keyword text default null,
  p_region text[] default null,
  p_is_ai boolean default null,
  p_is_startup boolean default null,
  p_is_gov boolean default null,
  p_pricing_model text default null,
  p_category text[] default null,
  p_program text[] default null,
  p_max_price numeric default null,
  p_include_delisted boolean default false,
  p_sort text default 'relevance',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  solution_id text, solution_name text, company_id text, company_name text, program_type text,
  industry_category text, region text, has_ai boolean, is_startup boolean, is_gov boolean,
  price integer, monthly_price integer, pricing_model text[], slogan text, description_short text,
  record_status text, score integer, total_matches bigint
)
language sql stable security invoker
set search_path = public, pg_temp
as $fn$
with params as (
  select lower(nullif(p_keyword,'')) as kw,
         lower(coalesce(nullif(p_query_text,''), nullif(p_keyword,''))) as src,
         nullif(p_industry_keyword,'') as ikw
),
ind as (
  select a.industry
  from params p
  join (values
    (1,'金融','金融'),(1,'金融','銀行'),(1,'金融','保險'),(1,'金融','證券'),(1,'金融','金控'),
    (2,'製造','製造'),(2,'製造','工廠'),(2,'製造','工業'),(2,'製造','產線'),(2,'製造','智慧製造'),
    (3,'餐飲','餐飲'),(3,'餐飲','餐廳'),(3,'餐飲','飲料'),(3,'餐飲','咖啡'),(3,'餐飲','外送'),
    (4,'醫療','醫療'),(4,'醫療','診所'),(4,'醫療','醫院'),(4,'醫療','照護'),(4,'醫療','長照'),
    (5,'零售電商','零售'),(5,'零售電商','電商'),(5,'零售電商','網購'),(5,'零售電商','門市'),(5,'零售電商','商店'),
    (6,'物流','物流'),(6,'物流','倉儲'),(6,'物流','配送'),(6,'物流','運輸'),(6,'物流','車隊'),
    (7,'教育','教育'),(7,'教育','學校'),(7,'教育','教學'),(7,'教育','補習'),(7,'教育','課程'),
    (8,'旅遊','旅遊'),(8,'旅遊','旅宿'),(8,'旅遊','住宿'),(8,'旅遊','觀光'),(8,'旅遊','飯店')
  ) as a(ord, industry, alias) on p.src is not null and position(lower(a.alias) in p.src) > 0
  order by a.ord
  limit 1
),
terms as (
  select * from (values
    ('金融','法遵'),('金融','合規'),('金融','金融'),('金融','個資法'),('金融','金管會'),('金融','洗錢'),('金融','KYC'),('金融','銀行'),('金融','保險'),
    ('製造','工控'),('製造','OT'),('製造','工廠'),('製造','製造'),('製造','產線'),('製造','SCADA'),('製造','PLC'),('製造','機台'),
    ('餐飲','POS'),('餐飲','餐飲'),('餐飲','門市'),('餐飲','收銀'),('餐飲','點餐'),('餐飲','外送'),('餐飲','訂位'),
    ('醫療','醫療'),('醫療','病歷'),('醫療','診所'),('醫療','醫院'),('醫療','長照'),('醫療','健保'),
    ('零售電商','電商'),('零售電商','零售'),('零售電商','網購'),('零售電商','購物車'),('零售電商','會員'),('零售電商','門市'),('零售電商','上架'),
    ('物流','物流'),('物流','倉儲'),('物流','配送'),('物流','車隊'),('物流','運輸'),
    ('教育','教育'),('教育','教學'),('教育','學校'),('教育','課程'),('教育','補習'),('教育','學習'),
    ('旅遊','旅遊'),('旅遊','住宿'),('旅遊','訂房'),('旅遊','旅宿'),('旅遊','觀光'),('旅遊','飯店')
  ) as t(industry, term)
),
base as (
  select s.solution_id, s.solution_name, s.company_id, c.company_name, s.program_type, s.industry_category,
         c.region as co_region, coalesce(s.has_ai,false) as has_ai, coalesce(c.is_startup,false) as is_startup,
         (s.company_id is not null and exists (select 1 from gov_registrations g where g.company_id = s.company_id)) as is_gov,
         s.price, s.monthly_price, s.pricing_model, s.slogan, s.description_short, s.record_status,
         lower(coalesce(s.solution_name,'')) as l_s,
         lower(coalesce(c.company_name,'')) as l_c,
         lower(coalesce(s.industry_category,'')) as l_cat,
         lower(coalesce(s.slogan,'')) as l_slogan,
         lower(coalesce(s.description,'')) as l_desc,
         lower(coalesce(s.features_list,'')) as l_feat,
         lower(coalesce(array_to_string(c.tech_tags, ','),'')) as l_tags,
         lower(coalesce(array_to_string(s.target_industry, ','),'')) as l_d,
         coalesce(array_to_string(s.target_industry, ','),'') as d_raw
  from solutions s
  left join companies c on c.company_id = s.company_id
  where (p_include_delisted or s.record_status is null or s.record_status not like '已下架%')
    and (p_region is null or cardinality(p_region) = 0 or coalesce(c.region,'') = any(p_region))
    and (p_is_ai is null or coalesce(s.has_ai,false) = p_is_ai)
    and (p_is_startup is null or coalesce(c.is_startup,false) = p_is_startup)
    and (p_is_gov is null or (s.company_id is not null and exists (select 1 from gov_registrations g where g.company_id = s.company_id)) = p_is_gov)
    and (p_pricing_model is null or p_pricing_model = any(coalesce(s.pricing_model, '{}'::text[])))
    and (p_category is null or cardinality(p_category) = 0
         or exists (select 1 from unnest(p_category) x where coalesce(s.industry_category,'') <> '' and position(x in s.industry_category) > 0))
    and (p_program is null or cardinality(p_program) = 0 or coalesce(s.program_type,'') = any(p_program))
    and (coalesce(p_max_price,0) = 0 or (nullif(s.price,0) is not null and s.price <= p_max_price))
),
filtered as (
  select b.* from base b cross join params p
  where p.kw is null
     or position(p.kw in b.l_s) > 0 or position(p.kw in b.l_c) > 0 or position(p.kw in b.l_desc) > 0
     or position(p.kw in b.l_feat) > 0 or position(p.kw in b.l_slogan) > 0 or position(p.kw in b.l_cat) > 0
     or position(p.kw in b.l_tags) > 0
),
scored as (
  select f.*,
    case when p.kw is null then 0 else
        (case when position(p.kw in f.l_s) > 0 then 100 else 0 end)
      + (case when position(p.kw in f.l_c) > 0 then 80 else 0 end)
      + (case when position(p.kw in f.l_cat) > 0 then 70 else 0 end)
      + (case when position(p.kw in f.l_slogan) > 0 then 40 else 0 end)
      + (case when position(p.kw in f.l_desc) > 0 then 30 else 0 end)
      + (case when position(p.kw in f.l_feat) > 0 then 20 else 0 end)
      + (case when position(p.kw in f.l_tags) > 0 then 10 else 0 end)
    end as rel,
    coalesce((
      select sum(case when position(lower(t.term) in (f.l_desc || ' ' || f.l_feat || ' ' || f.l_d || ' ' || '' || ' ' || f.l_cat || ' ' || f.l_tags || ' ' || f.l_slogan)) > 0 then 12 else 0 end)
      from terms t where t.industry = (select industry from ind)
    ), 0) as ind_score,
    case when p.ikw is not null and position(p.ikw in f.d_raw) > 0 then 50 else 0 end as ik_score
  from filtered f cross join params p
),
ranked as (
  select s2.*,
    case when p_sort = 'relevance' and (p.kw is not null or p.ikw is not null)
         then s2.rel + s2.ind_score + s2.ik_score else 0 end as sc,
    nullif(s2.price, 0) as pr
  from scored s2 cross join params p
)
select r.solution_id, r.solution_name, r.company_id, r.company_name, r.program_type, r.industry_category,
       r.co_region, r.has_ai, r.is_startup, r.is_gov, r.price, r.monthly_price, r.pricing_model,
       r.slogan, r.description_short, r.record_status, r.sc::integer, count(*) over ()
from ranked r
order by
  case when p_sort = 'price_asc' then r.pr end asc nulls last,
  case when p_sort = 'price_desc' then r.pr end desc nulls last,
  r.sc desc,
  r.solution_id
limit least(greatest(coalesce(p_limit,20),1),50)
offset greatest(coalesce(p_offset,0),0)
$fn$
;

COMMENT ON FUNCTION public.sf_search_solutions IS 'SF MCP 搜尋：移植自 public/index.html 篩選與評分邏輯（28 項對照測試與首頁程式碼結果一致）。SECURITY INVOKER；僅 authenticated 可執行。';

CREATE OR REPLACE FUNCTION public.sf_data_status()
RETURNS TABLE (program_type text, normal_count bigint, suspected_count bigint, delisted_count bigint, total_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  select coalesce(s.program_type, '(未分類)'),
         count(*) - count(*) filter (where s.record_status like '疑似%') - count(*) filter (where s.record_status like '已下架%'),
         count(*) filter (where s.record_status like '疑似%'),
         count(*) filter (where s.record_status like '已下架%'),
         count(*)
  from solutions s group by 1 order by 5 desc
$$;

CREATE OR REPLACE FUNCTION public.sf_data_coverage()
RETURNS TABLE (active_solutions bigint, company_region_missing bigint, service_region_missing bigint, price_missing bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  select count(*),
         count(*) filter (where coalesce(c.region,'') = ''),
         count(*) filter (where s.service_region is null or cardinality(s.service_region) = 0),
         count(*) filter (where nullif(s.price,0) is null)
  from solutions s left join companies c on c.company_id = s.company_id
  where s.record_status is null or s.record_status not like '已下架%'
$$;

REVOKE ALL ON FUNCTION public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.sf_data_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_data_coverage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_data_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_data_coverage() TO authenticated;

-- v1.0.2：非正常狀態（疑似已下架／已下架）的原因分布，讓 data_status 能引用實際原因，避免 Claude 自行推測
CREATE OR REPLACE FUNCTION public.sf_status_reasons()
RETURNS TABLE (program_type text, status_reason text, record_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  select coalesce(s.program_type, '(未分類)'), s.record_status, count(*)
  from solutions s
  where s.record_status like '疑似%' or s.record_status like '已下架%'
  group by 1, 2
  order by 3 desc, 1
$$;
REVOKE ALL ON FUNCTION public.sf_status_reasons() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_status_reasons() TO authenticated;

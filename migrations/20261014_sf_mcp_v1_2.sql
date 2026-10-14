-- ============================================================
-- SF MCP v1.2 資料庫變更（G：篩選→計數→截斷移到資料庫；F：用量與限流紀錄）
-- 日期：2026-10-14
-- 執行：PPC 於 Supabase SQL Editor 一次執行整份檔案（單一交易、內含自檢；任一檢查失敗即整份撤銷）
--
-- 內容：
--   1. sf_private.sf_ranked：關鍵字篩選＋評分排序的「唯一實作」，回傳全部結果（不截斷），附排名 rn 與公司縣市。
--      本體逐字沿用 sf_search_solutions（20261001），只多帶出 c.city；放在 API 不開放的 schema，使用者無法直接呼叫。
--   2. public.sf_search_solutions：改為 sf_ranked 的外層。新增 p_cities（放在最後、預設 null），
--      縣市篩選與總數在資料庫完成；p_cities 為空時，原 18 欄結果與舊版逐列相同（交易內自檢）。
--      新增 p_normal_only（預設 false；true 時排除疑似已下架與已下架，供「推薦只列正常」使用，計數同樣在全部結果上計算）。
--      新增回傳欄 company_city、suspected_total（全部結果中的疑似筆數）、city_unknown_count（帶縣市時，縣市未填而無法判斷的筆數）。
--      參數名稱與舊版相同，v1.1 Edge Function 不帶 p_cities 呼叫仍可運作（向下相容，可先於 Edge Function 部署）。
--   3. public.sf_search_companies（新）：依公司分組，公司總數、方案總數在全部結果上計算，最後才依 limit/offset 截斷公司清單；
--      每家附最多 5 筆方案（jsonb）。一律至少回傳一列，讓 Edge Function 在任何 offset 都拿得到總數（無公司時公司欄位為 null）。
--   4. public.sf_mcp_usage＋public.sf_mcp_touch()：最後使用時間與每分鐘呼叫次數（固定視窗，上限 30）。
--      資料表不開放任何直接讀寫；只能透過 SECURITY DEFINER 函式更新「目前登入者自己那一列」。
--
-- 執行前提：線上 sf_search_solutions 定義雜湊須為 43b3ed96047bc2ce106de4ce08075aa5（2026-10-14 匯出比對，與 repo 20261001 一致）。
-- ============================================================

begin;

-- ---------- 0. 前置檢查 ----------
do $pre$
begin
  if md5(pg_get_functiondef('public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer)'::regprocedure)) <> '43b3ed96047bc2ce106de4ce08075aa5' then
    raise exception '前置檢查失敗：線上 sf_search_solutions 定義與 10/14 匯出版本不同，已中止';
  end if;
  if to_regclass('public.sf_mcp_usage') is not null then
    raise exception '前置檢查失敗：public.sf_mcp_usage 已存在，已中止';
  end if;
end $pre$;

-- ---------- 1. 以舊函式建立對照基準（交易結束即丟棄）----------
create temp table v12_old on commit drop as
select 1 as c, t.* from public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>0) with ordinality as t
union all
select 2 as c, t.* from public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>50) with ordinality as t
union all
select 3 as c, t.* from public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>400) with ordinality as t
union all
select 4 as c, t.* from public.sf_search_solutions(p_keyword=>'pos', p_query_text=>'餐飲業 POS', p_limit=>50) with ordinality as t
union all
select 5 as c, t.* from public.sf_search_solutions(p_keyword=>'客服', p_industry_keyword=>'金融', p_limit=>50) with ordinality as t
union all
select 6 as c, t.* from public.sf_search_solutions(p_sort=>'price_asc', p_limit=>50) with ordinality as t
union all
select 7 as c, t.* from public.sf_search_solutions(p_sort=>'price_desc', p_region=>array['北部'], p_limit=>50) with ordinality as t
union all
select 8 as c, t.* from public.sf_search_solutions(p_keyword=>'ai', p_include_delisted=>true, p_is_ai=>true, p_limit=>50, p_offset=>100) with ordinality as t
union all
select 9 as c, t.* from public.sf_search_solutions(p_category=>array['銷售管理'], p_program=>array['臺灣雲市集'], p_max_price=>3000, p_limit=>50) with ordinality as t
union all
select 10 as c, t.* from public.sf_search_solutions(p_keyword=>'系統', p_is_startup=>true, p_is_gov=>false, p_limit=>20) with ordinality as t;

create temp table v12_city_expect on commit drop as
select 1 as c,
       count(*) as sol_n,
       count(distinct coalesce(t.company_id, '__no_company__:'||t.solution_id)) as co_n,
       count(*) filter (where t.record_status like '疑似%') as sus_n
from generate_series(0, 5000, 50) o
cross join lateral public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>o) t
left join public.companies c on c.company_id = t.company_id
where replace(coalesce(c.city,''),'台','臺') = any(array['臺北市'])
union all
select 2 as c,
       count(*) as sol_n,
       count(distinct coalesce(t.company_id, '__no_company__:'||t.solution_id)) as co_n,
       count(*) filter (where t.record_status like '疑似%') as sus_n
from generate_series(0, 5000, 50) o
cross join lateral public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>o) t
left join public.companies c on c.company_id = t.company_id
where replace(coalesce(c.city,''),'台','臺') = any(array['臺中市','高雄市'])
union all
select 3 as c,
       count(*) as sol_n,
       count(distinct coalesce(t.company_id, '__no_company__:'||t.solution_id)) as co_n,
       count(*) filter (where t.record_status like '疑似%') as sus_n
from generate_series(0, 5000, 50) o
cross join lateral public.sf_search_solutions(p_limit=>50, p_offset=>o) t
left join public.companies c on c.company_id = t.company_id
where replace(coalesce(c.city,''),'台','臺') = any(array['臺北市'])
union all
select 4 as c,
       count(*) as sol_n,
       count(distinct coalesce(t.company_id, '__no_company__:'||t.solution_id)) as co_n,
       count(*) filter (where t.record_status like '疑似%') as sus_n
from generate_series(0, 5000, 50) o
cross join lateral public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>o) t
left join public.companies c on c.company_id = t.company_id
where true
union all
select 5 as c,
       count(*) as sol_n,
       count(distinct coalesce(t.company_id, '__no_company__:'||t.solution_id)) as co_n,
       count(*) filter (where t.record_status like '疑似%') as sus_n
from generate_series(0, 5000, 50) o
cross join lateral public.sf_search_solutions(p_limit=>50, p_offset=>o) t
left join public.companies c on c.company_id = t.company_id
where true;

-- ---------- 2. 內部 schema 與排名函式 ----------
create schema if not exists sf_private;
revoke all on schema sf_private from public, anon;
grant usage on schema sf_private to authenticated;
comment on schema sf_private is 'SF MCP 內部函式；不在 API 公開的 schema 清單中，使用者無法透過 REST／RPC 直接呼叫。';

create function sf_private.sf_ranked(
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
  p_normal_only boolean default false
)
returns table (
  rn bigint, solution_id text, solution_name text, company_id text, company_name text, program_type text,
  industry_category text, region text, has_ai boolean, is_startup boolean, is_gov boolean,
  price integer, monthly_price integer, pricing_model text[], slogan text, description_short text,
  record_status text, score integer, company_city text
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
         c.region as co_region, c.city as co_city, coalesce(s.has_ai,false) as has_ai, coalesce(c.is_startup,false) as is_startup,
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
    and (not coalesce(p_normal_only, false) or s.record_status is null
         or (s.record_status not like '疑似%' and s.record_status not like '已下架%'))
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
select row_number() over (
         order by
           case when p_sort = 'price_asc' then r.pr end asc nulls last,
           case when p_sort = 'price_desc' then r.pr end desc nulls last,
           r.sc desc,
           r.solution_id
       ),
       r.solution_id, r.solution_name, r.company_id, r.company_name, r.program_type, r.industry_category,
       r.co_region, r.has_ai, r.is_startup, r.is_gov, r.price, r.monthly_price, r.pricing_model,
       r.slogan, r.description_short, r.record_status, r.sc::integer, r.co_city
from ranked r
$fn$;
comment on function sf_private.sf_ranked is 'SF MCP 搜尋的唯一評分實作（移植自 public/index.html，見 20261001）。回傳全部結果與排名 rn，不截斷。若首頁篩選或評分邏輯改動，須同步修改並重跑對照測試。';
revoke all on function sf_private.sf_ranked(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,boolean) from public, anon;
grant execute on function sf_private.sf_ranked(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,boolean) to authenticated;

-- ---------- 3. sf_search_solutions：篩選 → 計數 → 截斷 ----------
drop function public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer);

create function public.sf_search_solutions(
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
  p_offset integer default 0,
  p_cities text[] default null,
  p_normal_only boolean default false
)
returns table (
  solution_id text, solution_name text, company_id text, company_name text, program_type text,
  industry_category text, region text, has_ai boolean, is_startup boolean, is_gov boolean,
  price integer, monthly_price integer, pricing_model text[], slogan text, description_short text,
  record_status text, score integer, total_matches bigint,
  company_city text, suspected_total bigint, city_unknown_count bigint
)
language sql stable security invoker
set search_path = public, pg_temp
as $fn$
with r as (
  select * from sf_private.sf_ranked(p_keyword, p_query_text, p_industry_keyword, p_region, p_is_ai, p_is_startup, p_is_gov, p_pricing_model, p_category, p_program, p_max_price, p_include_delisted, p_sort, p_normal_only)
),
w as (
  select array_agg(distinct replace(btrim(x), '台', '臺')) as cs
  from unnest(coalesce(p_cities, '{}'::text[])) as x
  where btrim(x) <> ''
),
f as (
  select r.* from r cross join w
  where w.cs is null or replace(coalesce(r.company_city, ''), '台', '臺') = any(w.cs)
),
u as (
  select count(*) as n from r cross join w
  where w.cs is not null and btrim(coalesce(r.company_city, '')) = ''
)
select f.solution_id, f.solution_name, f.company_id, f.company_name, f.program_type, f.industry_category,
       f.region, f.has_ai, f.is_startup, f.is_gov, f.price, f.monthly_price, f.pricing_model,
       f.slogan, f.description_short, f.record_status, f.score,
       count(*) over (),
       f.company_city,
       count(*) filter (where f.record_status like '疑似%') over (),
       (select n from u)
from f
order by f.rn
limit least(greatest(coalesce(p_limit, 20), 1), 50)
offset greatest(coalesce(p_offset, 0), 0)
$fn$;
comment on function public.sf_search_solutions is 'SF MCP 搜尋（v1.2）：sf_private.sf_ranked 的外層。縣市篩選與總數（total_matches、suspected_total）在全部結果上計算，最後才截斷明細。p_cities 台／臺視為相同。SECURITY INVOKER；僅 authenticated 可執行。';
revoke all on function public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean) from public, anon;
grant execute on function public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean) to authenticated;

-- ---------- 4. sf_search_companies：依公司分組，總數在全部結果上計算 ----------
create function public.sf_search_companies(
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
  p_offset integer default 0,
  p_cities text[] default null,
  p_normal_only boolean default false
)
returns table (
  company_key text, company_id text, company_name text, company_city text, company_region text,
  first_rank bigint, solutions_count bigint, suspected_count bigint, solutions jsonb,
  companies_total bigint, solutions_total bigint, suspected_total bigint, city_unknown_count bigint
)
language sql stable security invoker
set search_path = public, pg_temp
as $fn$
with r as (
  select * from sf_private.sf_ranked(p_keyword, p_query_text, p_industry_keyword, p_region, p_is_ai, p_is_startup, p_is_gov, p_pricing_model, p_category, p_program, p_max_price, p_include_delisted, p_sort, p_normal_only)
),
w as (
  select array_agg(distinct replace(btrim(x), '台', '臺')) as cs
  from unnest(coalesce(p_cities, '{}'::text[])) as x
  where btrim(x) <> ''
),
f as (
  select r.*, coalesce(r.company_id, '__no_company__:' || r.solution_id) as k
  from r cross join w
  where w.cs is null or replace(coalesce(r.company_city, ''), '台', '臺') = any(w.cs)
),
u as (
  select count(*) as n from r cross join w
  where w.cs is not null and btrim(coalesce(r.company_city, '')) = ''
),
g as (
  select k, min(rn) as first_rank, count(*) as n,
         count(*) filter (where record_status like '疑似%') as sus
  from f group by k
),
tot as (
  select (select count(*) from g) as companies_total,
         (select count(*) from f) as solutions_total,
         (select count(*) from f where record_status like '疑似%') as suspected_total,
         (select n from u) as city_unknown_count
),
pg as (
  select * from g
  order by first_rank
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
)
select p.k, p.company_id, p.company_name, p.company_city, p.region,
       p.first_rank, p.n, p.sus, p.solutions,
       tot.companies_total, tot.solutions_total, tot.suspected_total, tot.city_unknown_count
from tot
left join lateral (
  select pg.k, pg.first_rank, pg.n, pg.sus, fx.company_id, fx.company_name, fx.company_city, fx.region,
         (select jsonb_agg(jsonb_build_object(
                   'id', s.solution_id, 'name', s.solution_name, 'source', s.program_type,
                   'price', s.price, 'pricing_model', s.pricing_model,
                   'status', s.record_status, 'score', s.score) order by s.rn)
            from (select * from f f2 where f2.k = pg.k order by f2.rn limit 5) s) as solutions
  from pg
  join lateral (select * from f f1 where f1.k = pg.k order by f1.rn limit 1) fx on true
) p on true
order by p.first_rank nulls last
$fn$;
comment on function public.sf_search_companies is 'SF MCP 依廠商搜尋（v1.2）：公司總數、方案總數、疑似總數在全部結果上計算，最後才截斷公司清單；每家附最多 5 筆方案。沒有公司編號的方案各自成一組（company_key 以 __no_company__: 開頭）。一律至少回傳一列（無公司時公司欄位為 null）。SECURITY INVOKER；僅 authenticated 可執行。';
revoke all on function public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean) from public, anon;
grant execute on function public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean) to authenticated;

-- ---------- 5. 用量紀錄：最後使用時間＋每分鐘呼叫次數 ----------
create table public.sf_mcp_usage (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  first_used_at      timestamptz not null default now(),
  last_used_at       timestamptz not null default now(),
  total_calls        bigint      not null default 0,
  window_start       timestamptz not null default date_trunc('minute', now()),
  window_calls       integer     not null default 0,
  max_window_calls   integer     not null default 0,
  over_limit_calls   bigint      not null default 0,
  last_over_limit_at timestamptz
);
comment on table public.sf_mcp_usage is 'SF MCP 每位使用者的用量：最後使用時間（季度檢視停用帳號用）與每分鐘呼叫次數（固定視窗，上限 30）。不開放任何直接讀寫，只能透過 sf_mcp_touch() 更新自己那一列；查看請用 SQL Editor。';
alter table public.sf_mcp_usage enable row level security;
revoke all on public.sf_mcp_usage from public, anon, authenticated;

create function public.sf_mcp_touch()
returns table (window_calls integer, limit_per_minute integer, over_limit boolean)
language plpgsql volatile security definer
set search_path = public, pg_temp
as $fn$
declare
  c_limit constant integer := 30;
  v_uid   uuid := auth.uid();
  v_now   timestamptz := now();
  v_min   timestamptz := date_trunc('minute', now());
  v_calls integer;
begin
  if v_uid is null or not public.sf_mcp_ok() then
    raise exception 'sf_mcp_touch: 未授權' using errcode = '42501';
  end if;
  insert into public.sf_mcp_usage as m
         (user_id, first_used_at, last_used_at, total_calls, window_start, window_calls, max_window_calls)
  values (v_uid, v_now, v_now, 1, v_min, 1, 1)
  on conflict (user_id) do update set
    last_used_at       = v_now,
    total_calls        = m.total_calls + 1,
    window_start       = v_min,
    window_calls       = case when m.window_start = v_min then m.window_calls + 1 else 1 end,
    max_window_calls   = greatest(m.max_window_calls, case when m.window_start = v_min then m.window_calls + 1 else 1 end),
    over_limit_calls   = m.over_limit_calls + case when m.window_start = v_min and m.window_calls + 1 > c_limit then 1 else 0 end,
    last_over_limit_at = case when m.window_start = v_min and m.window_calls + 1 > c_limit then v_now else m.last_over_limit_at end
  returning m.window_calls into v_calls;
  return query select v_calls, c_limit, v_calls > c_limit;
end
$fn$;
comment on function public.sf_mcp_touch is 'SF MCP 每次工具呼叫時由 Edge Function 呼叫：更新目前登入者的最後使用時間與本分鐘呼叫次數，回傳是否超過每分鐘 30 次。SECURITY DEFINER，只寫入 auth.uid() 自己那一列；非白名單使用者會被拒絕。上限寫死在函式內，呼叫端無法更改。';
revoke all on function public.sf_mcp_touch() from public, anon;
grant execute on function public.sf_mcp_touch() to authenticated;

-- ---------- 6. 交易內自檢 ----------
create temp table v12_new on commit drop as
select 1 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>0)) as t
union all
select 2 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>50)) as t
union all
select 3 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_keyword=>'ai', p_limit=>50, p_offset=>400)) as t
union all
select 4 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_keyword=>'pos', p_query_text=>'餐飲業 POS', p_limit=>50)) as t
union all
select 5 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_keyword=>'客服', p_industry_keyword=>'金融', p_limit=>50)) as t
union all
select 6 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_sort=>'price_asc', p_limit=>50)) as t
union all
select 7 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_sort=>'price_desc', p_region=>array['北部'], p_limit=>50)) as t
union all
select 8 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_keyword=>'ai', p_include_delisted=>true, p_is_ai=>true, p_limit=>50, p_offset=>100)) as t
union all
select 9 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_category=>array['銷售管理'], p_program=>array['臺灣雲市集'], p_max_price=>3000, p_limit=>50)) as t
union all
select 10 as c, t.*, row_number() over () as ordinality from (select solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches from public.sf_search_solutions(p_keyword=>'系統', p_is_startup=>true, p_is_gov=>false, p_limit=>20)) as t;

do $chk$
declare
  n_old bigint; n_new bigint; n_diff bigint;
  e record; a_sol bigint; a_sus bigint; a_co bigint; a_sol2 bigint;
  v_rows bigint;
begin
  -- 6a. 對照：p_cities 為空時，新版 18 欄結果與舊版逐列相同（含順序）
  select count(*) into n_old from v12_old;
  select count(*) into n_new from v12_new;
  select count(*) into n_diff from (
    (select * from v12_old except all select * from v12_new)
    union all
    (select * from v12_new except all select * from v12_old)
  ) d;
  if n_old = 0 or n_old <> n_new or n_diff <> 0 then
    raise exception '自檢失敗：新舊版結果不同（舊 % 列、新 % 列、差異 % 列）', n_old, n_new, n_diff;
  end if;

  -- 6b. 計數：與「用舊函式翻完全部頁面再依縣市過濾」的結果相同
  select sol_n, co_n, sus_n into e from v12_city_expect where c = 1;
  select max(total_matches), max(suspected_total) into a_sol, a_sus from public.sf_search_solutions(p_keyword=>'ai', p_cities=>array['臺北市'], p_limit=>1);
  select max(companies_total), max(solutions_total) into a_co, a_sol2 from public.sf_search_companies(p_keyword=>'ai', p_cities=>array['臺北市'], p_limit=>1);
  if coalesce(a_sol,0) <> e.sol_n or coalesce(a_sus,0) <> e.sus_n or a_co <> e.co_n or a_sol2 <> e.sol_n then
    raise exception '自檢失敗：計數案例 % 預期 方案%／疑似%／公司%，實際 方案%／疑似%／公司%／分組方案%', 1, e.sol_n, e.sus_n, e.co_n, a_sol, a_sus, a_co, a_sol2;
  end if;
  select sol_n, co_n, sus_n into e from v12_city_expect where c = 2;
  select max(total_matches), max(suspected_total) into a_sol, a_sus from public.sf_search_solutions(p_keyword=>'ai', p_cities=>array['台中市','高雄市'], p_limit=>1);
  select max(companies_total), max(solutions_total) into a_co, a_sol2 from public.sf_search_companies(p_keyword=>'ai', p_cities=>array['台中市','高雄市'], p_limit=>1);
  if coalesce(a_sol,0) <> e.sol_n or coalesce(a_sus,0) <> e.sus_n or a_co <> e.co_n or a_sol2 <> e.sol_n then
    raise exception '自檢失敗：計數案例 % 預期 方案%／疑似%／公司%，實際 方案%／疑似%／公司%／分組方案%', 2, e.sol_n, e.sus_n, e.co_n, a_sol, a_sus, a_co, a_sol2;
  end if;
  select sol_n, co_n, sus_n into e from v12_city_expect where c = 3;
  select max(total_matches), max(suspected_total) into a_sol, a_sus from public.sf_search_solutions(p_cities=>array['臺北市'], p_limit=>1);
  select max(companies_total), max(solutions_total) into a_co, a_sol2 from public.sf_search_companies(p_cities=>array['臺北市'], p_limit=>1);
  if coalesce(a_sol,0) <> e.sol_n or coalesce(a_sus,0) <> e.sus_n or a_co <> e.co_n or a_sol2 <> e.sol_n then
    raise exception '自檢失敗：計數案例 % 預期 方案%／疑似%／公司%，實際 方案%／疑似%／公司%／分組方案%', 3, e.sol_n, e.sus_n, e.co_n, a_sol, a_sus, a_co, a_sol2;
  end if;
  select sol_n, co_n, sus_n into e from v12_city_expect where c = 4;
  select max(total_matches), max(suspected_total) into a_sol, a_sus from public.sf_search_solutions(p_keyword=>'ai', p_cities=>null, p_limit=>1);
  select max(companies_total), max(solutions_total) into a_co, a_sol2 from public.sf_search_companies(p_keyword=>'ai', p_cities=>null, p_limit=>1);
  if coalesce(a_sol,0) <> e.sol_n or coalesce(a_sus,0) <> e.sus_n or a_co <> e.co_n or a_sol2 <> e.sol_n then
    raise exception '自檢失敗：計數案例 % 預期 方案%／疑似%／公司%，實際 方案%／疑似%／公司%／分組方案%', 4, e.sol_n, e.sus_n, e.co_n, a_sol, a_sus, a_co, a_sol2;
  end if;
  select sol_n, co_n, sus_n into e from v12_city_expect where c = 5;
  select max(total_matches), max(suspected_total) into a_sol, a_sus from public.sf_search_solutions(p_cities=>null, p_limit=>1);
  select max(companies_total), max(solutions_total) into a_co, a_sol2 from public.sf_search_companies(p_cities=>null, p_limit=>1);
  if coalesce(a_sol,0) <> e.sol_n or coalesce(a_sus,0) <> e.sus_n or a_co <> e.co_n or a_sol2 <> e.sol_n then
    raise exception '自檢失敗：計數案例 % 預期 方案%／疑似%／公司%，實際 方案%／疑似%／公司%／分組方案%', 5, e.sol_n, e.sus_n, e.co_n, a_sol, a_sus, a_co, a_sol2;
  end if;

  -- 6b-2. p_normal_only：總數＝舊函式全部頁面中非疑似的筆數，且疑似總數為 0
  select sol_n - sus_n into a_sol from v12_city_expect where c = 4;
  select max(total_matches), max(suspected_total) into a_sol2, a_sus from public.sf_search_solutions(p_keyword=>'ai', p_normal_only=>true, p_limit=>1);
  if a_sol2 <> a_sol or a_sus <> 0 then
    raise exception '自檢失敗：p_normal_only 預期 % 筆／疑似 0，實際 % 筆／疑似 %', a_sol, a_sol2, a_sus;
  end if;

  -- 6c. 超出範圍的 offset：sf_search_companies 仍回傳 1 列總數
  select count(*), max(companies_total) into v_rows, a_co from public.sf_search_companies(p_keyword=>'ai', p_offset=>5000);
  select co_n into a_sol from v12_city_expect where c = 4;
  if v_rows <> 1 or a_co <> a_sol then
    raise exception '自檢失敗：offset 超出範圍時應回傳 1 列總數（實際 % 列、公司總數 %）', v_rows, a_co;
  end if;

  -- 6d. 權限
  if has_function_privilege('anon', 'public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean)', 'execute')
     or has_function_privilege('anon', 'public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean)', 'execute')
     or has_function_privilege('anon', 'public.sf_mcp_touch()', 'execute')
     or has_function_privilege('anon', 'sf_private.sf_ranked(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,boolean)', 'execute')
     or has_schema_privilege('anon', 'sf_private', 'usage') then
    raise exception '自檢失敗：anon 具有新函式或 sf_private 的權限';
  end if;
  if not (has_function_privilege('authenticated', 'public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean)', 'execute')
      and has_function_privilege('authenticated', 'public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean)', 'execute')
      and has_function_privilege('authenticated', 'public.sf_mcp_touch()', 'execute')
      and has_function_privilege('authenticated', 'sf_private.sf_ranked(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,boolean)', 'execute')) then
    raise exception '自檢失敗：authenticated 缺少執行權限';
  end if;
  if has_table_privilege('anon', 'public.sf_mcp_usage', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public.sf_mcp_usage', 'select,insert,update,delete') then
    raise exception '自檢失敗：sf_mcp_usage 可被 anon／authenticated 直接讀寫';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.sf_mcp_usage'::regclass) then
    raise exception '自檢失敗：sf_mcp_usage 未啟用 RLS';
  end if;
  if (select count(*) from pg_proc where proname = 'sf_search_solutions' and pronamespace = 'public'::regnamespace) <> 1 then
    raise exception '自檢失敗：sf_search_solutions 不是唯一一個版本';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.sf_mcp_touch()'::regprocedure) is not true
     or (select prosecdef from pg_proc where oid = 'public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean)'::regprocedure) is not false then
    raise exception '自檢失敗：SECURITY DEFINER／INVOKER 設定不符';
  end if;

  raise notice '自檢通過：對照 % 列一致；計數 5 案例＋只列正常一致；權限 OK', n_old;
end $chk$;

commit;

-- ============================================================
-- 交易外獨立驗證（另開查詢執行；Supabase SQL Editor 只顯示最後一段結果，請逐段執行）
-- ============================================================
-- V1. 版本與權限一覽
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as definer,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where (n.nspname = 'public' and p.proname like 'sf\_%') or n.nspname = 'sf_private'
-- order by 1;
-- V2. 組長第 1 題：臺北市含 AI 的方案／廠商總數（以 postgres 身分執行，不受白名單限制）
-- select (select max(total_matches) from public.sf_search_solutions(p_keyword=>'AI', p_cities=>array['台北市'], p_limit=>1)) as 方案數,
--        (select max(companies_total) from public.sf_search_companies(p_keyword=>'AI', p_cities=>array['台北市'], p_limit=>1)) as 廠商數;
-- V3. 用量表：應為空表、RLS 開啟
-- select (select count(*) from public.sf_mcp_usage) as 筆數,
--        (select relrowsecurity from pg_class where oid = 'public.sf_mcp_usage'::regclass) as rls;

-- ============================================================
-- 回滾（需要時另開查詢執行；會恢復舊版 sf_search_solutions 前，請先貼回 20261001 的定義）
-- ============================================================
-- begin;
-- drop function if exists public.sf_mcp_touch();
-- drop table if exists public.sf_mcp_usage;
-- drop function if exists public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean);
-- drop function if exists public.sf_search_solutions(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean);
-- -- 貼回 migrations/20261001_create_sf_mcp_search.sql 的 sf_search_solutions 定義與 REVOKE／GRANT
-- drop function if exists sf_private.sf_ranked(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,boolean);
-- drop schema if exists sf_private;
-- commit;

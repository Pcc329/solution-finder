-- SF MCP v1.3 capital，2026-11-04
-- 部署順序：先執行 migration，再部署 sf-mcp Edge Function。
-- 保留方案分組母體、預設下架條件與 SECURITY INVOKER；不寫入業務資料。
-- 新參數附於尾端且預設 null，舊 Edge Function 仍可在 migration 後呼叫。
-- 交易內刪除舊簽章，避免 PostgREST 在含預設參數的 overload 間歧義。
begin;

drop function public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean);

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
  p_normal_only boolean default false,
  p_min_capital numeric default null,
  p_max_capital numeric default null
)
returns table (
  company_key text, company_id text, company_name text, company_city text, company_region text,
  first_rank bigint, solutions_count bigint, suspected_count bigint, solutions jsonb,
  companies_total bigint, solutions_total bigint, suspected_total bigint, city_unknown_count bigint,
  capital bigint, capital_unknown_count bigint, no_company_count bigint
)
language sql stable security invoker
set search_path = public, pg_temp
as $fn$
with r as (
  select ranked.*, c.capital from sf_private.sf_ranked(p_keyword, p_query_text, p_industry_keyword, p_region, p_is_ai, p_is_startup, p_is_gov, p_pricing_model, p_category, p_program, p_max_price, p_include_delisted, case when p_sort = 'capital_desc' then 'relevance' else p_sort end, p_normal_only) ranked
  left join public.companies c on c.company_id = ranked.company_id
),
w as (
  select array_agg(distinct replace(btrim(x), '台', '臺')) as cs
  from unnest(coalesce(p_cities, '{}'::text[])) as x
  where btrim(x) <> ''
),
city_filtered as (
  select r.*, coalesce(r.company_id, '__no_company__:' || r.solution_id) as k
  from r cross join w
  where w.cs is null or replace(coalesce(r.company_city, ''), '台', '臺') = any(w.cs)
),
f as (
  select * from city_filtered
  where (p_min_capital is null or capital >= p_min_capital)
    and (p_max_capital is null or capital <= p_max_capital)
),
capital_unknown as (
  -- 資本額篩選前，分開計算缺值公司與無公司編號的方案。
  select count(distinct k) filter (where company_id is not null and capital is null) as capital_unknown_count,
         count(distinct k) filter (where company_id is null) as no_company_count
  from city_filtered
  where p_min_capital is not null or p_max_capital is not null
),
u as (
  select count(*) as n from r cross join w
  where w.cs is not null and btrim(coalesce(r.company_city, '')) = ''
    and (p_min_capital is null or r.capital >= p_min_capital)
    and (p_max_capital is null or r.capital <= p_max_capital)
),
g as (
  select k, max(capital) as capital, min(rn) as first_rank, count(*) as n,
         count(*) filter (where record_status like '疑似%') as sus
  from f group by k
),
tot as (
  select (select count(*) from g) as companies_total,
         (select count(*) from f) as solutions_total,
         (select count(*) from f where record_status like '疑似%') as suspected_total,
         (select n from u) as city_unknown_count,
         capital_unknown.capital_unknown_count,
         capital_unknown.no_company_count
  from capital_unknown
),
pg as (
  select * from g
  order by case when p_sort = 'capital_desc' then capital end desc nulls last, first_rank
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
)
select p.k, p.company_id, p.company_name, p.company_city, p.region,
       p.first_rank, p.n, p.sus, p.solutions,
       tot.companies_total, tot.solutions_total, tot.suspected_total, tot.city_unknown_count,
       p.capital, tot.capital_unknown_count, tot.no_company_count
from tot
left join lateral (
  select pg.k, pg.capital, pg.first_rank, pg.n, pg.sus, fx.company_id, fx.company_name, fx.company_city, fx.region,
         (select jsonb_agg(jsonb_build_object(
                   'id', s.solution_id, 'name', s.solution_name, 'source', s.program_type,
                   'price', s.price, 'pricing_model', s.pricing_model,
                   'status', s.record_status, 'score', s.score) order by s.rn)
            from (select * from f f2 where f2.k = pg.k order by f2.rn limit 5) s) as solutions
  from pg
  join lateral (select * from f f1 where f1.k = pg.k order by f1.rn limit 1) fx on true
) p on true
order by case when p_sort = 'capital_desc' then p.capital end desc nulls last, p.first_rank nulls last
$fn$;
comment on function public.sf_search_companies is 'SF MCP 依廠商搜尋（v1.3）：資本額含邊界篩選與 capital_desc NULLS LAST；公司總數、方案總數、疑似總數在全部結果上計算，最後才截斷公司清單；每家附最多 5 筆方案。沒有公司編號的方案各自成一組（company_key 以 __no_company__: 開頭）。一律至少回傳一列（無公司時公司欄位為 null）。SECURITY INVOKER；僅 authenticated 可執行。';
revoke all on function public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean,numeric,numeric) from public, anon;
grant execute on function public.sf_search_companies(text,text,text,text[],boolean,boolean,boolean,text,text[],text[],numeric,boolean,text,integer,integer,text[],boolean,numeric,numeric) to authenticated;

-- 每次呼叫只用同一句 aggregate 取得分子與分母，不建立快取表。
create function public.sf_capital_coverage()
returns table (with_capital bigint, total_companies bigint)
language sql stable security invoker
set search_path = public, pg_temp
as $fn$
  select count(capital), count(*) from public.companies
$fn$;
comment on function public.sf_capital_coverage() is '資本額即時涵蓋率。分子 count(capital)，分母 companies 全表 count(*)；沿用呼叫者 RLS。';
revoke all on function public.sf_capital_coverage() from public, anon;
grant execute on function public.sf_capital_coverage() to authenticated;

commit;

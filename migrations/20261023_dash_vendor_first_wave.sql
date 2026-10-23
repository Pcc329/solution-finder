-- ============================================================
-- 儀表板廠商 View：新增「只計正常方案」欄位（首波／候補分組用）＋修正 NULL 狀態判斷
-- 日期：2026-10-23
-- 執行：PPC 於 Supabase SQL Editor 一次執行整份（單一交易；任一檢查失敗即整份撤銷）
--
-- 內容：
--   1. CREATE OR REPLACE VIEW public.dash_vendor_platforms（不 DROP，保留既有權限與選項）
--      - 既有 13 欄名稱、順序、型別完全不變
--      - 末尾新增 3 欄：n_platforms_normal、n_solutions_normal、n_ai_solutions_normal
--        （只計 record_status 非「疑似%」的方案；已下架原本就排除）
--      - 狀態判斷改為 coalesce(record_status, '')：原寫法 record_status NOT LIKE '已下架%'
--        遇到 NULL 會得到 unknown 而被 WHERE 默默排除（10/23 查詢確認目前 0 筆，結果不變）
--   2. 首波＝n_platforms_normal >= 2 且 n_ai_solutions_normal >= 5
--      候補＝n_platforms >= 2 且 n_ai_solutions >= 5，但不符首波（含疑似下架才達門檻）
-- ============================================================

begin;

do $pre$
declare n int;
begin
  select count(*) into n from information_schema.columns
  where table_schema = 'public' and table_name = 'dash_vendor_platforms'
    and column_name in ('company_id','company_name','city','n_platforms','sme_ai','moea_cloud','startup_select',
                        'smebiz','gov_software','agri','ntpc','n_solutions','n_ai_solutions');
  if n <> 13 then raise exception '前置檢查失敗：View 既有欄位不是預期的 13 欄（找到 %），已中止', n; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dash_vendor_platforms'
             and column_name in ('n_platforms_normal','n_solutions_normal','n_ai_solutions_normal')) then
    raise exception '前置檢查失敗：新欄位已存在，可能已執行過，已中止';
  end if;
end $pre$;

-- 修改前快照：資料、權限、View 選項
create temp table v_before on commit drop as select * from public.dash_vendor_platforms;
create temp table v_meta on commit drop as
select c.relacl::text as acl, coalesce(array_to_string(c.reloptions, ','), '') as opts
from pg_class c where c.oid = 'public.dash_vendor_platforms'::regclass;

create or replace view public.dash_vendor_platforms as
select s.company_id,
       c.company_name,
       c.city,
       count(distinct s.program_type) as n_platforms,
       bool_or(s.program_type = 'SME AI平台') as sme_ai,
       bool_or(s.program_type = '雲市集工業館') as moea_cloud,
       bool_or(s.program_type = '新創嚴選網') as startup_select,
       bool_or(s.program_type = '商業服務業專區') as smebiz,
       bool_or(s.program_type = '政府軟體採購網') as gov_software,
       bool_or(s.program_type = '農業雲市集-數位館') as agri,
       bool_or(s.program_type = '新北產業AI化輔導計畫') as ntpc,
       count(*) as n_solutions,
       count(*) filter (where coalesce(s.ai_label_v2, s.has_ai)) as n_ai_solutions,
       count(distinct s.program_type) filter (where coalesce(s.record_status, '') not like '疑似%') as n_platforms_normal,
       count(*) filter (where coalesce(s.record_status, '') not like '疑似%') as n_solutions_normal,
       count(*) filter (where coalesce(s.record_status, '') not like '疑似%' and coalesce(s.ai_label_v2, s.has_ai)) as n_ai_solutions_normal
from public.solutions s
left join public.companies c on c.company_id = s.company_id
where s.program_type <> all (array['臺灣雲市集', '資策會產業調查', '案例反推補建'])
  and coalesce(s.record_status, '') not like '已下架%'
  and s.company_id is not null and s.company_id <> ''
group by s.company_id, c.company_name, c.city;

-- 若原 View 有選項（例如 security_invoker），重新套用
do $opts$
declare o text;
begin
  select opts into o from v_meta;
  if o <> '' then execute format('alter view public.dash_vendor_platforms set (%s)', o); end if;
end $opts$;

comment on view public.dash_vendor_platforms is
  '儀表板廠商點陣。n_platforms／n_solutions／n_ai_solutions 含疑似下架；*_normal 只計正常方案。首波＝n_platforms_normal>=2 且 n_ai_solutions_normal>=5；候補＝含疑似才達門檻者。2026-10-23';

do $chk$
declare n_diff bigint; n_b bigint; n_a bigint; e_all bigint; e_norm bigint; a_all bigint; a_norm bigint; m record; cur_acl text; cur_opts text;
begin
  -- 1. 既有 13 欄的資料與修改前逐列相同
  select count(*) into n_b from v_before;
  select count(*) into n_a from public.dash_vendor_platforms;
  select count(*) into n_diff from (
    (select * from v_before
     except all
     select company_id, company_name, city, n_platforms, sme_ai, moea_cloud, startup_select, smebiz,
            gov_software, agri, ntpc, n_solutions, n_ai_solutions from public.dash_vendor_platforms)
    union all
    (select company_id, company_name, city, n_platforms, sme_ai, moea_cloud, startup_select, smebiz,
            gov_software, agri, ntpc, n_solutions, n_ai_solutions from public.dash_vendor_platforms
     except all
     select * from v_before)) d;
  if n_b <> n_a or n_diff <> 0 then
    raise exception '自檢失敗：既有欄位資料改變（修改前 % 列、後 % 列、差異 % 列）', n_b, n_a, n_diff;
  end if;

  -- 2. 首波／候補家數與獨立計算相同（直接從 solutions 計算，不經 View）
  with b as (
    select s.company_id, s.program_type, coalesce(s.ai_label_v2, s.has_ai) as ai,
           coalesce(s.record_status, '') like '疑似%' as sus
    from public.solutions s
    where s.program_type <> all (array['臺灣雲市集', '資策會產業調查', '案例反推補建'])
      and coalesce(s.record_status, '') not like '已下架%'
      and s.company_id is not null and s.company_id <> ''),
  g as (
    select company_id, count(distinct program_type) p, count(*) filter (where ai) a,
           count(distinct program_type) filter (where not sus) pn, count(*) filter (where ai and not sus) an
    from b group by company_id)
  select count(*) filter (where p >= 2 and a >= 5), count(*) filter (where pn >= 2 and an >= 5)
    into e_all, e_norm from g;
  select count(*) filter (where n_platforms >= 2 and n_ai_solutions >= 5),
         count(*) filter (where n_platforms_normal >= 2 and n_ai_solutions_normal >= 5)
    into a_all, a_norm from public.dash_vendor_platforms;
  if a_all <> e_all or a_norm <> e_norm then
    raise exception '自檢失敗：首波計算不符（含疑似 View % ／獨立 %；只算正常 View % ／獨立 %）', a_all, e_all, a_norm, e_norm;
  end if;
  if a_norm > a_all then raise exception '自檢失敗：只算正常的首波家數不應多於含疑似'; end if;

  -- 3. 權限與選項不變；anon、authenticated 不可讀
  select * into m from v_meta;
  select c.relacl::text, coalesce(array_to_string(c.reloptions, ','), '') into cur_acl, cur_opts
  from pg_class c where c.oid = 'public.dash_vendor_platforms'::regclass;
  if cur_acl is distinct from m.acl then raise exception '自檢失敗：View 權限改變（前 %，後 %）', m.acl, cur_acl; end if;
  if cur_opts is distinct from m.opts then raise exception '自檢失敗：View 選項改變（前 %，後 %）', m.opts, cur_opts; end if;
  if has_table_privilege('anon', 'public.dash_vendor_platforms', 'select')
     or has_table_privilege('authenticated', 'public.dash_vendor_platforms', 'select') then
    raise exception '自檢失敗：anon 或 authenticated 可讀取 View';
  end if;

  raise notice '自檢通過：既有欄位 % 列一致；首波 含疑似 % ／只算正常 %（候補 %）；權限與選項不變', n_a, a_all, a_norm, a_all - a_norm;
end $chk$;

commit;

-- ============================================================
-- 交易外獨立驗證（另開查詢執行）
-- ============================================================
-- select count(*) filter (where n_platforms_normal >= 2 and n_ai_solutions_normal >= 5) as 首波,
--        count(*) filter (where n_platforms >= 2 and n_ai_solutions >= 5
--                         and not (n_platforms_normal >= 2 and n_ai_solutions_normal >= 5)) as 候補,
--        has_table_privilege('anon', 'public.dash_vendor_platforms', 'select') as anon可讀
-- from public.dash_vendor_platforms;
-- 預期（10/23 資料、SOL-83 執行前）：21、11、false

-- ============================================================
-- 回復：以 CREATE OR REPLACE 無法移除欄位；需要回復時，前端改回使用原欄位即可，新增欄位保留不影響。
-- ============================================================

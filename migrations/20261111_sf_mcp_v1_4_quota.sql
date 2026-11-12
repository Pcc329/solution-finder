-- SF MCP v1.4.0：每帳號每日明細額度、逐工具用量紀錄。
BEGIN;

-- ---------- 1. 前置檢查 ----------
do $$
begin
  if to_regclass('public.sf_mcp_users') is null
     or to_regprocedure('public.sf_mcp_ok()') is null
     or to_regprocedure('public.sf_mcp_touch()') is null then
    raise exception '前置檢查失敗：缺少既有 SF MCP 白名單或用量函式';
  end if;
  if to_regclass('public.sf_mcp_daily_usage') is not null
     or to_regprocedure('public.sf_mcp_quota_check()') is not null
     or to_regprocedure('public.sf_mcp_quota_consume(text,integer)') is not null then
    raise exception '前置檢查失敗：每日用量表或額度函式已存在';
  end if;
end
$$;
lock table public.sf_mcp_users in access exclusive mode;
create temp table sf_mcp_v14_before on commit drop as
select count(*) as users_count from public.sf_mcp_users;

-- ---------- 2. 帳號設定與每日用量 ----------
alter table public.sf_mcp_users
  add column account_type text not null default 'human' check (account_type in ('human','agent')),
  add column daily_limit integer not null default 300 check (daily_limit between 1 and 5000);
comment on column public.sf_mcp_users.account_type is '帳號類型：真人（human）或代理程式（agent）。';
comment on column public.sf_mcp_users.daily_limit is '此帳號每日可取得的方案明細筆數上限，依臺北日期計算。';

create table public.sf_mcp_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  tool_name text not null,
  calls integer not null default 0,
  rows_returned integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date, tool_name)
);
comment on table public.sf_mcp_daily_usage is 'SF MCP 依帳號、臺北日期與工具彙整的每日用量。透過函式寫入，由維護者在 SQL Editor 查看。';
comment on column public.sf_mcp_daily_usage.user_id is '使用工具的登入帳號。';
comment on column public.sf_mcp_daily_usage.usage_date is '用量所屬日期，依 Asia/Taipei 時區計算。';
comment on column public.sf_mcp_daily_usage.tool_name is '呼叫的 MCP 工具名稱。';
comment on column public.sf_mcp_daily_usage.calls is '該帳號當日成功呼叫該工具的累計次數。';
comment on column public.sf_mcp_daily_usage.rows_returned is '該帳號當日由該工具取得的累計方案明細筆數。';
comment on column public.sf_mcp_daily_usage.updated_at is '該帳號當日該工具最後一次用量更新時間。';
alter table public.sf_mcp_daily_usage enable row level security;
revoke all on public.sf_mcp_daily_usage from public, anon, authenticated;

-- ---------- 3. 額度函式 ----------
create function public.sf_mcp_quota_check()
returns table (rows_today integer, daily_limit integer, over_limit boolean)
language plpgsql stable security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_date date := (now() at time zone 'Asia/Taipei')::date;
begin
  if v_uid is null or public.sf_mcp_ok() is not true then
    raise exception 'sf_mcp_quota_check: 未授權' using errcode = '42501';
  end if;

  return query
    select today.rows, u.daily_limit, today.rows >= u.daily_limit
    from public.sf_mcp_users u
    cross join lateral (
      select coalesce(sum(d.rows_returned), 0)::integer as rows
      from public.sf_mcp_daily_usage d
      where d.user_id = u.user_id and d.usage_date = v_date
    ) today
    where u.user_id = v_uid;
end
$fn$;

create function public.sf_mcp_quota_consume(p_tool text, p_rows integer)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_date date := (now() at time zone 'Asia/Taipei')::date;
begin
  if v_uid is null or public.sf_mcp_ok() is not true then
    raise exception 'sf_mcp_quota_consume: 未授權' using errcode = '42501';
  end if;
  if p_tool is null or p_tool not in ('describe_data', 'search_solutions', 'search_companies',
      'get_solution', 'get_solutions', 'data_status', 'whoami', 'count_solutions') then
    raise exception 'sf_mcp_quota_consume: 不支援的工具名稱' using errcode = '22023';
  end if;
  if p_rows is null or p_rows not between 0 and 50 then
    raise exception 'sf_mcp_quota_consume: 筆數須介於 0 與 50' using errcode = '22023';
  end if;

  insert into public.sf_mcp_daily_usage as d (user_id, usage_date, tool_name, calls, rows_returned)
  values (v_uid, v_date, p_tool, 1, p_rows)
  on conflict (user_id, usage_date, tool_name) do update set
    calls = d.calls + 1,
    rows_returned = d.rows_returned + excluded.rows_returned,
    updated_at = now();
end
$fn$;

revoke all on function public.sf_mcp_quota_check(), public.sf_mcp_quota_consume(text,integer) from public, anon;
grant execute on function public.sf_mcp_quota_check(), public.sf_mcp_quota_consume(text,integer) to authenticated;

-- ---------- 4. 交易內自檢 ----------
do $$
declare
  v_usage regclass := 'public.sf_mcp_daily_usage'::regclass;
  v_users bigint := (select users_count from pg_temp.sf_mcp_v14_before);
  v_role text;
  v_function regprocedure;
begin
  if (select relrowsecurity from pg_class where oid = v_usage) is not true then
    raise exception '自檢失敗：sf_mcp_daily_usage 未啟用 RLS';
  end if;
  foreach v_role in array array['anon', 'authenticated'] loop
    if exists (
      select 1
      from pg_class c
      cross join lateral aclexplode(acldefault('r', c.relowner)) acl
      where c.oid = v_usage and has_table_privilege(v_role, v_usage, acl.privilege_type)
    ) or has_any_column_privilege(v_role, v_usage, 'select, insert, update, references') then
      raise exception '自檢失敗：% 有 sf_mcp_daily_usage 的直接存取權', v_role;
    end if;
  end loop;
  foreach v_function in array array[
    'public.sf_mcp_quota_check()'::regprocedure,
    'public.sf_mcp_quota_consume(text,integer)'::regprocedure
  ] loop
    if (select prosecdef from pg_proc where oid = v_function) is not true then
      raise exception '自檢失敗：% 必須使用 SECURITY DEFINER', v_function;
    end if;
    if has_function_privilege('anon', v_function, 'execute')
       or not has_function_privilege('authenticated', v_function, 'execute') then
      raise exception '自檢失敗：% 的執行權限不符', v_function;
    end if;
  end loop;
  if (select count(*) from public.sf_mcp_users) <> v_users
     or exists (select 1 from public.sf_mcp_users where account_type <> 'human' or daily_limit <> 300) then
    raise exception '自檢失敗：白名單筆數或既有帳號預設值不符';
  end if;
  raise notice '自檢通過：白名單 % 筆，既有帳號預設 human／300，用量表 RLS 與函式權限正確', v_users;
end
$$;

COMMIT;

-- ---------- 交易外驗證（由維護者在 SQL Editor 逐段執行） ----------
-- 執行 migration 前後各記錄下列兩個筆數，確認資料未變動。
-- select count(*) from public.solutions;
-- select count(*) from public.sf_mcp_users;
-- select account_type, daily_limit, count(*) from public.sf_mcp_users group by 1, 2;
-- select relrowsecurity, relacl from pg_class where oid = 'public.sf_mcp_daily_usage'::regclass;
-- select oid::regprocedure, prosecdef, proacl from pg_proc where oid in
--   ('public.sf_mcp_quota_check()'::regprocedure, 'public.sf_mcp_quota_consume(text,integer)'::regprocedure);

-- ---------- 回滾（另開查詢執行；會刪除每日用量與帳號額度設定） ----------
-- BEGIN;
-- drop function public.sf_mcp_quota_consume(text,integer);
-- drop function public.sf_mcp_quota_check();
-- drop table public.sf_mcp_daily_usage;
-- alter table public.sf_mcp_users drop column daily_limit, drop column account_type;
-- COMMIT;

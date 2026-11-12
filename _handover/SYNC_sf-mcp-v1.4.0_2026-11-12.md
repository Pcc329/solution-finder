# SF MCP v1.4.0 交接紀錄

## Git 資訊

- 基底 `main` · `566f1644d65bc46f9ce5fc62259c693ced223c44`
- 分支 `feat/sf-mcp-v1.4.0-quota`
- 實作 commit · `4a58683a36ad70bc17e94a75ea8d3c1bd4fc8cfa`
- 一般 PR · [#308](https://github.com/Pcc329/solution-finder/pull/308)

## 改動檔案與函式

| 檔案 | 改動 |
| --- | --- |
| `supabase/functions/sf-mcp/index.ts` | `runTool` 在 `sf_mcp_touch` 後檢查額度，成功後記錄用量。新增 `readQuota`、`rowsReturned`、`priceRange` 和 `searchPage`。兩個搜尋工具調整分頁與價格欄位，`whoami` 顯示額度。同步更新 `DATA_GUIDE` 與版本。 |
| `migrations/20261111_sf_mcp_v1_4_quota.sql` | 白名單新增 `account_type` 與 `daily_limit`，建立每日用量表與 `sf_mcp_quota_check()`、`sf_mcp_quota_consume(text,integer)`。 |
| `tests/sf-mcp/` | 新增 MCP 工具與本機 PostgreSQL 驗收，將兩支新測試納入 `npm test`，同步既有測試的分頁、限流、指南及 `whoami` 期望。 |
| `docs/sf-mcp-changelog.md` | 記錄 v1.3.1 和 v1.4.0，標明價格欄位與廠商每頁上限的破壞性變更。 |
| `_handover/SYNC_sf-mcp-v1.4.0_2026-11-12.md` | 本交接紀錄。 |

## 規格偏離與決策

1. `search_companies` 的 `limit` 上限由 50 家改為 10 家，預設值由 20 家改為 10 家。輸入驗證後的值直接傳入既有 RPC 的 `p_limit`。每家最多 5 筆方案，每次最多 50 筆明細，依實際回傳的方案數扣額。工具說明與 `describe_data` 同步更新。
2. 既有廠商搜尋 RPC 未提供月費，因此 `search_companies` 提供 `price_range` 並省略 `monthly_price_range`。回傳的 `notes` 增列「月費級距請以 get_solutions 查詢方案明細」。兩項決策均在 Edge Function 實作，沿用既有搜尋 RPC。

## 本機驗收

- PGlite 執行 PostgreSQL，使用測試用的 `auth.uid()`、`auth.jwt()`、既有白名單政策及預設授權。migration 自檢通過，`solutions` 和 `sf_mcp_users` 前後各為 2 筆。
- 缺少 RLS、缺少 SECURITY DEFINER、保留預設表權限的三個版本皆被自檢擋下。回滾後，用量表、兩個函式及白名單新增欄位均不存在。
- 預設帳號每次查 50 筆，累計 300 筆後，第 7 次查詢（第 301 筆）被擋。訊息為「今日查詢明細已達上限（300 筆），每日 00:00 重置。如有盤點需求，請洽資料維護者。」
- 另一帳號設為 20 筆，每次查 10 筆，累計 20 筆後，第 3 次查詢（第 21 筆）被擋。訊息為「今日查詢明細已達上限（20 筆），每日 00:00 重置。如有盤點需求，請洽資料維護者。」
- 兩個帳號都收到相同的下一步建議「縮小查詢條件」「明日再查」「洽資料維護者」。阻擋的呼叫未進入搜尋或計入每日用量。
- `npm test` 共 98 項通過。舊搜尋 fixture 產生器輸出 28 組案例。

## 已知限制

- 先檢查額度再記錄回傳筆數。依序呼叫時，最後一批最多可多回傳 50 筆。並行呼叫可能在同一批用量寫入前都通過檢查，累計超出量可能大於單批。額度查詢遇非授權類錯誤會記錄並繼續，扣額失敗會記錄並保留原回傳。
- 每日額度與用量紀錄能延緩並追查大量取用。有權帳號仍可分多日累積，請按規格每週檢視用量。
- 前台 API 與 Agent 帳號開通流程沿用現行機制。

## 部署順序

1. PPC 在 SQL Editor 記錄 `solutions` 與 `sf_mcp_users` 筆數，執行下列 migration，再執行檔尾驗證 SELECT，確認兩個筆數前後一致。
2. 部署 `index.ts`，Verify JWT 維持關閉。重新連線 Claude 連接器以更新工具 schema。
3. 驗證 `whoami` 顯示 1.4.0 與額度，整批匯出要求會說明限制，且搜尋清單顯示價格級距、詳情可取得精確價格。

## Migration 全文

```sql
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
```

## 測試完整輸出

```text
> test
> node --test sf-mcp-v1-2.test.mjs sf-mcp-v1-3-capital-sql.test.mjs sf-mcp-v1-4-quota.test.mjs sf-mcp-v1-4-quota-sql.test.mjs

[sf-mcp] search_companies 失敗： 資本額涵蓋率查詢未回傳計數
(node:9988) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ standalone Edge Function imports only npm/jsr packages, with no local or dynamic imports (2.1688ms)
✔ browser and inline MCP definitions independently load identical placeholder lists and behavior (3.0973ms)
✔ eight real SDK registrations advertise Chinese title and object output schemas (14.6757ms)
✔ real SDK HTTP tools/list and tools/call preserve structured/text responses (92.6543ms)
✔ describe_data: success validates against actual outputSchema; touch exactly once before queries (8.3159ms)
✔ search_solutions: success validates against actual outputSchema; touch exactly once before queries (10.4665ms)
✔ search_companies: success validates against actual outputSchema; touch exactly once before queries (4.8355ms)
✔ get_solution: success validates against actual outputSchema; touch exactly once before queries (5.0557ms)
✔ get_solutions: success validates against actual outputSchema; touch exactly once before queries (7.8794ms)
✔ data_status: success validates against actual outputSchema; touch exactly once before queries (6.197ms)
✔ whoami: success validates against actual outputSchema; touch exactly once before queries (6.8047ms)
✔ count_solutions: success validates against actual outputSchema; touch exactly once before queries (5.8919ms)
✔ search_solutions: one search RPC with city=undefined, global totals and page-only enrichment (6.3262ms)
✔ search_solutions: one search RPC with city=["台北市"], global totals and page-only enrichment (14.4285ms)
✔ search_companies: one RPC, totals beyond former cap, sentinel excluded, per-company counts not five previews (6.4426ms)
✔ company count-only sentinel preserves totals, including empty out-of-range page (6.4895ms)
✔ normal_only wins, forwarded unchanged; notes retain city, conflict, partial failure and suspect instruction in <=3 entries (5.9223ms)
✔ include_delisted scope does not mislabel confirmed delisted as normal in summary (5.8443ms)
✔ no next page at final row; omit empty summary context and unknown clause (12.7661ms)
✔ zero result is not error and suggests next step: {"keyword":"入住自動化"} (5.1743ms)
✔ zero result is not error and suggests next step: {"city":["臺北市"]} (4.3486ms)
✔ zero result is not error and suggests next step: {"category":["資安"],"program":["來源"],"max_price":0,"is_ai":false,"is_gov":true,"is_startup":false} (3.6306ms)
✔ zero result is not error and suggests next step: {"normal_only":true} (3.7586ms)
✔ zero companies keeps city unknown count and suggests unknown records (10.2391ms)
✔ solution empty RPC page reports counting limitation without extra RPC (3.9274ms)
✔ handler error is sanitized Chinese JSON; actual SDK skips output validation for isError (7.46ms)
✔ handler failure logs the actual error only to console, not to the user response (5.3922ms)
✔ non-Error handler failure is logged using String(err), while response remains sanitized (4.0309ms)
✔ touch fail-open / observe-only: {"touch":{"error":{"message":"private"},"data":null}} (5.6923ms)
✔ touch fail-open / observe-only: {"throwTouch":true} (5.6747ms)
✔ touch fail-open / observe-only: {"touch":{"data":[{"over_limit":true,"limit_per_minute":30}],"error":null}} (4.7721ms)
✔ injected enforce=true blocks before handler, with deterministic retry seconds (6.8597ms)
✔ describe topics index/default, all and every section preserve v1.1 except specified edits (172.4578ms)
✔ three handlers without capital retain query/body logic (117.2617ms)
✔ migration hash pinned, skill exact appendix hash, old scanning removed, no business writes/private RPC (1.5758ms)
✔ all four name outputs and actual schemas: null (17.1774ms)
✔ all four name outputs and actual schemas: undefined (10.0211ms)
✔ all four name outputs and actual schemas: "" (15.121ms)
✔ all four name outputs and actual schemas: "  " (10.4776ms)
✔ all four name outputs and actual schemas: "缺" (11.7459ms)
✔ all four name outputs and actual schemas: " 缺 " (21.2697ms)
✔ all four name outputs and actual schemas: "缺漏" (22.3466ms)
✔ all four name outputs and actual schemas: "待補" (19.8392ms)
✔ all four name outputs and actual schemas: "無" (26.2952ms)
✔ all four name outputs and actual schemas: "-" (24.8609ms)
✔ all four name outputs and actual schemas: "—" (30.8597ms)
✔ all four name outputs and actual schemas: "N/A" (30.8428ms)
✔ all four name outputs and actual schemas: "NA" (24.553ms)
✔ all four name outputs and actual schemas: "null" (25.4294ms)
✔ all four name outputs and actual schemas: "?" (23.2614ms)
✔ all four name outputs and actual schemas: "？" (23.0722ms)
✔ all four name outputs and actual schemas: "律果簽" (26.698ms)
✔ all four name outputs and actual schemas: "HackMD" (26.7648ms)
✔ all four name outputs and actual schemas: "AI" (20.1434ms)
✔ all four name outputs and actual schemas: " AI " (22.8436ms)
✔ describe_data: 42501 denies access before any query or handler and logs server-side (7.6981ms)
✔ search_solutions: 42501 denies access before any query or handler and logs server-side (5.428ms)
✔ search_companies: 42501 denies access before any query or handler and logs server-side (4.8838ms)
✔ get_solution: 42501 denies access before any query or handler and logs server-side (4.5786ms)
✔ get_solutions: 42501 denies access before any query or handler and logs server-side (3.9832ms)
✔ data_status: 42501 denies access before any query or handler and logs server-side (3.6942ms)
✔ whoami: 42501 denies access before any query or handler and logs server-side (3.375ms)
✔ count_solutions: 42501 denies access before any query or handler and logs server-side (3.4053ms)
✔ summary city text uses official 臺 while RPC parameters and keyword stay unchanged (8.7533ms)
✔ describe_data index uses the first complete sentence, not a list heading fragment (2.7465ms)
✔ name display preserves RPC page order, scores, totals and request parameters (2.8683ms)
✔ capital schema is limited to search_companies and validates bounds (3.1511ms)
✔ capital bounds and sorting reach the DB with city, normal_only and pagination (3.2103ms)
✔ capital remains null through search and both detail tools (21.4742ms)
✔ capital remains 0 through search and both detail tools (33.374ms)
✔ capital remains 100000000 through search and both detail tools (24.6611ms)
✔ capital unknown count survives empty pages and counts remain server totals (4.6708ms)
✔ coverage refreshes for every call, includes zero as known and handles empty denominator (11.9932ms)
✔ missing coverage fails without publishing capital with fabricated disclosure (3.2617ms)
✔ unaffected search and missing detail results do not fetch or expose capital (10.594ms)
✔ describe_data capital topic and index disclose definition and denominator (7.985ms)
▶ capital migration executes in PostgreSQL with legacy parity, DB filtering, sorting and live coverage
  ✔ six legacy queries preserve every old column, row and order (45.4766ms)
  ✔ bounds filter before counts and pagination; full-table scope differs (24.8012ms)
  ✔ sorting is global, stable across pages, NULL last; previews remain capped at five (7.9244ms)
  ✔ sentinel preserves totals and unknowns for empty and out-of-range pages (2.8449ms)
  ✔ coverage counts all companies, counts zero, refreshes after isolated test update (2.038ms)
  ✔ anonymous denied, authenticated read-only invoker allowed, overload removed (7.371ms)
  ✔ all handoff verification queries are SELECT statements and execute before deployment (16.705ms)
✔ capital migration executes in PostgreSQL with legacy parity, DB filtering, sorting and live coverage (2466.8846ms)
(node:26192) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ quota migration checks grants and defaults, isolates accounts and aggregates by Taipei day and tool (2405.4375ms)
ℹ 自檢通過：白名單 2 筆，既有帳號預設 human／300，用量表 RLS 與函式權限正確
ℹ 資料筆數前後一致（solutions: 2，sf_mcp_users: 2）
▶ negative migrations fail self-check and roll back all schema changes
  ✔ RLS (38.7769ms)
  ✔ SECURITY DEFINER (21.7938ms)
  ✔ default table privileges (21.6251ms)
✔ negative migrations fail self-check and roll back all schema changes (1293.6654ms)
ℹ 自檢失敗：sf_mcp_daily_usage 未啟用 RLS
ℹ 自檢失敗：sf_mcp_quota_check() 必須使用 SECURITY DEFINER
ℹ 自檢失敗：anon 有 sf_mcp_daily_usage 的直接存取權
✔ MCP calls with real local SQL stop at 300 rows and at an account-specific limit of 20 (1247.4647ms)
ℹ 第 7 次查詢（第 301 筆）被擋。 今日查詢明細已達上限（300 筆），每日 00:00 重置。如有盤點需求，請洽資料維護者。
ℹ 第 3 次查詢（第 21 筆）被擋。 今日查詢明細已達上限（20 筆），每日 00:00 重置。如有盤點需求，請洽資料維護者。
(node:29128) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ over-limit check blocks all four detail handlers and skips consumption (75.4925ms)
✔ quota check 42501 blocks; other errors log and let the handler run (11.3566ms)
✔ all eight successful handlers record exactly one call and their actual row usage (51.9225ms)
✔ handler failures skip consumption and consume failures keep the successful result (11.5763ms)
✔ offset caps and company page size validate, forward the limit and stop pagination at the boundary (21.3608ms)
✔ price ranges cover every boundary, lists omit exact values and details retain them (12.4544ms)
✔ whoami includes usage on success and omits it when quota lookup fails (11.4034ms)
✔ per-minute enforcement is on by default and runs before the daily check (7.6313ms)
ℹ tests 98
ℹ suites 0
ℹ pass 98
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5529.2356
```

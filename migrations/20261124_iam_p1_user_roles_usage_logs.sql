-- ============================================================
-- IAM MVP P1：建立 user_roles（含啟用帳號上限 30）、usage_logs；contact_access_logs 加 user_id
-- 日期：2026-11-24　設計：Project `claude/design_iam_mvp_2026-11-24.md`
-- 執行：PPC 於 Supabase SQL Editor 一次執行整份（單一交易；任一檢查失敗即整份撤銷）
-- 查證（11/24 11:54 唯讀查詢）：auth.users.id 為 uuid；user_roles、usage_logs 不存在；
--       contact_access_logs 9 欄、service_role 僅 INSERT／SELECT、17 筆。
-- 原則：兩張新表只給 service_role（伺服器端 API）使用；anon、authenticated 一律無權限；RLS 開啟。
--       本檔只建結構，不寫入任何帳號資料；程式端在 P2（Codex PR）才會使用。
-- 若 SQL Editor 跳出 RLS 警告：選「Run without RLS」（本檔已自行開啟 RLS）。
-- ============================================================

begin;

-- ---------- 前置檢查 ----------
do $pre$
begin
  if to_regclass('public.user_roles') is not null or to_regclass('public.usage_logs') is not null then
    raise exception '前置檢查失敗：user_roles 或 usage_logs 已存在，已中止';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'contact_access_logs' and column_name = 'user_id') then
    raise exception '前置檢查失敗：contact_access_logs 已有 user_id 欄位，已中止';
  end if;
  if (select data_type from information_schema.columns
       where table_schema = 'auth' and table_name = 'users' and column_name = 'id') <> 'uuid' then
    raise exception '前置檢查失敗：auth.users.id 不是 uuid，已中止';
  end if;
end $pre$;

create temp table v_before on commit drop as
select (select count(*) from public.contact_access_logs) as cal_rows,
       (select count(*) from auth.users) as auth_users;

-- ---------- A. user_roles：身分（auth.users）與角色分開存放 ----------
create table public.user_roles (
  user_id              uuid        primary key references auth.users(id) on delete cascade,
  email                text        not null unique,
  role                 text        not null check (role in ('super','admin','user')),
  center               text,
  is_active            boolean     not null default true,
  must_change_password boolean     not null default true,
  is_external          boolean     not null default false,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint user_roles_email_lower check (email = lower(email)),
  constraint user_roles_email_domain check (is_external or email like '%@iii.org.tw')
);
comment on table  public.user_roles is 'SF 網站個人帳號的角色與狀態；身分在 auth.users。僅 service_role（伺服器端 API）與 postgres（SQL Editor）可存取。';
comment on column public.user_roles.email is '小寫 email，身分對應鍵；非外部人員須為 @iii.org.tw。';
comment on column public.user_roles.role is 'super＝系統管理者；admin＝資料上傳審核者；user＝一般使用者。';
comment on column public.user_roles.is_active is 'false＝停權；API 驗證時查詢（快取 60 秒）。';
comment on column public.user_roles.must_change_password is 'true＝下次登入須先改密碼（臨時密碼）。';
comment on column public.user_roles.is_external is 'true＝經 super 核准的院外人員，不受 @iii.org.tw 限制。';

create or replace function public.user_roles_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $fn$
begin
  new.updated_at := now();
  return new;
end $fn$;
revoke all on function public.user_roles_set_updated_at() from public, anon, authenticated;

create trigger user_roles_updated_at before update on public.user_roles
  for each row execute function public.user_roles_set_updated_at();

-- 啟用帳號上限（2026-11-24 PPC 決定：試行期 30 人）。
-- 新增帳號、或把停權帳號恢復啟用時檢查；停權（is_active=false）不佔名額。
-- 調高上限：另寫一份 migration 以 create or replace 修改 max_active，並記錄日期、原因、核准人。
-- 依據：NIST SP 800-53 AC-2（帳號建立須經核准）、雲端服務配額慣例；見 IAM 設計文件。
create or replace function public.user_roles_enforce_cap()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare
  max_active constant int := 30;
  n int;
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    perform pg_advisory_xact_lock(hashtext('public.user_roles_enforce_cap'));
    select count(*) into n from public.user_roles where is_active;
    if n >= max_active then
      raise exception '已達啟用帳號上限 % 人，無法新增或恢復帳號；擴編請先以 migration 調整上限', max_active
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $fn$;
revoke all on function public.user_roles_enforce_cap() from public, anon, authenticated;

create trigger user_roles_cap before insert or update of is_active on public.user_roles
  for each row execute function public.user_roles_enforce_cap();

alter table public.user_roles enable row level security;
revoke all on public.user_roles from public, anon, authenticated, service_role;
grant select, update on public.user_roles to service_role;   -- API：登入查角色、改密碼後清旗標；新增帳號由 PPC 以 SQL Editor 執行

-- ---------- B. usage_logs：計量帳（append-only） ----------
create table public.usage_logs (
  id          bigint      generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid        references auth.users(id) on delete set null,
  auth_method text        not null check (auth_method in ('user','shared','api_key')),
  action      text        not null check (action in ('ai_search','ai_ask','ai_manufacturing','contact_view')),
  detail      jsonb,
  ip_hash     text,
  constraint usage_logs_user_method check ((auth_method = 'user') = (user_id is not null))
);
comment on table  public.usage_logs is 'SF 計量帳：AI 呼叫與查看聯絡資訊，一次請求一列；不保存聯絡資料內容、密碼或權杖。僅 service_role 可讀寫（append-only）。';
comment on column public.usage_logs.user_id is '個人帳號；共用密碼（shared）與 API key 為空。帳號刪除時保留紀錄、改為空值。';
comment on column public.usage_logs.action is 'ai_search＝首頁 AI 搜尋；ai_ask＝結果頁 AI 問答；ai_manufacturing＝方案探索 AI；contact_view＝查看公司聯絡資訊。';
comment on column public.usage_logs.detail is '補充資訊，例如 {"company_id":"..."}；不得放入聯絡人內容。';
comment on column public.usage_logs.ip_hash is '來源 IP 的加鹽 HMAC（LOG_HASH_SALT），不保存原始 IP。';

create index usage_logs_user_created_idx   on public.usage_logs (user_id, created_at desc);
create index usage_logs_action_created_idx on public.usage_logs (action, created_at desc);

alter table public.usage_logs enable row level security;
revoke all on public.usage_logs from public, anon, authenticated, service_role;
grant select, insert on public.usage_logs to service_role;

-- ---------- C. contact_access_logs 加 user_id（資安紀錄：誰看了誰） ----------
alter table public.contact_access_logs
  add column user_id uuid references auth.users(id) on delete set null;
comment on column public.contact_access_logs.user_id is '個人帳號 session 存取時的使用者；共用密碼與 API key 為空（2026-11-24 IAM P1 新增）。';
create index contact_access_logs_user_created_idx on public.contact_access_logs (user_id, created_at desc);

-- ---------- 交易內自檢 ----------
do $chk$
declare b record;
begin
  select * into b from v_before;

  if not (select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.usage_logs'::regclass) then
    raise exception '自檢失敗：新表 RLS 未開啟';
  end if;

  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name in ('user_roles','usage_logs')
                and grantee in ('anon','authenticated','PUBLIC')) then
    raise exception '自檢失敗：公開角色對新表仍有權限';
  end if;

  if (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'user_roles' and grantee = 'service_role') <> 'SELECT,UPDATE' then
    raise exception '自檢失敗：service_role 對 user_roles 的權限不是 SELECT,UPDATE';
  end if;
  if (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'usage_logs' and grantee = 'service_role') <> 'INSERT,SELECT' then
    raise exception '自檢失敗：service_role 對 usage_logs 的權限不是 INSERT,SELECT';
  end if;

  if (select count(*) from public.contact_access_logs) <> b.cal_rows then
    raise exception '自檢失敗：contact_access_logs 筆數改變';
  end if;
  if (select count(*) from public.contact_access_logs where user_id is not null) <> 0 then
    raise exception '自檢失敗：contact_access_logs.user_id 應全為空';
  end if;
  if (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'contact_access_logs' and grantee = 'service_role') <> 'INSERT,SELECT' then
    raise exception '自檢失敗：contact_access_logs 的 service_role 權限被改變';
  end if;

  if not exists (select 1 from pg_trigger where tgrelid = 'public.user_roles'::regclass and tgname = 'user_roles_cap') then
    raise exception '自檢失敗：帳號上限觸發器未建立';
  end if;

  if (select count(*) from public.user_roles) <> 0 or (select count(*) from public.usage_logs) <> 0 then
    raise exception '自檢失敗：新表應為空';
  end if;
  if (select count(*) from auth.users) <> b.auth_users then
    raise exception '自檢失敗：auth.users 筆數改變';
  end if;

  raise notice '自檢通過：user_roles（上限 30）、usage_logs 已建立（RLS 開啟、僅 service_role）；contact_access_logs.user_id 已新增（% 筆不變）', b.cal_rows;
end $chk$;

commit;

select 'IAM P1 完成' as 結果;

-- ============================================================
-- 交易外獨立驗證（commit 後另開分頁執行，一列結果）
-- ============================================================
-- select
--   (select string_agg(c.relname || ':RLS=' || c.relrowsecurity, ', ') from pg_class c
--     where c.oid in ('public.user_roles'::regclass, 'public.usage_logs'::regclass)) as 新表RLS,
--   (select coalesce(string_agg(table_name || ':' || grantee || ':' || privilege_type, ', '), '（無）')
--      from information_schema.role_table_grants
--     where table_schema = 'public' and table_name in ('user_roles','usage_logs')
--       and grantee in ('anon','authenticated')) as 公開角色權限,
--   (select string_agg(table_name || ':' || privilege_type, ', ' order by table_name, privilege_type)
--      from information_schema.role_table_grants
--     where table_schema = 'public' and table_name in ('user_roles','usage_logs','contact_access_logs')
--       and grantee = 'service_role') as service_role權限,
--   (select count(*) from public.contact_access_logs) as contact_access_logs筆數;
--
-- 預期：兩表 RLS=true；公開角色權限（無）；
--       service_role：contact_access_logs:INSERT,SELECT／usage_logs:INSERT,SELECT／user_roles:SELECT,UPDATE

-- ============================================================
-- P3 建帳號範本（P2 上線前不要執行；先在 Dashboard 建 auth 使用者並勾選 Auto Confirm）
-- ============================================================
-- insert into public.user_roles (user_id, email, role, center, note)
-- select id, lower(email), 'user', '<中心>', '<備註>'
--   from auth.users where lower(email) = lower('<同仁>@iii.org.tw');

-- ============================================================
-- 回復（需要時另開分頁執行）
-- ============================================================
-- begin;
-- drop index if exists public.contact_access_logs_user_created_idx;
-- alter table public.contact_access_logs drop column if exists user_id;
-- drop table if exists public.usage_logs;
-- drop table if exists public.user_roles;
-- drop function if exists public.user_roles_set_updated_at();
-- drop function if exists public.user_roles_enforce_cap();
-- commit;

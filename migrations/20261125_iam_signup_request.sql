-- ============================================================
-- IAM 申請制：user_roles 支援「自行申請、super 核准」
-- 日期：2026-11-25　執行：PPC 於 Supabase SQL Editor 一次執行整份（單一交易；任一檢查失敗即整份撤銷）
-- 決策（S1～S4，PPC 11/25 同意）：同仁於網站自行申請（自設密碼），帳號預設未啟用；
--   super 與本人確認後將 is_active 改為 true 才能使用。Supabase 公開註冊不開放，
--   申請一律經伺服器 API（service role）建立。
-- 內容：
--   1. 新增欄位 signup_source（super／self）、approved_at（核准時間）
--   2. 資料庫層強制：自行申請的列在核准前必須「未啟用、角色 user」
--   3. 觸發器：啟用時自動寫入 approved_at；待核准申請上限 20 筆
--   4. service_role 增加 INSERT 權限（僅供申請 API 使用）
--   5. 既有啟用中的列（PPC）回填 approved_at = created_at
-- ============================================================

begin;

-- ---------- 前置檢查 ----------
do $pre$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'user_roles'
                and column_name in ('signup_source', 'approved_at')) then
    raise exception '前置檢查失敗：signup_source 或 approved_at 已存在（可能已執行過）';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'user_roles'
                and grantee = 'service_role' and privilege_type = 'INSERT') then
    raise exception '前置檢查失敗：service_role 已有 INSERT（可能已執行過）';
  end if;
  if (select count(*) from public.user_roles) <> 1 then
    raise exception '前置檢查失敗：user_roles 應剛好 1 筆（PPC），實際 % 筆', (select count(*) from public.user_roles);
  end if;
end $pre$;

-- ---------- 1. 欄位 ----------
alter table public.user_roles
  add column signup_source text not null default 'super' check (signup_source in ('super', 'self')),
  add column approved_at timestamptz;

comment on column public.user_roles.signup_source is 'super＝super 直接建立；self＝同仁於網站自行申請（2026-11-25 申請制）。';
comment on column public.user_roles.approved_at is '第一次啟用的時間（核准時間）；由觸發器在 is_active 變為 true 時自動寫入，之後停權／恢復不改。';

update public.user_roles set approved_at = created_at where is_active and approved_at is null;

-- ---------- 2. 核准前限制 ----------
alter table public.user_roles add constraint user_roles_self_pending
  check (signup_source <> 'self' or approved_at is not null or (not is_active and role = 'user'));

-- ---------- 3. 觸發器：approved_at、待核准上限 ----------
create or replace function public.user_roles_signup_guard() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare max_pending constant int := 20; n int;
begin
  -- 自行申請的新列：一律未啟用、未核准（不得在新增時直接啟用或預填核准時間）
  if tg_op = 'INSERT' and new.signup_source = 'self' then
    if new.is_active or new.approved_at is not null or new.role <> 'user' then
      raise exception '自行申請的帳號必須以「未啟用、未核准、角色 user」建立' using errcode = 'check_violation';
    end if;
  end if;
  if new.is_active and new.approved_at is null then
    new.approved_at := now();
  end if;
  if tg_op = 'INSERT' and new.signup_source = 'self' then
    perform pg_advisory_xact_lock(hashtext('public.user_roles_signup_guard'));
    select count(*) into n from public.user_roles where signup_source = 'self' and approved_at is null;
    if n >= max_pending then
      raise exception '待核准申請已達 % 筆，暫停受理；請先處理既有申請', max_pending using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $fn$;

create trigger user_roles_signup_guard
  before insert or update of is_active on public.user_roles
  for each row execute function public.user_roles_signup_guard();

-- ---------- 4. 權限 ----------
grant insert on public.user_roles to service_role;

-- ---------- 自檢 ----------
do $self$
begin
  if (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'user_roles' and grantee = 'service_role') <> 'INSERT,SELECT,UPDATE' then
    raise exception '自檢失敗：service_role 權限應為 INSERT,SELECT,UPDATE';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'user_roles' and grantee in ('anon', 'authenticated')) then
    raise exception '自檢失敗：公開角色不應有權限';
  end if;
  if (select count(*) from public.user_roles where signup_source = 'super' and approved_at is not null) <> 1 then
    raise exception '自檢失敗：既有 1 筆應為 super 且已回填 approved_at';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'user_roles_signup_guard' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname = 'user_roles_cap' and not tgisinternal) then
    raise exception '自檢失敗：觸發器缺漏';
  end if;
end $self$;

commit;

select '申請制欄位與權限已建立' as 結果,
       (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
         where table_schema = 'public' and table_name = 'user_roles' and grantee = 'service_role') as service_role權限,
       (select signup_source || ' / approved_at=' || coalesce(approved_at::text, 'null') from public.user_roles) as 既有帳號;

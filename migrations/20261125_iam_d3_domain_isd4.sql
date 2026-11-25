-- ============================================================
-- IAM D3 修訂：帳號網域加入 @isd4.biz
-- 日期：2026-11-25　執行：PPC 於 Supabase SQL Editor 一次執行整份（單一交易；任一檢查失敗即整份撤銷）
-- 背景：P3 建第一個帳號時發現，isd4.biz 是院內另一個正式網域，用於非正式專案人力
--       及 iii 的備用信箱；PPC 本人沒有 @iii.org.tw 信箱。原約束只允許 @iii.org.tw。
-- 決策：D3 改為「@iii.org.tw 或 @isd4.biz；其他網域須 is_external = true 並由 super 個別核准」。
-- 內容：只替換 public.user_roles 的 user_roles_email_domain 約束；不寫入任何資料。
-- ============================================================

begin;

-- ---------- 前置檢查 ----------
do $pre$
declare def text;
begin
  select pg_get_constraintdef(c.oid) into def
    from pg_constraint c
   where c.conrelid = 'public.user_roles'::regclass and c.conname = 'user_roles_email_domain';
  if def is null then raise exception '前置檢查失敗：找不到約束 user_roles_email_domain'; end if;
  if def not like '%iii.org.tw%' or def like '%isd4.biz%' then
    raise exception '前置檢查失敗：約束內容與預期不同（可能已執行過）：%', def;
  end if;
end $pre$;

-- ---------- 替換約束 ----------
alter table public.user_roles drop constraint user_roles_email_domain;
alter table public.user_roles add constraint user_roles_email_domain
  check (is_external or email like '%@iii.org.tw' or email like '%@isd4.biz');

comment on constraint user_roles_email_domain on public.user_roles is
  '2026-11-25 D3 修訂：非外部人員須為 @iii.org.tw 或 @isd4.biz（院內備用網域，用於非正式專案人力與 iii 備用信箱）。';

-- ---------- 自檢 ----------
do $self$
declare def text;
begin
  select pg_get_constraintdef(c.oid) into def
    from pg_constraint c
   where c.conrelid = 'public.user_roles'::regclass and c.conname = 'user_roles_email_domain';
  if def is null or def not like '%iii.org.tw%' or def not like '%isd4.biz%' or def not like '%is_external%' then
    raise exception '自檢失敗：新約束內容不符：%', def;
  end if;
  if (select count(*) from public.user_roles) <> 0 then
    raise exception '自檢失敗：user_roles 應仍為 0 筆';
  end if;
end $self$;

commit;

select '網域約束已更新' as 結果,
       (select pg_get_constraintdef(c.oid) from pg_constraint c
         where c.conrelid = 'public.user_roles'::regclass and c.conname = 'user_roles_email_domain') as 新約束;

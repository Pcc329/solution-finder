-- ============================================================
-- 收回 public.users 的公開角色權限（anon、authenticated）
-- 日期：2026-11-24　執行：PPC 於 Supabase SQL Editor 一次執行（單一交易；自檢失敗即整份撤銷）
-- 存檔說明：本檔開頭這段註解為存檔時加上；begin 起的語句與當日執行內容相同。
-- 背景：public.users 為 PR #156（未 merge、11/18 已關閉）建立的帳號表，13 筆，含密碼雜湊，
--       網站程式碼（api/、_lib/、public/、supabase/）無任何讀取。
-- 查證（執行前，唯讀）：RLS 已開；anon 有 SELECT、REFERENCES、TRIGGER；pg_policies 0 列
--       → RLS 一直擋住所有列，判定未外洩，屬多餘授權（授權＋RLS 雙層原則只剩一層）。
-- 結果：公開角色權限 =（無）
-- 後續：IAM 上線後（P4）刪除本表。
-- ============================================================

begin;
revoke all on public.users from anon, authenticated;

do $chk$
begin
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'users'
                and grantee in ('anon','authenticated')) then
    raise exception '自檢失敗：公開角色仍有權限';
  end if;
end $chk$;
commit;

select coalesce(string_agg(grantee || ':' || privilege_type, ', '), '（無）') as 公開角色權限
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'users'
   and grantee in ('anon','authenticated');

-- ============================================================
-- 收回 anon 對 7 張內部表的多餘權限（SELECT 授權盤點 A 組）
-- 日期：2026-11-24　執行：PPC 於 Supabase SQL Editor 一次執行（單一交易；自檢失敗即整份撤銷）
-- 存檔說明：本檔開頭這段註解為存檔時加上；begin 起的語句與當日執行內容相同。
-- 盤點（執行前，唯讀）：public schema 中 anon／authenticated 有 SELECT 的物件共 21 個。
--   A 組（本檔）：RLS 已開、無開放 anon 的 policy、網站程式碼無以公開金鑰讀取 → 收回 anon
--     csp_violations（api/csp-report.js 以 service_role 寫入，不受影響）、data_sources、digital_needs、
--     program_promotions、program_sources、solution_reviews、solution_status_log
--   注意：data_sources 只收 anon、保留 authenticated —— MCP 的 mcp_read policy（10/01）
--     以 authenticated 讀取 data_sources（describe_data 使用）。自檢第二條即確認此權限仍在。
--   B 組 12 張（有開放 anon 的 policy、網站公開資料）：保留，其中 4 張是否需公開另列 P2。
--   兩個 view（companies_public、companies_with_counts）：無個資，改善項目另列 P2。
-- 結果：「A組收回完成」；執行後以 MCP data_status 驗證 authenticated 讀取正常。
-- ============================================================

begin;
revoke all on public.csp_violations, public.data_sources, public.digital_needs,
              public.program_promotions, public.program_sources,
              public.solution_reviews, public.solution_status_log
  from anon;

do $chk$
begin
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and grantee = 'anon'
                and table_name in ('csp_violations','data_sources','digital_needs','program_promotions',
                                   'program_sources','solution_reviews','solution_status_log')) then
    raise exception '自檢失敗：anon 仍有權限';
  end if;
  if not exists (select 1 from information_schema.role_table_grants
                  where table_schema = 'public' and grantee = 'authenticated'
                    and table_name = 'data_sources' and privilege_type = 'SELECT') then
    raise exception '自檢失敗：authenticated 對 data_sources 的 SELECT 不見了（MCP 會壞）';
  end if;
end $chk$;
commit;

select 'A組收回完成' as 結果;

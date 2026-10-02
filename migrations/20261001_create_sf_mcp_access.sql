-- ============================================================
-- SF MCP v1（唯讀）資料庫存取模型
-- 日期：2026-10-01　設計文件：SF_MCP設計評估_定案範圍_2026-10-01.md
--
-- 目的：讓「白名單內的使用者」透過 Supabase Auth 的 OAuth 權杖（MCP 用戶端）唯讀存取精選資料。
-- 原則：
--   1. 只開放讀取；一律不給寫入
--   2. 存取需同時滿足：(a) 在白名單 sf_mcp_users；(b) 權杖帶有 client_id（代表是 OAuth 用戶端發的權杖，非一般登入）
--   3. 聯絡人只開放 姓名／職稱／公司電話（欄位層級授權），email 與手機一律不可讀
--   4. 收斂 authenticated 角色的預設授權（授權＋RLS 雙層）
--   5. 撤權：DELETE FROM public.sf_mcp_users WHERE user_id = '...'  ← 即時生效
-- 注意：建表後必須 ENABLE ROW LEVEL SECURITY（9/10 solution_reviews 曾漏掉）
-- ============================================================

BEGIN;

-- ---------- A. 白名單表 ----------
CREATE TABLE public.sf_mcp_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('reader','editor')),   -- v1 只使用 reader；editor 預留，不賦予任何寫入權
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.sf_mcp_users IS 'SF MCP 白名單。僅列於此表的 Supabase Auth 使用者可透過 MCP 唯讀存取。使用者只能讀自己的那一列；寫入僅限 service_role／postgres。';

ALTER TABLE public.sf_mcp_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sf_mcp_users FROM anon, authenticated;
GRANT SELECT ON public.sf_mcp_users TO authenticated;
CREATE POLICY sf_mcp_users_self_read ON public.sf_mcp_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------- B. 判斷函式（SECURITY INVOKER，不繞過任何權限）----------
CREATE OR REPLACE FUNCTION public.sf_mcp_ok()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT (auth.jwt() ->> 'client_id') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.sf_mcp_users u WHERE u.user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.sf_mcp_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_mcp_ok() TO authenticated;

-- ---------- C. 唯讀 RLS 政策（只開放既有的公開資料與來源資訊）----------
CREATE POLICY mcp_read ON public.solutions         FOR SELECT TO authenticated USING (public.sf_mcp_ok());
CREATE POLICY mcp_read ON public.companies         FOR SELECT TO authenticated USING (public.sf_mcp_ok());
CREATE POLICY mcp_read ON public.awards            FOR SELECT TO authenticated USING (public.sf_mcp_ok());
CREATE POLICY mcp_read ON public.cases             FOR SELECT TO authenticated USING (public.sf_mcp_ok());
CREATE POLICY mcp_read ON public.gov_registrations FOR SELECT TO authenticated USING (public.sf_mcp_ok());
CREATE POLICY mcp_read ON public.industry_codes    FOR SELECT TO authenticated USING (public.sf_mcp_ok());
CREATE POLICY mcp_read ON public.data_sources      FOR SELECT TO authenticated USING (public.sf_mcp_ok());

-- ---------- D. 聯絡人：欄位層級授權，只開放 姓名／職稱／公司電話 ----------
GRANT SELECT (contact_id, company_id, contact_name, title, office_phone) ON public.contacts TO authenticated;
CREATE POLICY mcp_read ON public.contacts FOR SELECT TO authenticated USING (public.sf_mcp_ok());

-- ---------- E. 收斂 authenticated 的授權 ----------
-- E1. 全部資料表／視圖：一律收回寫入類授權（authenticated 不應透過 API 寫入任何東西）
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM authenticated;

-- E2. 內部表：收回讀取授權（目前僅靠「RLS 開啟且無政策」擋住，改為授權與 RLS 雙層）
REVOKE SELECT ON public.users                    FROM authenticated;
REVOKE SELECT ON public.csp_violations           FROM authenticated;
REVOKE SELECT ON public.solution_reviews         FROM authenticated;
REVOKE SELECT ON public.solution_status_log      FROM authenticated;
REVOKE SELECT ON public.program_promotions       FROM authenticated;
REVOKE SELECT ON public.program_sources          FROM authenticated;
REVOKE SELECT ON public.company_cdm_categories   FROM authenticated;
REVOKE SELECT ON public.digital_needs            FROM authenticated;

-- E3. contacts_masked 為 SECURITY DEFINER 視圖（繞過 contacts 的 RLS），不應讓 authenticated 直接讀取
REVOKE SELECT ON public.contacts_masked          FROM authenticated;

COMMIT;

-- ============================================================
-- 回滾（若需要完全撤銷 MCP 存取模型；A～D 可回滾）
-- E（收斂 authenticated 授權）刻意不回滾：那些授權是 Supabase 的預設值、目前沒有任何程式使用，
-- 維持最小授權較安全。若確實需要還原某張表的授權，請個別 GRANT。
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS mcp_read ON public.solutions;
-- DROP POLICY IF EXISTS mcp_read ON public.companies;
-- DROP POLICY IF EXISTS mcp_read ON public.awards;
-- DROP POLICY IF EXISTS mcp_read ON public.cases;
-- DROP POLICY IF EXISTS mcp_read ON public.gov_registrations;
-- DROP POLICY IF EXISTS mcp_read ON public.industry_codes;
-- DROP POLICY IF EXISTS mcp_read ON public.data_sources;
-- DROP POLICY IF EXISTS mcp_read ON public.contacts;
-- REVOKE SELECT (contact_id, company_id, contact_name, title, office_phone) ON public.contacts FROM authenticated;
-- DROP FUNCTION IF EXISTS public.sf_mcp_ok();
-- DROP TABLE IF EXISTS public.sf_mcp_users;
-- COMMIT;

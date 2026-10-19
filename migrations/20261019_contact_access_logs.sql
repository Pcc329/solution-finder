-- ============================================================
-- 公司查詢 PR 1/3：聯絡資訊存取紀錄與搜尋紀錄欄位（2026-10-19）
-- 由 PPC 在 SQL Editor 執行；Codex 僅於本機 PostgreSQL 模擬。
-- 先部署 Preview 驗證表不存在時仍回 200，再執行本檔。
-- 僅保存加鹽 HMAC，不保存原始 IP、cookie、email 或手機。
-- 公開角色不得存取；明確 REVOKE 以覆蓋 Supabase 預設授權。
-- ============================================================

BEGIN;

CREATE TABLE public.contact_access_logs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  company_id     text        NOT NULL,
  contact_count  smallint    NOT NULL CHECK (contact_count >= 0),
  has_email      boolean     NOT NULL,
  has_mobile     boolean     NOT NULL,
  auth_method    text        NOT NULL CHECK (auth_method IN ('session','api_key')),
  session_hash   text,
  ip_hash        text
);
COMMENT ON TABLE public.contact_access_logs IS '公司聯絡資訊成功回傳的存取紀錄；僅 service_role 可讀寫，不保存原始 IP 或聯絡資訊。';
COMMENT ON COLUMN public.contact_access_logs.id IS '存取紀錄流水號，由資料庫自動產生。';
COMMENT ON COLUMN public.contact_access_logs.created_at IS '存取紀錄建立時間，預設為交易時間。';
COMMENT ON COLUMN public.contact_access_logs.company_id IS '本次查詢的公司統一編號。';
COMMENT ON COLUMN public.contact_access_logs.contact_count IS '本次實際回傳的聯絡人筆數，可為零。';
COMMENT ON COLUMN public.contact_access_logs.has_email IS '過濾無效 email 後是否仍有非空值；不保存 email 內容。';
COMMENT ON COLUMN public.contact_access_logs.has_mobile IS '過濾遮罩手機後是否仍有非空值；不保存手機內容。';
COMMENT ON COLUMN public.contact_access_logs.auth_method IS '驗證方式：session＝有效登入工作階段；api_key＝API 金鑰。';
COMMENT ON COLUMN public.contact_access_logs.session_hash IS 'sf_session 原值的加鹽 HMAC-SHA256；API 金鑰驗證或未設定 salt 時為空，不保存 cookie 原值。';
COMMENT ON COLUMN public.contact_access_logs.ip_hash IS '與限流相同來源 IP 的加鹽 HMAC-SHA256；未設定 salt 時為空，不保存原始 IP。';

CREATE INDEX contact_access_logs_created_at_idx ON public.contact_access_logs (created_at DESC);
CREATE INDEX contact_access_logs_ip_created_at_idx ON public.contact_access_logs (ip_hash, created_at DESC);
CREATE INDEX contact_access_logs_session_created_at_idx ON public.contact_access_logs (session_hash, created_at DESC);
CREATE INDEX contact_access_logs_company_created_at_idx ON public.contact_access_logs (company_id, created_at DESC);

ALTER TABLE public.contact_access_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_access_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.contact_access_logs TO service_role;
-- 不建立任何 policy，亦不開放公開角色的 sequence 權限。

ALTER TABLE public.search_logs
  ADD COLUMN input_type text CHECK (input_type IS NULL OR input_type IN ('tax_id','name','text')),
  ADD COLUMN match_type text CHECK (match_type IS NULL OR match_type IN ('exact','partial','none')),
  ADD COLUMN result_count integer CHECK (result_count IS NULL OR result_count >= 0);
COMMENT ON COLUMN public.search_logs.input_type IS '公司查詢輸入類型：統編、名稱或文字；舊紀錄為空，本 PR 不寫入。';
COMMENT ON COLUMN public.search_logs.match_type IS '公司查詢比對類型：完全、部分或無結果；舊紀錄為空，本 PR 不寫入。';
COMMENT ON COLUMN public.search_logs.result_count IS '公司查詢回傳筆數，非負整數；舊紀錄為空，本 PR 不寫入。';
CREATE INDEX search_logs_log_type_created_at_idx ON public.search_logs (log_type, created_at DESC);

-- 交易內自檢：任一不符即拋錯，整筆交易回滾。
DO $$
DECLARE
  n_tbl int; n_rls int; n_pub int; n_svc int;
  n_policy int; n_columns int; n_indexes int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE c.relrowsecurity)
    INTO n_tbl, n_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'contact_access_logs';
  SELECT count(*) INTO n_pub FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'contact_access_logs'
     AND grantee IN ('anon','authenticated');
  SELECT count(*) INTO n_svc FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'contact_access_logs'
     AND grantee = 'service_role' AND privilege_type = 'INSERT';
  SELECT count(*) INTO n_policy FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'contact_access_logs';
  SELECT count(*) INTO n_columns FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'search_logs'
     AND column_name IN ('input_type','match_type','result_count');
  SELECT count(*) INTO n_indexes FROM pg_indexes
   WHERE schemaname = 'public'
     AND ((tablename = 'contact_access_logs' AND indexname IN (
       'contact_access_logs_created_at_idx', 'contact_access_logs_ip_created_at_idx',
       'contact_access_logs_session_created_at_idx', 'contact_access_logs_company_created_at_idx'))
       OR (tablename = 'search_logs' AND indexname = 'search_logs_log_type_created_at_idx'));
  IF n_tbl <> 1 OR n_rls <> 1 OR n_pub <> 0 OR n_svc <> 1
     OR n_policy <> 0 OR n_columns <> 3 OR n_indexes <> 5 THEN
    RAISE EXCEPTION '自檢失敗：表 %/1、RLS %/1、公開角色授權 %（應0）、service_role INSERT %/1、policy %（應0）、搜尋欄位 %/3、索引 %/5',
      n_tbl, n_rls, n_pub, n_svc, n_policy, n_columns, n_indexes;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 獨立驗證（另開一次執行；預期結果見各段註解）
-- ============================================================
-- SELECT c.relname, c.relrowsecurity AS rls,
--   (SELECT count(*) FROM information_schema.role_table_grants g
--     WHERE g.table_schema='public' AND g.table_name=c.relname
--       AND g.grantee IN ('anon','authenticated')) AS public_grants,
--   (SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
--      FROM information_schema.role_table_grants g
--     WHERE g.table_schema='public' AND g.table_name=c.relname
--       AND g.grantee='service_role') AS service_role_privileges,
--   (SELECT count(*) FROM pg_policies p
--     WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
-- FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE n.nspname='public' AND c.relname='contact_access_logs';
-- 預期：1 列；rls=true、public_grants=0、service_role_privileges 含 INSERT,SELECT、policies=0。
--
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public'
--   AND (table_name='contact_access_logs'
--     OR (table_name='search_logs' AND column_name IN ('input_type','match_type','result_count')))
-- ORDER BY table_name, ordinal_position;
-- 預期：12 列（存取表 9 欄；搜尋表新增 text、text、integer 三欄），搜尋三欄皆可為空。
--
-- SELECT tablename, indexname, indexdef FROM pg_indexes
-- WHERE schemaname='public' AND indexname IN (
--   'contact_access_logs_created_at_idx', 'contact_access_logs_ip_created_at_idx',
--   'contact_access_logs_session_created_at_idx', 'contact_access_logs_company_created_at_idx',
--   'search_logs_log_type_created_at_idx') ORDER BY indexname;
-- 預期：5 列，created_at 皆為 DESC。

-- ============================================================
-- 回滾（僅限尚未寫入任何資料前；DROP TABLE 會一併移除表的四個索引）
-- ============================================================
-- BEGIN;
-- DROP TABLE public.contact_access_logs;
-- ALTER TABLE public.search_logs DROP COLUMN input_type, DROP COLUMN match_type, DROP COLUMN result_count;
-- DROP INDEX public.search_logs_log_type_created_at_idx;
-- COMMIT;

-- ============================================================
-- 保存期限：供 PPC 定期手動清理，本 PR 不新增排程
-- ============================================================
-- DELETE FROM public.contact_access_logs WHERE created_at < now() - interval '180 days';

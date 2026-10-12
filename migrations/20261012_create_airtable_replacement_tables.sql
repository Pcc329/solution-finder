-- ============================================================
-- Airtable 退場步驟①：建立取代 Airtable 寫入的 3 張表（2026-10-12）
-- 背景：api/ask.js（Ask_Logs）、api/claude.js（Search_Logs，Airtable表名為 Logs）、
--       api/feedback.js（Feedback）仍寫入 Airtable；改寫 Supabase 後 Airtable 才能停訂閱。
-- 決定（PPC，10/12）：
--   1. 直接切換（不雙寫）：10月AI搜尋約每天1次、AI顧問問答9/7後無使用，雙寫期間收不到足夠資料做對照；
--      改以 Vercel Preview 主動測試三支 API 驗證。
--   2. 先切換、再匯入歷史：切換後 Airtable 不再有新資料，匯出即為完整歷史。
--   3. 歷史匯入 Ask_Logs 802 筆、Search_Logs 1,212 筆（10/12 匯出數，切換後會再匯出一次）；
--      Feedback 唯一 1 筆為測試資料（部門＝測試），不搬（在精不在多），CSV 另存 OneDrive 備份。
-- 寫入身分：API 以 service_role 寫入（比照 csp-report.js）。10/5 已收回 anon 寫入權，不得為此開回。
-- 隱私：feedback_submissions 含同仁姓名、部門；ask_logs 含使用者問題 → anon／authenticated 不得有任何權限。
-- ⚠️ Supabase 預設會把 public schema 新表的權限授予 anon／authenticated，
--    因此本檔必須「明確 REVOKE」，不能只靠 RLS。
-- ============================================================

BEGIN;

-- ── 1. AI 顧問問答紀錄（取代 Airtable Ask_Logs）──────────────
CREATE TABLE public.ask_logs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  question       text        NOT NULL,
  search_query   text        NOT NULL DEFAULT '',
  result_count   integer     NOT NULL CHECK (result_count >= 0),
  answer_length  integer     NOT NULL CHECK (answer_length >= 0),
  source         text        NOT NULL DEFAULT 'api'
                 CHECK (source IN ('api','airtable_import'))
);
COMMENT ON TABLE  public.ask_logs IS 'AI顧問問答紀錄（api/ask.js）。2026-10-12 取代 Airtable Ask_Logs。';
COMMENT ON COLUMN public.ask_logs.source IS 'api＝切換後由API寫入；airtable_import＝自Airtable匯入的歷史（時間精度到分鐘）';

-- ── 2. 方案探索 AI 搜尋紀錄（取代 Airtable Logs／程式內稱 Search_Logs）──
CREATE TABLE public.search_logs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  search_query   text        NOT NULL,
  log_type       text        NOT NULL DEFAULT 'ai_search',
  source         text        NOT NULL DEFAULT 'api'
                 CHECK (source IN ('api','airtable_import'))
);
COMMENT ON TABLE  public.search_logs IS '方案探索AI搜尋紀錄（api/claude.js）。2026-10-12 取代 Airtable Logs（程式內稱 Search_Logs）。';
COMMENT ON COLUMN public.search_logs.source IS 'api＝切換後由API寫入；airtable_import＝自Airtable匯入的歷史（時間精度到分鐘）';

-- ── 3. 測試回報表單（取代 Airtable Feedback）──────────────────
-- 長度與範圍限制與 api/feedback.js 的驗證一致；允許值清單由 API 檢查。
-- 無 source 欄：Feedback 不匯入歷史，全部資料皆來自 API。
CREATE TABLE public.feedback_submissions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  name            text     NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  department      text              CHECK (char_length(department) <= 50),
  milestone       text     NOT NULL CHECK (char_length(milestone) BETWEEN 1 AND 50),
  detail          text     NOT NULL CHECK (char_length(detail) BETWEEN 1 AND 2000),
  score           smallint          CHECK (score BETWEEN 1 AND 5),
  relevant_count  smallint          CHECK (relevant_count BETWEEN 0 AND 5),
  path_choice     text              CHECK (char_length(path_choice) <= 20),
  would_cite      text              CHECK (char_length(would_cite) <= 10)
);
COMMENT ON TABLE public.feedback_submissions IS '測試回報表單（api/feedback.js）。2026-10-12 取代 Airtable Feedback。含同仁姓名、部門，僅 service_role 可存取。';

-- ── 4. 權限：RLS 開啟、不建任何 policy；明確收回公開角色 ─────
ALTER TABLE public.ask_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ask_logs, public.search_logs, public.feedback_submissions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.ask_logs, public.search_logs, public.feedback_submissions TO service_role;

-- ── 5. 交易內自檢（任一不符整個回滾）──────────────────────────
DO $$
DECLARE n_tbl int; n_rls int; n_pub int; n_svc int;
BEGIN
  SELECT count(*) INTO n_tbl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND c.relname IN ('ask_logs','search_logs','feedback_submissions');
  SELECT count(*) INTO n_rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relrowsecurity
     AND c.relname IN ('ask_logs','search_logs','feedback_submissions');
  SELECT count(*) INTO n_pub FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
     AND table_name IN ('ask_logs','search_logs','feedback_submissions');
  SELECT count(*) INTO n_svc FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee = 'service_role' AND privilege_type = 'INSERT'
     AND table_name IN ('ask_logs','search_logs','feedback_submissions');
  IF n_tbl <> 3 OR n_rls <> 3 OR n_pub <> 0 OR n_svc <> 3 THEN
    RAISE EXCEPTION '自檢失敗：表 %/3、RLS %/3、公開角色授權 %（應0）、service_role INSERT %/3',
      n_tbl, n_rls, n_pub, n_svc;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 獨立驗證（另開一次執行，預期見各行註解）
-- ============================================================
-- select c.relname as 表, c.relrowsecurity as rls,
--        (select count(*) from information_schema.role_table_grants g
--          where g.table_schema='public' and g.table_name=c.relname
--            and g.grantee in ('anon','authenticated')) as 公開角色授權數,
--        (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g
--          where g.table_schema='public' and g.table_name=c.relname and g.grantee='service_role') as service_role權限,
--        (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policy數
--   from pg_class c join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public' and c.relname in ('ask_logs','search_logs','feedback_submissions')
--  order by 1;
-- 預期：3 列；rls 全為 true；公開角色授權數全為 0；service_role 權限至少含 INSERT,SELECT；policy數全為 0
-- （service_role 可能因 Supabase 預設權限而有更多權限，如 DELETE／UPDATE，屬正常）

-- ============================================================
-- 回滾（僅限尚未寫入任何資料前；寫入後請勿使用）
-- ============================================================
-- BEGIN;
-- DROP TABLE public.ask_logs, public.search_logs, public.feedback_submissions;
-- COMMIT;

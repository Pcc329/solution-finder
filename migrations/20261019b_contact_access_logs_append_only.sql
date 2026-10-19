-- ============================================================
-- 聯絡資訊存取紀錄：service_role 限為追加與讀取（2026-10-19）
-- 前置：PPC 已執行 20261019_contact_access_logs.sql。
-- Supabase 新表預設 ALL；GRANT SELECT, INSERT 不會收回其他權限。
-- 本檔由 PPC 在 SQL Editor 執行；不修改已執行的原 migration。
-- 保留 SELECT、INSERT，明確收回修改、刪除及其他表權限。
-- 180 天清理仍由 PPC 以管理者身分執行，不使用 service_role。
-- ============================================================

BEGIN;

REVOKE UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.contact_access_logs FROM service_role;

-- 自檢同時確認直接授權與有效權限，避免 PUBLIC／繼承權限漏檢。
DO $$
DECLARE
  granted_privileges text[];
  effective_privileges text[];
BEGIN
  SELECT array_agg(DISTINCT privilege_type::text ORDER BY privilege_type::text)
    INTO granted_privileges
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'contact_access_logs'
     AND grantee = 'service_role';

  SELECT array_agg(privilege ORDER BY privilege) INTO effective_privileges
    FROM unnest(ARRAY['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']) AS p(privilege)
   WHERE has_table_privilege('service_role', 'public.contact_access_logs', privilege);

  IF granted_privileges IS DISTINCT FROM ARRAY['INSERT','SELECT']::text[]
     OR effective_privileges IS DISTINCT FROM ARRAY['INSERT','SELECT']::text[]
     OR has_any_column_privilege('service_role', 'public.contact_access_logs', 'UPDATE')
     OR has_any_column_privilege('service_role', 'public.contact_access_logs', 'REFERENCES') THEN
    RAISE EXCEPTION '自檢失敗：service_role 授權 %、有效表權限 %（皆應僅為 INSERT,SELECT），且不得有欄位 UPDATE／REFERENCES 權限',
      granted_privileges, effective_privileges;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 獨立驗證（另開一次執行）
-- ============================================================
-- SELECT string_agg(DISTINCT privilege_type, ',' ORDER BY privilege_type) AS service_role_privileges
-- FROM information_schema.role_table_grants
-- WHERE table_schema='public' AND table_name='contact_access_logs' AND grantee='service_role';
-- 預期：1 列，service_role_privileges = INSERT,SELECT。
--
-- SELECT privilege, has_table_privilege('service_role', 'public.contact_access_logs', privilege) AS allowed
-- FROM unnest(ARRAY['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']) AS p(privilege);
-- 預期：7 列，僅 INSERT、SELECT 為 true，其餘皆 false。

-- ============================================================
-- 回滾（恢復本次撤銷前的 ALL 表權限；會重新允許修改／刪除紀錄）
-- 僅由 PPC 在確認需要回復舊權限時另行執行；不刪除任何資料。
-- ============================================================
-- BEGIN;
-- GRANT UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.contact_access_logs TO service_role;
-- COMMIT;

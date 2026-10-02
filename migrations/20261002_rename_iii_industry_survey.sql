-- ============================================================
-- 資策會產業調查：來源名稱統一（2026-10-02 已於正式站執行）
-- 舊名「領域型調查(人工搜查)」→ 新名「資策會產業調查」
-- 搭配 PR #199（前端 PROGRAMS／sources.html／dashboard／strategy-guide 改名與「非政府審核」揭露）。
-- 順序：先 merge PR #199 並確認 Vercel 部署完成（來源篩選出現「資策會產業調查」與 ？ 提示），再執行本檔。
-- 影響範圍（改名前快照）：solutions.program_type 133 筆、program_sources.program_type 1 筆、data_sources.source_name 1 筆（SRC-013）
-- 檢查：program_type 無外鍵；program_sources 主鍵為 program_type（新名不存在，無衝突）；三表皆無觸發器
-- 結果：133／1／1，交易內筆數檢查通過；改名後全庫 2,487、前台可見 2,268 不變；資策會產業調查 正常132／疑似0／已下架1
-- ============================================================

BEGIN;

DO $$
DECLARE n_sol int; n_ps int; n_ds int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.solutions WHERE program_type = '資策會產業調查')
     OR EXISTS (SELECT 1 FROM public.program_sources WHERE program_type = '資策會產業調查')
     OR EXISTS (SELECT 1 FROM public.data_sources WHERE source_name = '資策會產業調查') THEN
    RAISE EXCEPTION '新名已存在，中止';
  END IF;

  UPDATE public.solutions SET program_type = '資策會產業調查' WHERE program_type = '領域型調查(人工搜查)';
  GET DIAGNOSTICS n_sol = ROW_COUNT;
  UPDATE public.program_sources SET program_type = '資策會產業調查', updated_at = now() WHERE program_type = '領域型調查(人工搜查)';
  GET DIAGNOSTICS n_ps = ROW_COUNT;
  UPDATE public.data_sources SET source_name = '資策會產業調查', updated_at = now() WHERE source_name = '領域型調查(人工搜查)';
  GET DIAGNOSTICS n_ds = ROW_COUNT;

  IF n_sol <> 133 OR n_ps <> 1 OR n_ds <> 1 THEN
    RAISE EXCEPTION '筆數不符，回滾：solutions=%, program_sources=%, data_sources=%（預期 133/1/1）', n_sol, n_ps, n_ds;
  END IF;
END $$;

COMMIT;

-- 回滾（整案撤銷；同樣需先確認前端也回到舊版，否則篩選會出現 0 筆）：
-- BEGIN;
-- UPDATE public.solutions       SET program_type = '領域型調查(人工搜查)' WHERE program_type = '資策會產業調查';
-- UPDATE public.program_sources SET program_type = '領域型調查(人工搜查)', updated_at = now() WHERE program_type = '資策會產業調查';
-- UPDATE public.data_sources    SET source_name  = '領域型調查(人工搜查)', updated_at = now() WHERE source_name = '資策會產業調查';
-- COMMIT;

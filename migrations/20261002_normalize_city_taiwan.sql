-- ============================================================
-- 縣市寫法統一為官方「臺」（2026-10-02，PPC 決定）
-- 背景：稅籍名冊補值（10/2 上午）使用「臺」，網站原有資料使用「台」，同一座城市被拆成兩種寫法
--       （臺北市 172／台北市 322、臺中市 55／台中市 76、臺南市 23／台南市 9、臺東縣 1／台東縣 2）。
-- 決定：以官方寫法「臺」為準；政府資料（商工、財政部、稅籍）本來就是「臺」，之後匯入不需轉換。
-- 影響：僅 companies.city 的 409 家（台北市 322、台中市 76、台南市 9、台東縣 2）；網站以 normalizeCity() 將臺轉為台後統計，
--       儀表板數字不變；卡片等處只會顯示官方寫法。
-- 注意：此檔執行後，company_field_log 會新增 409 筆留痕，maintenance_activity()（儀表板「資料維護」）的今日數字會變多，
--       Codex 規格書的驗收以該函式實際回傳為準。
-- ============================================================
-- 【實際執行日：2026-10-05】本檔以 10/2 為名建立，但 SQL 於 10/5（週一）才在 SQL Editor 執行。
--   company_field_log 的 changed_at 為準（2026-10-05）；留痕 reason 字串誤寫為「2026-10-02 縣市寫法統一…」，
--   審計紀錄只增不改，故保留原文；下方回滾語句以該字串開頭比對，仍然有效。
--   執行結果（獨立驗證 7/7）：含「台」字 0、公司總數 1,103、region 空 167、city 空 168、留痕 409、
--   臺北市 494／臺中市 131／臺南市 32／臺東縣 3、前台可見方案 2,268；maintenance_activity(7) 公司不重複總數 898。

-- 第一段：快照（先看分布）
-- select city, count(*) from public.companies where city like '%台%' or city like '%臺%' group by 1 order by 2 desc;

-- 第二段：單一交易（留痕→更新→筆數檢查→殘留檢查，任一不符整個回滾）
BEGIN;
DO $$
DECLARE n_exp int; n_done int;
BEGIN
  SELECT count(*) INTO n_exp FROM public.companies
   WHERE city IN ('台北市','台中市','台南市','台東縣');
  INSERT INTO public.company_field_log (company_id, field_name, old_value, new_value, reason)
  SELECT company_id, 'city', city, replace(city,'台','臺'),
         '2026-10-02 縣市寫法統一為官方「臺」（PPC決定；稅籍與政府資料皆用臺）'
    FROM public.companies WHERE city IN ('台北市','台中市','台南市','台東縣');
  UPDATE public.companies SET city = replace(city,'台','臺'), updated_at = now()
   WHERE city IN ('台北市','台中市','台南市','台東縣');
  GET DIAGNOSTICS n_done = ROW_COUNT;
  IF n_done <> n_exp THEN RAISE EXCEPTION '筆數不符 %/%', n_done, n_exp; END IF;
  IF EXISTS (SELECT 1 FROM public.companies WHERE city LIKE '%台%') THEN
    RAISE EXCEPTION '仍有「台」字殘留（非預期寫法），請人工檢視後再改';
  END IF;
END $$;
COMMIT;

-- 第三段：獨立驗證（另開呼叫）
-- 預期：只剩 臺北市 494／臺中市 131／臺南市 32／臺東縣 3；公司總數 1,103；region 空 167；city 空 168；本次留痕 409
-- select city, count(*) from public.companies where city like '%台%' or city like '%臺%' group by 1 order by 2 desc;
-- select (select count(*) from public.companies) as 公司總數,
--        (select count(*) from public.companies where coalesce(region,'')='') as region空,
--        (select count(*) from public.companies where coalesce(city,'')='') as city空,
--        (select count(*) from public.company_field_log where field_name='city' and old_value like '%台%') as 本次留痕;
-- select * from public.maintenance_activity(7) order by 1 desc nulls first, 2, 3;

-- 回滾（依留痕的舊值還原）：
-- BEGIN;
-- UPDATE public.companies c SET city = l.old_value, updated_at = now()
--   FROM public.company_field_log l
--  WHERE l.company_id = c.company_id AND l.field_name = 'city'
--    AND l.reason LIKE '2026-10-02 縣市寫法統一%';
-- COMMIT;

-- ============================================================
-- 方案名稱佔位字清除＋資料庫約束（v2，2026-10-23）
-- v2：改為單一 DO 區塊、不使用暫存表。
--   原因：10/23 兩份含暫存表的遷移，在 SQL Editor 經「Run without RLS」執行後皆顯示
--   「暫存表不存在」錯誤，事後查證資料其實已變更；畫面結果與實際不一致。
--   不建立任何資料表即不會出現該對話框；單一 DO 區塊本身為一個交易，任一檢查失敗整段撤銷。
-- 內容與 v1 相同：
--   1. 放寬 solutions.solution_name 的 NOT NULL
--   2. 26 筆「缺」（皆已下架）改 null，先寫 26 筆留痕（狀態不變，reason 記原值）
--   3. companies.website「無」1 筆改 null
--   4. 約束：名稱 null 只限已下架（record_status 以 coalesce 處理 null）；名稱不可空白或佔位字；
--      website 不可為佔位字
-- 前提：PR #262 已部署（網站與 MCP 對 null 與佔位字皆顯示「（名稱未提供）」）
-- ============================================================
do $mig$
declare
  ph constant text[] := array['缺','缺漏','待補','無','-','—','N/A','NA','null','?','？'];
  ids text[];
  n int; n_del int; n_web int; b_log bigint; b_sol bigint;
begin
  -- 前置檢查
  select array_agg(solution_id order by solution_id),
         count(*), count(*) filter (where record_status like '已下架%')
    into ids, n, n_del
  from public.solutions where solution_name = '缺';
  if n <> 26 or n_del <> 26 then
    raise exception '前置檢查失敗：名稱為「缺」共 % 筆、其中已下架 % 筆（預期 26／26）。可能已執行過或資料有變動，已中止', n, n_del;
  end if;
  select count(*) into n_web from public.companies where btrim(website) = '無';
  if n_web <> 1 then raise exception '前置檢查失敗：website 為「無」共 % 筆（預期 1），已中止', n_web; end if;
  if exists (select 1 from pg_constraint where conname in ('solutions_solution_name_valid', 'companies_website_not_placeholder')) then
    raise exception '前置檢查失敗：約束已存在，已中止';
  end if;

  select count(*) into b_log from public.solution_status_log;
  select count(*) into b_sol from public.solutions;

  alter table public.solutions alter column solution_name drop not null;

  insert into public.solution_status_log (solution_id, status_change, reason)
  select solution_id, record_status,
         '2026-10-20 名稱佔位字清除（2026-10-23 執行）：solution_name 原值「缺」（8 月 triage 臺灣雲市集缺名稱 26 筆）改為 null，表示來源未提供名稱；狀態不變。網站與 MCP 顯示「（名稱未提供）」。'
  from public.solutions where solution_id = any(ids);

  update public.solutions set solution_name = null, updated_at = now() where solution_id = any(ids);
  update public.companies set website = null where btrim(website) = '無';

  alter table public.solutions add constraint solutions_solution_name_valid check (
    (solution_name is null and coalesce(record_status, '') like '已下架%')
    or (solution_name is not null
        and btrim(solution_name) <> ''
        and btrim(solution_name) not in ('缺','缺漏','待補','無','-','—','N/A','NA','null','?','？'))
  );
  comment on constraint solutions_solution_name_valid on public.solutions is
    '方案名稱不可為空白或佔位字；只有已下架方案可以沒有名稱（null）。佔位字清單與 public/solution-name.js、sf-mcp/index.ts 一致。2026-10-23';

  alter table public.companies add constraint companies_website_not_placeholder check (
    website is null or btrim(website) not in ('缺','缺漏','待補','無','-','—','N/A','NA','null','?','？')
  );
  comment on constraint companies_website_not_placeholder on public.companies is
    '公司網址不可為佔位字；沒有網址請存 null。2026-10-23';

  -- 自檢
  if (select count(*) from public.solutions where solution_id = any(ids) and solution_name is null) <> 26 then
    raise exception '自檢失敗：26 筆名稱未全部改為 null';
  end if;
  if exists (select 1 from public.solutions where solution_name = '缺') then raise exception '自檢失敗：仍有名稱為「缺」'; end if;
  if (select count(*) from public.solution_status_log) - b_log <> 26 then raise exception '自檢失敗：留痕筆數不是 26'; end if;
  if (select count(*) from public.solutions) <> b_sol then raise exception '自檢失敗：方案總數改變'; end if;
  if exists (select 1 from public.solutions where solution_name is null and coalesce(record_status, '') not like '已下架%') then
    raise exception '自檢失敗：有未下架方案沒有名稱';
  end if;
  if exists (select 1 from public.companies where btrim(website) = '無') then raise exception '自檢失敗：website 仍有「無」'; end if;
  if (select count(*) from pg_constraint where conname in ('solutions_solution_name_valid', 'companies_website_not_placeholder') and convalidated) <> 2 then
    raise exception '自檢失敗：約束未建立或未驗證';
  end if;

  raise notice '自檢通過：26 筆名稱改為 null、留痕 26 筆、website 1 筆改為 null、約束 2 條生效';
end
$mig$;

-- ============================================================
-- 交易外獨立驗證（另開查詢執行）
-- ============================================================
-- select (select count(*) from public.solutions where solution_name is null) as 名稱null,
--        (select count(*) from public.solutions where solution_name = '缺') as 名稱缺,
--        (select count(*) from public.solution_status_log where reason like '2026-10-20 名稱佔位字清除%') as 本次留痕,
--        (select count(*) from public.companies where website = '無') as website無,
--        (select string_agg(conname, '、') from pg_constraint
--          where conname in ('solutions_solution_name_valid','companies_website_not_placeholder')) as 約束;
-- 預期：26、0、26、0、兩條約束名稱

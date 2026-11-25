-- ============================================================
-- 案例反推補建 6 筆服務類別修正（SOL-CASE-0001～0006）
-- 日期：2026-11-24（v2：target_industry 為陣列欄位，v1 於前置檢查失敗、未寫入）　執行：PPC 於 Supabase SQL Editor 一次執行整份（單一交易；任一檢查失敗即整份撤銷）
-- 背景：2026-11-23 列出 industry_category 實際值，除規定 9 類外另有 6 種，皆屬這 6 筆且只有髒值，
--       首頁類別篩選下完全找不到。原值多為產業別（應屬 target_industry）或自由文字。
-- 依據：功能相近方案的現行分類（EMS→生產物流：SOL-0170、SOL-1210、SOL-1038、SOL-0325；
--       刀具壽命預測→生產物流：SOL-1003）、MCP 類別對照表；SOL-CASE-0002 依案例文章（研發＋行銷兩類）。
--       2026-11-24 PPC 同意，後續有問題再改。
-- 內容：industry_category 6 筆；屬產業別的 4 筆原值寫入 target_industry（陣列，單一元素；目前為空才寫）；
--       「節能減碳」「行銷數位轉型」不是產業別，不寫入 target_industry，原值保留於留痕。
-- 預期：留痕 +6；全庫 industry_category 不在 9 類的值 6 → 0；狀態與前台可見筆數不變
-- ============================================================

begin;

create temp table v_fix (solution_id text primary key, old_cat text, new_cat text, new_target text, reason text) on commit drop;
insert into v_fix values
 ('SOL-CASE-0001','節能減碳','生產物流',null,
  '2026-11-24 類別修正：原值「節能減碳」不在 9 類，類別篩選找不到。依功能相近之能源管理系統現行分類（SOL-0170、SOL-1210、SOL-1038、SOL-0325 皆為生產物流）改為生產物流。原值非產業別，不寫入 target_industry。'),
 ('SOL-CASE-0002','行銷數位轉型','研發創新,行銷推廣',null,
  '2026-11-24 類別修正：原值「行銷數位轉型」不在 9 類。依案例文章（打通配方與市場的任督二脈）：AI 解析文獻專利生成配方為主要價值（研發效率 +33%）、AI 生成行銷內容與族群建模為次要用途，改為研發創新,行銷推廣。原值非產業別，不寫入 target_industry。信心：中（摘要註記技術細節待查證）。'),
 ('SOL-CASE-0003','精品咖啡業','研發創新','精品咖啡業',
  '2026-11-24 類別修正：原值「精品咖啡業」為產業別，搬至 target_industry；AI 咖啡風味評鑑屬 AI／資料分析，依對照表改為研發創新。'),
 ('SOL-CASE-0004','CNC精密加工業','生產物流','CNC精密加工業',
  '2026-11-24 類別修正：原值「CNC精密加工業」為產業別，搬至 target_industry；刀具壽命預測依功能相近之 SOL-1003（生產物流）改為生產物流。'),
 ('SOL-CASE-0005','食品製造業(冷鏈)','生產物流','食品製造業(冷鏈)',
  '2026-11-24 類別修正：原值「食品製造業(冷鏈)」為產業別，搬至 target_industry；冷鏈溫度監測依對照表（倉儲、物流→生產物流）改為生產物流。'),
 ('SOL-CASE-0006','製造業','生產物流','製造業',
  '2026-11-24 類別修正：原值「製造業」為產業別，搬至 target_industry；空壓系統變頻優化屬工廠設備節能，與能源管理同類，改為生產物流。');

create temp table v_before on commit drop as
select
  (select count(*) from public.solutions where record_status is null or record_status not like '已下架%') as visible,
  (select count(*) from public.solution_status_log) as log_rows,
  (select count(*) from public.solutions s
    where exists (select 1 from unnest(string_to_array(s.industry_category, ',')) x
                  where trim(x) not in ('銷售管理','行銷推廣','生產物流','協作辦公','人力資源','資安合規','研發創新','醫療照護','暫無法分類'))) as bad_rows;

-- ---------- 前置檢查 ----------
do $pre$
declare n int;
begin
  select count(*) into n from public.solutions s join v_fix v using (solution_id)
   where s.program_type = '案例反推補建' and s.industry_category = v.old_cat;
  if n <> 6 then raise exception '前置檢查失敗：類別符合原值的只有 % 筆（預期 6）。可能已執行過或已被改動', n; end if;

  select count(*) into n from public.solutions s join v_fix v using (solution_id)
   where v.new_target is not null and coalesce(cardinality(s.target_industry), 0) <> 0;
  if n <> 0 then raise exception '前置檢查失敗：% 筆的 target_industry 已有值，不覆蓋，已中止', n; end if;

  -- target_industry 須為陣列欄位（v1 誤以為文字）
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'solutions' and column_name = 'target_industry') <> 'ARRAY' then
    raise exception '前置檢查失敗：target_industry 不是陣列欄位，已中止';
  end if;

  if (select bad_rows from v_before) <> 6 then
    raise exception '前置檢查失敗：全庫類別不在 9 類的方案有 % 筆（預期 6），與 2026-11-23 查詢不符', (select bad_rows from v_before);
  end if;
end $pre$;

-- ---------- 寫入 ----------
update public.solutions s
   set industry_category = v.new_cat,
       target_industry = case when v.new_target is not null then array[v.new_target] else s.target_industry end,
       updated_at = now()
  from v_fix v
 where s.solution_id = v.solution_id;

insert into public.solution_status_log (solution_id, status_change, reason)
select v.solution_id, s.record_status,
       v.reason || '（原 industry_category：' || v.old_cat || '）'
  from v_fix v join public.solutions s using (solution_id);

-- ---------- 交易內自檢 ----------
do $chk$
declare b record; n int;
begin
  select * into b from v_before;
  select count(*) into n from public.solutions s join v_fix v using (solution_id) where s.industry_category = v.new_cat;
  if n <> 6 then raise exception '自檢失敗：類別更新 % 筆（預期 6）', n; end if;
  select count(*) into n from public.solutions s join v_fix v using (solution_id)
   where v.new_target is not null and s.target_industry::text[] = array[v.new_target];
  if n <> 4 then raise exception '自檢失敗：target_industry 寫入 % 筆（預期 4）', n; end if;
  select count(*) into n from public.solutions s
   where exists (select 1 from unnest(string_to_array(s.industry_category, ',')) x
                 where trim(x) not in ('銷售管理','行銷推廣','生產物流','協作辦公','人力資源','資安合規','研發創新','醫療照護','暫無法分類'));
  if n <> 0 then raise exception '自檢失敗：仍有 % 筆類別不在 9 類', n; end if;
  if (select count(*) from public.solution_status_log) - b.log_rows <> 6 then raise exception '自檢失敗：留痕筆數不符（預期 +6）'; end if;
  if (select count(*) from public.solutions where record_status is null or record_status not like '已下架%') <> b.visible then
    raise exception '自檢失敗：前台可見筆數改變';
  end if;
  raise notice '自檢通過：類別 6、target_industry 4、留痕 6；類別髒值 6 → 0';
end $chk$;

commit;

-- ============================================================
-- 交易外獨立驗證（commit 後另開分頁執行）
-- ============================================================
-- select solution_id, solution_name, industry_category, target_industry, record_status
--   from public.solutions where solution_id like 'SOL-CASE-%' order by 1;
--
-- select trim(x) as 類別, count(*) as 筆數
--   from public.solutions, unnest(string_to_array(industry_category, ',')) as x
--  group by 1 order by 2 desc;
--
-- select count(*) as 今日留痕 from public.solution_status_log where reason like '2026-11-24 類別修正%';
--
-- 預期：第二段只剩 9 類；今日留痕 6

-- ============================================================
-- 回復（需要時另開分頁執行；寫一筆回復留痕，不刪除本次紀錄）
-- ============================================================
-- update public.solutions s set industry_category = v.old_cat,
--        target_industry = case when v.new_target is not null then null else s.target_industry end
--   from (values ('SOL-CASE-0001','節能減碳',null),('SOL-CASE-0002','行銷數位轉型',null),
--                ('SOL-CASE-0003','精品咖啡業','x'),('SOL-CASE-0004','CNC精密加工業','x'),
--                ('SOL-CASE-0005','食品製造業(冷鏈)','x'),('SOL-CASE-0006','製造業','x')) v(solution_id, old_cat, new_target)
--  where s.solution_id = v.solution_id;

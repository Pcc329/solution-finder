-- ============================================================
-- 新創嚴選網：16 筆「疑似已下架」改為「已下架」（官網完整清單連續三次未出現）
-- 日期：2026-10-15
-- 執行：PPC 於 Supabase SQL Editor 一次執行整份（單一交易；任一檢查失敗即整份撤銷）
-- 證據：9/21（144 筆）、9/30（145 筆）、10/15（API 完整清單 146 筆，page 1＋2、total=146、id 無重複）
--       三次皆未出現；10/15 以正規化名稱比對，官網未收錄的 18 筆與這 16 筆名稱相似度皆 ≤ 0.42，且無同公司對應，
--       判斷非改名。資料庫無官網 ID，比對方式為名稱比對。
-- 影響：前台可見 −16；5 家公司前台不再有可見方案（嗨筆記、康斯特、成星資訊、百林商智、飛思智聯）
-- ============================================================

begin;

create temp table v_ids (solution_id text primary key) on commit drop;
insert into v_ids values
 ('SOL-0146'),('SOL-0210'),('SOL-0326'),('SOL-0674'),('SOL-0803'),('SOL-0859'),
 ('SOL-0861'),('SOL-0954'),('SOL-0970'),('SOL-0992'),('SOL-1006'),('SOL-1014'),
 ('SOL-1036'),('SOL-1037'),('SOL-1088'),('SOL-1199');

create temp table v_before on commit drop as
select
  (select count(*) from public.solutions where record_status is null or record_status not like '已下架%') as visible,
  (select count(*) from public.solution_status_log) as log_rows;

do $pre$
declare n int;
begin
  -- 16 筆都存在、都是新創嚴選網、目前狀態都正好是 9/21 標記的疑似狀態
  select count(*) into n
  from public.solutions s join v_ids using (solution_id)
  where s.program_type = '新創嚴選網'
    and s.record_status = '疑似已下架_新創嚴選網方案未持續上架未逐筆驗證';
  if n <> 16 then
    raise exception '前置檢查失敗：符合條件的只有 % 筆（預期 16）。可能已執行過、或狀態已被改動，已中止', n;
  end if;
  -- 新創嚴選網目前應為 正常128／疑似16／已下架8
  if (select count(*) filter (where record_status like '疑似%') from public.solutions where program_type = '新創嚴選網') <> 16
     or (select count(*) filter (where record_status like '已下架%') from public.solutions where program_type = '新創嚴選網') <> 8 then
    raise exception '前置檢查失敗：新創嚴選網目前分布與 10/15 匯出不符，已中止';
  end if;
end $pre$;

update public.solutions s
set record_status = '已下架_新創嚴選網官網完整清單連續三次未出現',
    updated_at = now()
from v_ids
where s.solution_id = v_ids.solution_id;

insert into public.solution_status_log (solution_id, status_change, reason)
select solution_id,
       '已下架_新創嚴選網官網完整清單連續三次未出現',
       '2026-10-15 完整稽核：新創嚴選網官網 API 完整清單（page=1、2，limit=100，total=146，id 無重複）未出現此方案；'
       || '9/21（144 筆）、9/30（145 筆）亦未出現，連續三次。以正規化名稱比對（資料庫無官網 ID），官網未收錄的 18 筆與本筆名稱相似度皆 ≤ 0.42 且無同公司對應，判斷非改名。'
       || '原狀態「疑似已下架_新創嚴選網方案未持續上架未逐筆驗證」（9/21）。'
from v_ids;

do $chk$
declare b record; v_vis bigint; v_log bigint; n_norm bigint; n_sus bigint; n_del bigint;
begin
  select * into b from v_before;
  select count(*) into v_vis from public.solutions where record_status is null or record_status not like '已下架%';
  select count(*) into v_log from public.solution_status_log;
  select count(*) filter (where record_status is null or (record_status not like '疑似%' and record_status not like '已下架%')),
         count(*) filter (where record_status like '疑似%'),
         count(*) filter (where record_status like '已下架%')
    into n_norm, n_sus, n_del
  from public.solutions where program_type = '新創嚴選網';
  if b.visible - v_vis <> 16 then raise exception '自檢失敗：前台可見減少 % 筆（預期 16）', b.visible - v_vis; end if;
  if v_log - b.log_rows <> 16 then raise exception '自檢失敗：留痕新增 % 筆（預期 16）', v_log - b.log_rows; end if;
  if n_norm <> 128 or n_sus <> 0 or n_del <> 24 then
    raise exception '自檢失敗：新創嚴選網分布為 正常%／疑似%／已下架%（預期 128／0／24）', n_norm, n_sus, n_del;
  end if;
  if (select count(*) from public.solutions s join v_ids using (solution_id)
      where s.record_status = '已下架_新創嚴選網官網完整清單連續三次未出現') <> 16 then
    raise exception '自檢失敗：16 筆狀態未全部更新';
  end if;
  raise notice '自檢通過：16 筆改為已下架、留痕 16 筆、前台可見 % → %', b.visible, v_vis;
end $chk$;

commit;

-- ============================================================
-- 交易外獨立驗證（另開查詢執行）
-- ============================================================
-- select program_type,
--        count(*) filter (where record_status is null or (record_status not like '疑似%' and record_status not like '已下架%')) as 正常,
--        count(*) filter (where record_status like '疑似%') as 疑似,
--        count(*) filter (where record_status like '已下架%') as 已下架,
--        (select count(*) from public.solution_status_log
--          where status_change = '已下架_新創嚴選網官網完整清單連續三次未出現') as 本次留痕
-- from public.solutions where program_type = '新創嚴選網' group by 1;

-- ============================================================
-- 回復（需要時另開查詢執行；改回原狀態並另寫一筆留痕，不刪除本次紀錄）
-- ============================================================
-- begin;
-- insert into public.solution_status_log (solution_id, status_change, reason)
-- select solution_id, '疑似已下架_新創嚴選網方案未持續上架未逐筆驗證', '回復 2026-10-15 下架變更（原因：＿＿＿＿）'
--   from public.solutions where record_status = '已下架_新創嚴選網官網完整清單連續三次未出現';
-- update public.solutions set record_status = '疑似已下架_新創嚴選網方案未持續上架未逐筆驗證', updated_at = now()
--  where record_status = '已下架_新創嚴選網官網完整清單連續三次未出現';
-- commit;

begin;

do $migration$
declare
  rainforest_source constant text := '智慧雨林擴散案（廠商官網）';
begin
  insert into public.companies (company_id, company_name, website, note)
  values ('90249191', '快帶科技股份有限公司', 'https://www.kuai-dai.com',
          '115/07/27 由「快帶科技有限公司」更名，統編不變（商工登記公示資料名稱變更歷程）。')
  on conflict (company_id) do nothing;

  if not found then
    raise exception '智慧雨林試點中止：公司 90249191 已存在。';
  end if;

  perform 1 from public.companies where company_id = '50932719' for key share;
  if not found then
    raise exception '智慧雨林試點中止：找不到既有公司 50932719。';
  end if;

  if exists (select 1 from public.data_sources where source_name = rainforest_source) then
    raise exception '智慧雨林試點中止：來源「%」已存在。', rainforest_source;
  end if;

  insert into public.data_sources (
    source_id, source_name, url, organizer, program_name, program_year,
    acquisition_channel, record_count_estimate, notes
  ) values (
    'SRC-RF-001', rainforest_source, 'https://www.stsvpo.org.tw/tw/downloads/48', '經濟部商業發展署',
    '大南方新矽谷推動方案 115 年度智慧雨林產業創生計畫－智慧商業服務領域', '115年度',
    '以擴散案核定名單為線索，人工查核廠商官網', 2,
    '擴散案核定之資服業者中，官網有具名產品且與核定計畫名稱相關者，以人工查核收錄；方案內容為廠商自述，未經平台審核。'
  );

  insert into public.solutions (
    solution_id, company_id, solution_name, program_type, data_source, website_url,
    description_short, has_ai, record_status
  ) values
    ('SOL-RF-0001', '90249191', 'EO Insights', rainforest_source, rainforest_source,
     'https://www.kuai-dai.com/insights.html',
     '從各門市的 Google 評論，找出出餐、食安、服務問題，接近即時用 LINE 通知總部、區域督導和店長。', true, '正常'),
    ('SOL-RF-0002', '50932719', 'AI客服－資深員工', rainforest_source, rainforest_source,
     'https://www.jxinfo.com.tw/service_detail.php?id=43',
     '結合了最先進的 RAG（檢索增強生成）技術與雙軌混合檢索架構，將企業內部的營運規章、產品手冊與 FAQ 轉化為永不離開、24 小時在線的數位資深員工。', true, '正常');

  if (select count(*) from public.solutions where program_type = rainforest_source) <> 2 then
    raise exception '智慧雨林試點中止：來源「%」的方案筆數不是 2。', rainforest_source;
  end if;
end;
$migration$;

commit;

const solutions = [
  { solution_id: 'S01', airtable_rec_id: 'rec-solution-01', company_id: '11111111', solution_name: 'Synthetic AI ERP',
    program_type: '臺灣雲市集', data_source: '雲市集', has_ai: true, target_industry: ['製造', '金融'], industry_category: '生產物流',
    target_scale: ['中小企業', '大型企業'], pricing_model: ['提供試用'], description: 'Synthetic description',
    description_short: 'Synthetic summary', features_list: 'ERP;備份', price: 1000, score_overall: '4.5',
    monthly_price: 100, price_tier: '5萬以下', created_at: '2026-10-12T02:00:00Z', record_status: '正常' },
  { solution_id: 'S02', airtable_rec_id: null, company_id: '11111111', solution_name: 'Synthetic suspected retirement',
    program_type: '新創嚴選網', data_source: null, has_ai: false, target_industry: [], industry_category: null,
    target_scale: [], pricing_model: [], description: null, description_short: null, features_list: '', price: null,
    score_overall: null, created_at: '2026-09-20T02:00:00Z', record_status: '疑似已下架' },
  { solution_id: 'S03', airtable_rec_id: 'rec-retired', company_id: '11111111', solution_name: 'Synthetic retired',
    program_type: '農業雲市集-數位館', has_ai: true, description: 'Must not affect counts', score_overall: 1, price: 99999,
    created_at: '2026-10-13T01:00:00Z', record_status: '已下架_資料異常' },
  { solution_id: 'S04', airtable_rec_id: 'rec-solution-04', company_id: '22222222', solution_name: 'Synthetic platform listing',
    program_type: 'SME AI平台', data_source: 'SME AI平台', has_ai: false, target_industry: null, target_scale: null,
    pricing_model: null, industry_category: '行銷推廣', price: '2,000', price_tier: '待確認', score_overall: 0,
    created_at: '2026-08-01T02:00:00Z', record_status: null },
  { solution_id: 'S05', airtable_rec_id: null, company_id: '', solution_name: 'Synthetic without company ID',
    program_type: '雲市集工業館', data_source: '', has_ai: false, target_industry: ['零售', '餐飲'], target_scale: [],
    industry_category: '銷售管理', price: 0, score_overall: '', created_at: '2026-10-01T02:00:00Z', record_status: '正常' },
  { solution_id: 'S06', airtable_rec_id: 'rec-unlinked', company_id: '99999999', solution_name: 'Synthetic unlinked company',
    program_type: '資策會產業調查', has_ai: true, industry_category: '資安合規', score_overall: 'not-a-number',
    created_at: null, record_status: null },
];

const companies = [
  { company_id: '11111111', airtable_rec_id: 'rec-company-01', company_name: 'Synthetic Alpha', region: '北部',
    city: '臺北市', is_startup: true, tech_tags: ['AI', 'ERP'], industry_vertical: '製造業', logo_url: '',
    tax_primary_name: '系統整合', it_code_rank: 1, award_count: 2, contact_count: 1, est_year: 2020,
    company_status: '正常營業', created_at: '2026-10-12T00:00:00Z' },
  { company_id: '22222222', airtable_rec_id: 'rec-company-02', company_name: 'Synthetic Beta', region: '南部',
    city: '高雄市', is_startup: false, tech_tags: [], industry_vertical: '', award_count: 0, contact_count: null,
    it_code_rank: null, tax_primary_name: null, company_status: '正常營業', created_at: '2026-09-01T00:00:00Z' },
  { company_id: '33333333', airtable_rec_id: 'rec-company-03', company_name: 'Synthetic suspended', region: null,
    city: null, is_startup: false, tech_tags: null, industry_vertical: null, company_status: '暫停營業', created_at: null },
  { company_id: '', airtable_rec_id: 'rec-company-04', company_name: 'Synthetic no-ID company', region: '',
    city: '', is_startup: false, tech_tags: ['security'], company_status: '正常營業', created_at: null },
];

const cases = [
  { case_id: 1, case_name: 'Synthetic real case', confidentiality: '公開', industry: '製造', industry_code: 'C25',
    secondary_industry_codes: ['M71'], pain_points: 'Synthetic pain point', diagnosis: 'Synthetic diagnosis',
    provider_linked_company_id: '11111111', case_relationship_type: '客戶案例', is_real: true,
    source_doc: 'synthetic-private-field', created_at: '2026-10-12T03:00:00Z' },
  { case_id: 2, case_name: 'Synthetic nulls case', confidentiality: '內部可看', industry_code: 'UNKNOWN',
    secondary_industry_codes: null, company_size: null, diagnosis: null, is_real: true,
    provider_linked_company_id: null, created_at: '2026-09-01T03:00:00Z' },
  { case_id: 3, case_name: 'Synthetic demonstration', confidentiality: '公開', secondary_industry_codes: [],
    industry_code: null, is_real: false, created_at: '2026-10-11T03:00:00Z' },
  { case_id: 4, case_name: 'Synthetic confidential case', confidentiality: '不可公開', industry_code: 'C25',
    secondary_industry_codes: [], is_real: true, created_at: '2026-10-10T03:00:00Z' },
];

export const fixture = {
  solutions, companies, companies_with_counts: companies, cases,
  industry_codes: [{ code: 'C25', name: '金屬製品製造業' }, { code: 'M71', name: '工程服務' }],
  gov_registrations: [{ company_id: '11111111' }],
  company_cdm_categories: [{ company_id: '11111111' }],
  awards: [
    { company_id: '11111111', award_category: '國際級', award_name: 'Synthetic international award', award_year: '2024' },
    { company_id: '11111111', award_category: '國家級', award_name: 'Synthetic national award', award_year: '2025' },
  ],
  maintenance_activity: [
    { kind: 'solution', label: '__total__', item_count: 3 },
    { kind: 'company', label: '__total__', item_count: 2 },
    { kind: 'solution', label: 'Synthetic maintenance', item_count: '3', day: '2026-10-12' },
  ],
};

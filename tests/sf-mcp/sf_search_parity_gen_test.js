const fs = require('fs');

// ---------- 測試資料（刻意涵蓋各種邊界）----------  
const companies = [
 // company_id, name, region, is_startup, tech_tags, city
 ['C01','客服科技股份有限公司','北部',true ,['AI','CRM'],'台北市'],
 ['C02','雲端行銷有限公司','北部',false,[],'新北市'],
 ['C03','中部資訊','中部',false,['ERP'],'台中市'],
 ['C04','南方軟體','南部',true ,['客服','LINE'],'高雄市'],
 ['C05','東岸數位','東部',false,[],'花蓮縣'],
 ['C06','未填地區公司',null,false,['POS'],null],
 ['C07','空字串地區公司','',true ,[],null],
 ['C08','餐飲科技','北部',false,['POS','餐飲'],'台北市'],
 ['C09','金融合規股份有限公司','北部',false,['KYC'],'台北市'],
 ['C10','Alpha AI Labs','中部',true ,['AI,CRM'],'台中市'],
];
const govCids = new Set(['C01','C03','C08']);
// solution_id, name, company_id, program, has_ai, target_industry[], category, price, monthly, pm[], desc, desc_short, feat, slogan, status
const sols = [
 ['S01','客服機器人','C01','臺灣雲市集',true ,['零售'],'銷售管理',3000,null,['訂閱制'],'智慧問答','簡','24小時','讓客戶滿意','正常'],
 ['S02','行銷自動化','C02','SME AI平台',true ,[],'行銷推廣',0,null,['訂閱制','買斷制'],'EDM','簡','排程','成長引擎',null],
 ['S03','客服分析','C03','SME AI平台',false,[],'客服',8000,500,['買斷制'],'報表','簡','圖表','洞察','正常'],
 ['S04','訂單系統','C04','新創嚴選網',false,['零售','餐飲'],'銷售管理',5000,null,[],'訂單處理','簡','po','專業客服團隊','正常'],
 ['S05','進銷存','C05','臺灣雲市集',false,[],'生產物流',null,null,['訂閱制'],'提供客服整合','簡','庫存','簡單好用','正常'],
 ['S06','文件管理','C06','臺灣雲市集',false,[],'協作辦公',1200,100,['訂閱制'],'雲端文件','簡','含客服工單','穩定','正常'],
 ['S07','CRM平台','C04','新創嚴選網',true ,['零售'],'銷售管理',9999,null,['客製化服務'],'CRM','簡','客戶管理','整合','正常'],
 ['S08','人資系統','C07','SME AI平台',false,[],'人力資源',2500,null,['訂閱制'],'HR','簡','出勤','輕鬆','正常'],
 ['S09','客服中心A','C01','臺灣雲市集',true ,[],'銷售管理',4000,null,['訂閱制'],'客服','簡','客服','客服','正常'],
 ['S10','客服中心B','C01','臺灣雲市集',true ,[],'銷售管理',4000,null,['訂閱制'],'客服','簡','客服','客服','正常'],
 ['S11','POS收銀系統','C08','新創嚴選網',false,['餐飲'],'銷售管理',6000,null,['訂閱制'],'POS 點餐 收銀','簡','訂位 外送 門市','餐廳首選','正常'],
 ['S12','餐廳訂位','C08','SME AI平台',true ,['餐飲'],'銷售管理',0,300,['訂閱制'],'訂位','簡','提醒','旅遊美食','正常'],
 ['S13','pos進階版','C06','臺灣雲市集',false,[],'銷售管理',7000,null,['買斷制'],'進階','簡','pos','pos','正常'],
 ['S14','法遵管理','C09','SME AI平台',false,['金融'],'資安合規',15000,null,['客製化服務'],'KYC 洗錢 合規','簡','金管會','金融業專用','正常'],
 ['S15','舊版客服','C01','臺灣雲市集',true ,[],'銷售管理',3000,null,['訂閱制'],'客服','簡','客服','客服','已下架_重複資料'],
 ['S16','疑似下架客服','C02','臺灣雲市集',false,[],'銷售管理',3000,null,['訂閱制'],'客服','簡','客服','客服','疑似已下架_農業雲市集數位館方案未持續上架未逐筆驗證'],
 ['S17','AI行銷助手','C10','SME AI平台',true ,[],'行銷推廣',2000,null,['訂閱制'],'ai marketing','簡','AI','AI','正常'],
 ['S18','跨平台CRM','C10','SME AI平台',false,[],'銷售管理',2000,null,['訂閱制'],'cross','簡','x','y','正常'],
 ['S19','物流追蹤','C03','臺灣雲市集',false,['物流'],'生產物流',11000,null,['訂閱制'],'配送 倉儲 車隊','簡','運輸','物流專家','正常'],
 ['S20','學習平台','C05','新創嚴選網',false,['教育'],'協作辦公',800,null,['免費試用'],'課程 學習','簡','教學 補習','學校適用','正常'],
 ['S21','醫療病歷','C09','SME AI平台',false,['醫療'],'醫療照護',20000,null,['訂閱制'],'病歷 診所','簡','健保','醫療專用','正常'],
 ['S22','訂房系統','C04','臺灣雲市集',false,['旅遊'],'銷售管理',3500,null,['訂閱制'],'訂房 旅宿 住宿','簡','飯店 觀光','旅遊首選','正常'],
 ['S23','製造MES','C03','臺灣雲市集',false,['製造業'],'生產物流',30000,null,['客製化服務'],'產線 機台 工廠','簡','SCADA PLC','製造專用','正常'],
 ['S24','電商平台','C02','SME AI平台',false,['電商'],'銷售管理',4500,null,['訂閱制'],'購物車 會員 上架','簡','電商 零售','網購首選','正常'],
 ['S25','資安防護','C09','新創嚴選網',true ,[],'資安合規',12000,null,['訂閱制'],'防護','簡','偵測','資安守門員','正常'],
 ['S26','無類別方案','C05','臺灣雲市集',false,[],null,1000,null,[],'客服相關','簡','','','正常'],
 ['S27','客服 AI 整合','C10','SME AI平台',true ,[],'銷售管理,客服',2500,null,['訂閱制'],'AI客服','簡','AI,CRM 整合','AI客服','正常'],
 ['S28','空描述方案','C06','臺灣雲市集',false,[],'行銷推廣',2200,null,[],null,null,null,null,'正常'],
 ['S29','價格0月費','C07','SME AI平台',false,[],'行銷推廣',0,0,['訂閱制'],'行銷','簡','x','y','正常'],
 ['S30','大寫KYC工具','C09','SME AI平台',false,[],'資安合規',6500,null,['訂閱制'],'kyc','簡','Kyc','KYC','正常'],
];

// ---------- JS 標準答案：逐字取自首頁 index.html 的邏輯 ----------
const safeStr = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(',') : String(v || ''));
const emptyToBlank = value => { if (Array.isArray(value)) return value.length ? value : ''; return value || ''; };
const INDUSTRY_KEYWORDS = {
  "金融": ["法遵","合規","金融","個資法","金管會","洗錢","KYC","銀行","保險"],
  "製造": ["工控","OT","工廠","製造","產線","SCADA","PLC","機台"],
  "餐飲": ["POS","餐飲","門市","收銀","點餐","外送","訂位"],
  "醫療": ["醫療","病歷","診所","醫院","長照","健保"],
  "零售電商": ["電商","零售","網購","購物車","會員","門市","上架"],
  "物流": ["物流","倉儲","配送","車隊","運輸"],
  "教育": ["教育","教學","學校","課程","補習","學習"],
  "旅遊": ["旅遊","住宿","訂房","旅宿","觀光","飯店"],
};
const INDUSTRY_ALIASES = [
  ["金融",["金融","銀行","保險","證券","金控"]],["製造",["製造","工廠","工業","產線","智慧製造"]],
  ["餐飲",["餐飲","餐廳","飲料","咖啡","外送"]],["醫療",["醫療","診所","醫院","照護","長照"]],
  ["零售電商",["零售","電商","網購","門市","商店"]],["物流",["物流","倉儲","配送","運輸","車隊"]],
  ["教育",["教育","學校","教學","補習","課程"]],["旅遊",["旅遊","旅宿","住宿","觀光","飯店"]],
];
const detectIndustryKey = (text) => { const source = safeStr(text).toLowerCase(); if (!source) return null;
  for (const [industry, aliases] of INDUSTRY_ALIASES) { if (aliases.some(a => source.includes(a.toLowerCase()))) return industry; } return null; };
const getIndustryScore = (item, industryKey) => { const terms = INDUSTRY_KEYWORDS[industryKey]; if (!terms) return 0;
  const haystack = [item.desc,item.feat,item.d,item.iv,item.cat,item.tags,item.slogan].map(safeStr).join(" ").toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term.toLowerCase()) ? 12 : 0), 0); };
const getRelevanceScore = (item, kw) => { if (!kw) return 0; const k = kw.toLowerCase(); let score = 0;
  if (safeStr(item.s).toLowerCase().includes(k)) score += 100; if (safeStr(item.c).toLowerCase().includes(k)) score += 80;
  if (safeStr(item.cat).toLowerCase().includes(k)) score += 70; if (safeStr(item.slogan).toLowerCase().includes(k)) score += 40;
  if (safeStr(item.desc).toLowerCase().includes(k)) score += 30; if (safeStr(item.feat).toLowerCase().includes(k)) score += 20;
  if (safeStr(item.tags).toLowerCase().includes(k)) score += 10; return score; };

const coById = Object.fromEntries(companies.map(c => [c[0], c]));
const allData = sols.map(r => { const co = coById[r[2]] ? { name: coById[r[2]][1], region: coById[r[2]][2], is_startup: coById[r[2]][3], tech_tags: coById[r[2]][4] } : {};
  return { id:r[0], status:r[14], s: r[1]||'', c: co.name||'', p: r[3]||'', ai: r[4]===true, d: emptyToBlank(r[5]), cat: r[6]||'', iv:'',
    pr: parseFloat(r[7])||null, r: co.region||'', st: co.is_startup||false, desc: r[10]||'', feat: r[12]||'', pm: Array.isArray(r[9])?r[9]:[],
    tags: co.tech_tags||'', slogan: r[13]||'', gov: govCids.has(r[2]) }; });

function siteSearch(f, query, sortBy, includeDelisted) {
  const filters = Object.assign({ region:[], isAI:null, isStartup:null, isGov:null, pricingModel:null, category:[], maxPrice:null, keyword:null, program:[], industry_vertical:[], industryKeyword:null }, f);
  const industryKey = detectIndustryKey(query || filters.keyword || filters.industry_vertical);
  let results = allData.filter(i => includeDelisted || !i.status || !i.status.startsWith('已下架')).filter(item => {
    if (filters.region.length > 0 && !filters.region.includes(item.r)) return false;
    if (filters.isAI !== null && item.ai !== filters.isAI) return false;
    if (filters.isStartup !== null && item.st !== filters.isStartup) return false;
    if (filters.isGov !== null && item.gov !== filters.isGov) return false;
    const pricingModels = Array.isArray(item.pm) ? item.pm : item.pm ? [item.pm] : [];
    if (filters.pricingModel && !pricingModels.includes(filters.pricingModel)) return false;
    if (filters.category.length > 0 && !(item.cat && filters.category.some(c => item.cat.includes(c)))) return false;
    if (filters.program.length > 0 && !filters.program.includes(item.p)) return false;
    if (filters.maxPrice && (item.pr === null || Number(item.pr) > Number(filters.maxPrice))) return false;
    if (filters.keyword) { const kw = filters.keyword.toLowerCase();
      const matched = safeStr(item.s).toLowerCase().includes(kw) || safeStr(item.c).toLowerCase().includes(kw) || safeStr(item.desc).toLowerCase().includes(kw)
        || safeStr(item.feat).toLowerCase().includes(kw) || safeStr(item.slogan).toLowerCase().includes(kw) || safeStr(item.cat).toLowerCase().includes(kw) || safeStr(item.tags).toLowerCase().includes(kw);
      if (!matched) return false; }
    return true; });
  if (sortBy === "relevance" && (filters.keyword || filters.industryKeyword)) {
    results = results.map((item, index) => { const relevanceScore = filters.keyword ? getRelevanceScore(item, filters.keyword) : 0;
        const industryScore = industryKey ? getIndustryScore(item, industryKey) : 0;
        const industryKeywordScore = filters.industryKeyword ? (safeStr(item.d).includes(filters.industryKeyword) ? 50 : 0) : 0;
        return { item, index, relevanceScore, industryScore, industryKeywordScore }; })
      .sort((a, b) => { const sa = a.relevanceScore + a.industryScore + a.industryKeywordScore; const sb = b.relevanceScore + b.industryScore + b.industryKeywordScore;
        if (sb !== sa) return sb - sa; return a.index - b.index; }).map(e => e.item);
  } else if (sortBy === "price_asc") { results.sort((a, b) => (a.pr ?? Infinity) - (b.pr ?? Infinity));
  } else if (sortBy === "price_desc") { results.sort((a, b) => (b.pr ?? -1) - (a.pr ?? -1)); }
  return results.map(i => i.id);
}

// ---------- 測試案例（JS 條件 + 對應的 SQL 參數）----------
const cases = [
 ['A1 關鍵字 客服（各欄位命中加權）', {keyword:'客服'}, '', 'relevance', false, "p_keyword=>'客服'"],
 ['A2 關鍵字 pos（大小寫）',          {keyword:'pos'},  '', 'relevance', false, "p_keyword=>'pos'"],
 ['A3 關鍵字 KYC',                    {keyword:'KYC'},  '', 'relevance', false, "p_keyword=>'KYC'"],
 ['A4 關鍵字含逗號 ai,crm（陣列串接）', {keyword:'ai,crm'}, '', 'relevance', false, "p_keyword=>'ai,crm'"],
 ['B1 產業偵測 餐廳 + 關鍵字 系統',   {keyword:'系統'}, '我想找餐廳用的系統', 'relevance', false, "p_keyword=>'系統', p_query_text=>'我想找餐廳用的系統'"],
 ['B2 產業偵測 無關鍵字 query只有診所', {keyword:null}, '診所適用', 'relevance', false, "p_query_text=>'診所適用'"],
 ['B3 industryKeyword 餐飲（區分大小寫）', {industryKeyword:'餐飲'}, '', 'relevance', false, "p_industry_keyword=>'餐飲'"],
 ['B4 關鍵字+industryKeyword 並用',   {keyword:'pos', industryKeyword:'餐飲'}, '', 'relevance', false, "p_keyword=>'pos', p_industry_keyword=>'餐飲'"],
 ['C1 地區 北部',                     {region:['北部']}, '', 'relevance', false, "p_region=>ARRAY['北部']"],
 ['C2 地區 北部+中部',                {region:['北部','中部']}, '', 'relevance', false, "p_region=>ARRAY['北部','中部']"],
 ['C3 地區 其他（網站選項，空地區不屬於任何選項）', {region:['其他']}, '', 'relevance', false, "p_region=>ARRAY['其他']"],
 ['D1 isAI=true',                     {isAI:true}, '', 'relevance', false, "p_is_ai=>true"],
 ['D2 isAI=false',                    {isAI:false}, '', 'relevance', false, "p_is_ai=>false"],
 ['D3 isStartup=true',                {isStartup:true}, '', 'relevance', false, "p_is_startup=>true"],
 ['D4 isGov=true',                    {isGov:true}, '', 'relevance', false, "p_is_gov=>true"],
 ['D5 isGov=false',                   {isGov:false}, '', 'relevance', false, "p_is_gov=>false"],
 ['E1 計價 訂閱制',                   {pricingModel:'訂閱制'}, '', 'relevance', false, "p_pricing_model=>'訂閱制'"],
 ['E2 類別 銷售管理+行銷推廣（子字串）', {category:['銷售管理','行銷推廣']}, '', 'relevance', false, "p_category=>ARRAY['銷售管理','行銷推廣']"],
 ['E3 類別 客服（子字串於複合類別）', {category:['客服']}, '', 'relevance', false, "p_category=>ARRAY['客服']"],
 ['E4 來源 SME AI平台+新創嚴選網',    {program:['SME AI平台','新創嚴選網']}, '', 'relevance', false, "p_program=>ARRAY['SME AI平台','新創嚴選網']"],
 ['F1 最高價 5000（0與null價格一律排除）', {maxPrice:5000}, '', 'relevance', false, "p_max_price=>5000"],
 ['F2 最高價 0 視為不篩選',           {maxPrice:0}, '', 'relevance', false, "p_max_price=>0"],
 ['G1 含已下架',                      {keyword:'客服'}, '', 'relevance', true, "p_keyword=>'客服', p_include_delisted=>true"],
 ['H1 價格由低到高',                  {}, '', 'price_asc', false, "p_sort=>'price_asc'"],
 ['H2 價格由高到低',                  {}, '', 'price_desc', false, "p_sort=>'price_desc'"],
 ['H3 無條件預設順序',                {}, '', 'relevance', false, ""],
 ['I1 組合：北部+AI+訂閱制+關鍵字客服', {region:['北部'], isAI:true, pricingModel:'訂閱制', keyword:'客服'}, '', 'relevance', false, "p_region=>ARRAY['北部'], p_is_ai=>true, p_pricing_model=>'訂閱制', p_keyword=>'客服'"],
 ['I2 組合：最高價+類別+價格排序',    {maxPrice:6000, category:['銷售管理']}, '', 'price_desc', false, "p_max_price=>6000, p_category=>ARRAY['銷售管理'], p_sort=>'price_desc'"],
];

// ---------- 輸出 ----------
const q = v => v === null || v === undefined ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const arr = a => a === null ? 'NULL' : (a.length ? "ARRAY[" + a.map(x => q(x)).join(',') + "]::text[]" : "'{}'::text[]");
let sql = "";
sql += "CREATE TEMP TABLE solutions (solution_id text, airtable_rec_id text, solution_name text, company_id text, program_type text, has_ai boolean, target_industry text[], industry_category text, price integer, monthly_price integer, pricing_model text[], description text, description_short text, features_list text, slogan text, record_status text);\n";
sql += "CREATE TEMP TABLE companies (company_id text, company_name text, region text, is_startup boolean, tech_tags text[], city text);\n";
sql += "CREATE TEMP TABLE gov_registrations (company_id text);\n";
sql += "INSERT INTO companies VALUES\n" + companies.map(c => `(${q(c[0])},${q(c[1])},${q(c[2])},${c[3]},${arr(c[4])},${q(c[5])})`).join(",\n") + ";\n";
sql += "INSERT INTO gov_registrations VALUES " + [...govCids].map(c => `(${q(c)})`).join(",") + ";\n";
sql += "INSERT INTO solutions VALUES\n" + sols.map(r => `(${q(r[0])},NULL,${q(r[1])},${q(r[2])},${q(r[3])},${r[4]},${arr(r[5])},${q(r[6])},${r[7]===null?'NULL':r[7]},${r[8]===null?'NULL':r[8]},${arr(r[9])},${q(r[10])},${q(r[11])},${q(r[12])},${q(r[13])},${q(r[14])})`).join(",\n") + ";\n";
fs.writeFileSync('fixture.sql', sql);

const expected = {};
cases.forEach(c => { expected[c[0]] = siteSearch(c[1], c[2], c[3], c[4]).join(','); });
fs.writeFileSync('expected.json', JSON.stringify(expected, null, 1));

const caseSql = cases.map(c => `SELECT ${q(c[0])} AS t, coalesce(string_agg(solution_id, ',' ORDER BY ord), '') AS ids, coalesce(max(total_matches),0) AS total FROM pg_temp.sf_search_t(${c[5]}) WITH ORDINALITY AS x(solution_id, solution_name, company_id, company_name, program_type, industry_category, region, has_ai, is_startup, is_gov, price, monthly_price, pricing_model, slogan, description_short, record_status, score, total_matches, ord)`).join("\nUNION ALL\n");
fs.writeFileSync('cases.sql', caseSql);
console.log("案例數:", cases.length, "｜fixture.sql", sql.length, "bytes｜cases.sql", caseSql.length, "bytes");
console.log("範例（A1 預期）:", expected['A1 關鍵字 客服（各欄位命中加權）']);

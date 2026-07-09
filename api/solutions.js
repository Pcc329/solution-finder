// api/solutions.js — Vercel Serverless Function
// 從 Airtable 抓取 Solutions 資料，join Companies 的 region/is_startup/company_name
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appttP04OnzzC7qxG';

  function logAirtableError(table, status, body) {
    const time = new Date().toISOString();
    console.error(`[Airtable Error] status=${status} endpoint=${req.url} table=${table} time=${time} message=${body}`);
    if (status === 429) {
      console.error(`[Airtable Rate Limit] status=429 endpoint=${req.url} table=${table} time=${time}`);
    }
  }

  async function fetchAll(table) {
    let allRecords = [];
    let offset = null;
    do {
      let url = `https://api.airtable.com/v0/${BASE_ID}/${table}?pageSize=100`;
      if (offset) url += `&offset=${offset}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!response.ok) {
        const body = await response.text();
        logAirtableError(table, response.status, body);
        throw new Error(`Airtable error: ${response.status} — ${body}`);
      }
      const data = await response.json();
      allRecords = allRecords.concat(data.records);
      offset = data.offset || null;
    } while (offset);
    return allRecords;
  }

  try {
    const [solRecords, coRecords] = await Promise.all([
      fetchAll('Solutions'),
      fetchAll('Companies'),
    ]);

    // 建立兩種 lookup map：
    // 1. by company_id (統編) → 給文字欄位用
    // 2. by record ID → 給 Link 關聯欄位用
    const companyByCid = {};
    const companyByRecId = {};

    coRecords.forEach(rec => {
      const f = rec.fields;
      const cid = String(f['company_id'] || '').replace(/^\uFEFF/, '').trim();
      const coData = {
        name: f['company_name'] || '',
        cid: cid,
        region: f['region'] || '',
        is_startup: f['is_startup'] === true,
        city: f['city'] || '',
        tech_tags: f['tech_tags'] || '',
        industry_vertical_co: f['industry_vertical'] || '',
      };
      if (cid) companyByCid[cid] = coData;
      companyByRecId[rec.id] = coData;
    });

    const parseScore = value => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const converted = solRecords.map(rec => {
      const f = rec.fields;

      // company_id 可能是：
      // 1. Link 關聯欄位 → 陣列 ["recXXXXX"] (record ID)
      // 2. 純文字 → "12345678" (統編)
      let co = {};
      let cidDisplay = '';
      const rawCid = f['company_id'];

      if (Array.isArray(rawCid) && rawCid.length > 0) {
        // Link 關聯欄位：用 record ID 查
        co = companyByRecId[rawCid[0]] || {};
        cidDisplay = co.cid || '';
      } else {
        // 純文字：用統編查
        const cid = String(rawCid || '').replace(/^\uFEFF/, '').trim();
        co = companyByCid[cid] || {};
        cidDisplay = cid;
      }

      const hasAiRaw = f['has_ai'] || '';
      const hasAi = hasAiRaw === '有' || hasAiRaw === 'True' || hasAiRaw === true;

      return {
        id: String(f['solution_id'] || rec.id || '').replace(/^\uFEFF/, ''),
        s: f['solution_name'] || '',
        c: co.name || '',
        cid: cidDisplay,
        p: f['program_type'] || '',
        ai: hasAi,
        d: f['target_industry'] || '',
        cat: f['industry_category'] || '',
        iv: f['industry_vertical'] || '',
        pr: parseFloat(f['price']) || null,
        pt: f['price_tier'] || '',
        mo: parseFloat(f['monthly_price']) || null,
        mt: f['monthly_price_tier'] || '',
        r: co.region || '',
        st: co.is_startup || false,
        city: co.city || '',
        ds: f['description_short'] || '',
        desc: f['description'] || '',
        feat: f['features_list'] || '',
        tags: co.tech_tags || '',
        scale: f['target_scale'] || '',
        slogan: f['slogan'] || '',
        sf: parseScore(f['score_function']),
        sp: parseScore(f['score_price']),
        ss: parseScore(f['score_support']),
        si: parseScore(f['score_innovation']),
        so: parseScore(f['score_overall']),
      };
    });

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
}

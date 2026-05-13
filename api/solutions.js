// api/solutions.js — Vercel Serverless Function
// 從 Airtable 抓取 Solutions 資料，join Companies 的 region/is_startup/company_name
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appttP04OnzzC7qxG';

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

    // company_id lookup map
    const companyMap = {};
    coRecords.forEach(rec => {
      const f = rec.fields;
      const cid = String(f['company_id'] || '').replace(/^\uFEFF/, '').trim();
      if (cid) {
        companyMap[cid] = {
          name: f['company_name'] || '',
          region: f['region'] || '',
          is_startup: f['is_startup'] === 'checked',
          city: f['city'] || '',
          tech_tags: f['tech_tags'] || '',
          industry_vertical_co: f['industry_vertical'] || '',
        };
      }
    });

    const converted = solRecords.map(rec => {
      const f = rec.fields;
      const cid = String(f['company_id'] || '').replace(/^\uFEFF/, '').trim();
      const co = companyMap[cid] || {};

      const hasAiRaw = f['has_ai'] || '';
      const hasAi = hasAiRaw === '有' || hasAiRaw === 'True' || hasAiRaw === true;

      return {
        id: String(f['solution_id'] || rec.id || '').replace(/^\uFEFF/, ''),
        s: f['solution_name'] || '',
        c: co.name || '',
        cid: cid,
        p: f['program_type'] || '',
        ai: hasAi,
        d: f['target_industry'] || '',
        cat: f['industry_category'] || '',
        iv: f['industry_vertical'] || co.industry_vertical_co || '',
        pr: parseFloat(f['price']) || null,
        pt: f['price_tier'] || '',
        mo: parseFloat(f['monthly_price']) || null,
        mt: f['monthly_price_tier'] || '',
        r: co.region || '',
        st: co.is_startup || false,
        city: co.city || '',
        desc: f['description'] || '',
        feat: f['features_list'] || '',
        tags: co.tech_tags || '',
        scale: f['target_scale'] || '',
        slogan: f['slogan'] || '',
      };
    });

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
}

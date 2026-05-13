// api/solutions.js — Vercel Serverless Function
// 從 Airtable 抓取 Solutions 資料，join Companies 的 region/is_startup/company_name
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appttP04OnzzC7qxG';

  async function fetchAll(table, fields = []) {
    let allRecords = [];
    let offset = null;
    do {
      let url = `https://api.airtable.com/v0/${BASE_ID}/${table}?pageSize=100`;
      if (fields.length) url += `&fields[]=${fields.join('&fields[]=')}`;
      if (offset) url += `&offset=${offset}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!response.ok) throw new Error(`Airtable error: ${response.status}`);
      const data = await response.json();
      allRecords = allRecords.concat(data.records);
      offset = data.offset || null;
    } while (offset);
    return allRecords;
  }

  try {
    // 同時抓 Solutions 和 Companies
    const [solRecords, coRecords] = await Promise.all([
      fetchAll('Solutions'),
      fetchAll('Companies', [
        'company_id', 'company_name', 'region', 'is_startup', 'city',
        'tech_tags', 'employee_range', 'company_type', 'industry_vertical'
      ]),
    ]);

    // 建立 company_id → company 資料的 lookup map
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
          employee_range: f['employee_range'] || '',
          company_type: f['company_type'] || '',
          industry_vertical_co: f['industry_vertical'] || '',
        };
      }
    });

    // 轉換 Solutions
    const converted = solRecords.map(rec => {
      const f = rec.fields;
      const cid = String(f['company_id'] || '').replace(/^\uFEFF/, '').trim();
      const co = companyMap[cid] || {};

      // has_ai：統一成 boolean
      const hasAiRaw = f['has_ai'] || '';
      const hasAi = hasAiRaw === '有' || hasAiRaw === 'True' || hasAiRaw === true;

      // price：取數字
      const price = parseFloat(f['price']) || null;
      const monthlyPrice = parseFloat(f['monthly_price']) || null;

      return {
        id: String(f['solution_id'] || rec.id || '').replace(/^\uFEFF/, ''),
        s: f['solution_name'] || '',                    // solution_name
        c: co.name || '',                               // company_name (from Companies)
        cid: cid,                                       // company_id
        p: f['program_type'] || '',                     // program_type
        ai: hasAi,                                      // has_ai (boolean)
        d: f['target_industry'] || '',                  // target_industry
        cat: f['industry_category'] || '',              // industry_category
        iv: f['industry_vertical'] || co.industry_vertical_co || '', // industry_vertical
        pr: price,                                      // price
        pt: f['price_tier'] || '',                      // price_tier
        mo: monthlyPrice,                               // monthly_price
        mt: f['monthly_price_tier'] || '',              // monthly_price_tier
        r: co.region || '',                             // region (from Companies)
        st: co.is_startup || false,                     // is_startup (from Companies)
        city: co.city || '',                            // city (from Companies)
        desc: f['description'] || '',                   // description
        feat: f['features_list'] || '',                 // features_list
        tags: co.tech_tags || '',                       // tech_tags (from Companies)
        scale: f['target_scale'] || '',                 // target_scale
        slogan: f['slogan'] || '',                      // slogan
      };
    });

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
}

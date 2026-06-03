// api/companies.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300');

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
        throw new Error(`Airtable error (${table}): ${response.status} — ${body}`);
      }
      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);
    return allRecords;
  }

  function normalizeCid(value) {
    if (Array.isArray(value)) return String(value[0] || '').replace(/^\uFEFF/, '').trim();
    return String(value || '').replace(/^\uFEFF/, '').trim();
  }

  function isChecked(value) {
    return value === true || value === 'checked' || value === 'true' || value === 'True' || value === '有';
  }

  function parseYear(value) {
    const text = String(value || '').trim();
    const match = text.match(/\d{4}/);
    return match ? Number(match[0]) : null;
  }

  function increment(map, key) {
    const normalized = normalizeCid(key);
    if (!normalized) return;
    map[normalized] = (map[normalized] || 0) + 1;
  }

  function addTag(tags, value) {
    if (value && !tags.includes(value)) tags.push(value);
  }

  function solutionCompanyKeys(fields, companyByRecId) {
    const raw = fields?.['company_id'];
    if (Array.isArray(raw)) {
      return raw.map(item => companyByRecId[item]?.cid || normalizeCid(item)).filter(Boolean);
    }
    return [normalizeCid(raw)].filter(Boolean);
  }

  function awardCompanyKeys(fields, companyByRecId) {
    const candidates = [
      fields?.['company_id'],
      fields?.['company'],
      fields?.['Companies'],
      fields?.['company_name'],
    ];
    return candidates.flatMap(value => {
      if (Array.isArray(value)) {
        return value.map(item => companyByRecId[item]?.cid || normalizeCid(item));
      }
      return [normalizeCid(value)];
    }).filter(Boolean);
  }

  function applyFilter(companies, filter) {
    if (!filter) return companies;
    if (filter === 'startup') return companies.filter(item => item.is_startup);
    if (filter === 'award') return companies.filter(item => item.award_count > 0);
    if (filter === 'large') return companies.filter(item => item.solution_count >= 15);
    if (filter === 'ai') return companies.filter(item => item.tags.includes('AI工具'));
    if (filter === 'erp') return companies.filter(item => item.tags.includes('ERP'));
    if (filter === 'sec') return companies.filter(item => item.tags.includes('資安'));
    return companies;
  }

  try {
    const [companyRecords, solutionRecords] = await Promise.all([
      fetchAll('Companies'),
      fetchAll('Solutions'),
    ]);

    let awardRecords = [];
    try {
      awardRecords = await fetchAll('Awards');
    } catch (err) {
      console.error('Awards fetch skipped:', err.message);
    }

    const companyByCid = {};
    const companyByRecId = {};

    companyRecords.forEach(rec => {
      const f = rec.fields || {};
      const cid = normalizeCid(f['company_id']);
      const item = {
        id: rec.id,
        cid,
        name: f['company_name'] || '',
        is_startup: isChecked(f['is_startup']),
        has_award: false,
        award_count: 0,
        solution_count: 0,
        contact_count: Number(f['contact_count'] || f['contacts_count'] || 0) || 0,
        industry: f['industry_vertical'] || f['industry'] || '資訊服務',
        city: f['city'] || '',
        est_year: parseYear(f['established_date'] || f['founded_date'] || f['est_year']),
        tags: [],
      };
      if (String(item.industry).includes('AI')) addTag(item.tags, 'AI工具');
      if (String(item.industry).includes('ERP')) addTag(item.tags, 'ERP');
      if (String(item.industry).includes('資安')) addTag(item.tags, '資安');
      if (cid) companyByCid[cid] = item;
      companyByRecId[rec.id] = item;
    });

    solutionRecords.forEach(rec => {
      const f = rec.fields || {};
      const hasAi = isChecked(f['has_ai']);
      const text = [
        f['solution_name'],
        f['industry_category'],
        f['industry_vertical'],
        f['description'],
        f['features_list'],
        f['tech_tags'],
      ].join(' ');

      solutionCompanyKeys(f, companyByRecId).forEach(cid => {
        const company = companyByCid[cid] || companyByRecId[cid];
        if (!company) return;
        company.solution_count += 1;
        if (hasAi || /AI|人工智慧|智慧/.test(text)) addTag(company.tags, 'AI工具');
        if (/ERP|進銷存|企業資源/.test(text)) addTag(company.tags, 'ERP');
        if (/資安|資訊安全|防毒|弱點|防護|備份/.test(text)) addTag(company.tags, '資安');
      });
    });

    awardRecords.forEach(rec => {
      awardCompanyKeys(rec.fields || {}, companyByRecId).forEach(cid => {
        const company = companyByCid[cid] || companyByRecId[cid];
        if (!company) return;
        company.award_count += 1;
        company.has_award = true;
      });
    });

    const filter = String(req.query?.filter || '').trim();
    const companies = applyFilter(Object.values(companyByCid), filter)
      .sort((a, b) => b.solution_count - a.solution_count || a.name.localeCompare(b.name, 'zh-Hant'))
      .slice(0, 200)
      .map(item => ({
        id: item.id,
        name: item.name,
        is_startup: item.is_startup,
        has_award: item.has_award,
        award_count: item.award_count,
        solution_count: item.solution_count,
        contact_count: item.contact_count,
        industry: item.industry,
        city: item.city,
        est_year: item.est_year,
        tags: item.tags,
      }));

    return res.status(200).json(companies);
  } catch (err) {
    console.error('Companies API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

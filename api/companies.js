// api/companies.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300');

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

  function parseScore(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
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

  function tagFromFields(company) {
    const text = `${company.tech_tags || ''} ${company.industry_vertical || ''}`;
    if (text.toLowerCase().includes('ai') || text.includes('AI')) addTag(company.tags, 'AI工具');
    if (text.toLowerCase().includes('erp') || text.includes('ERP')) addTag(company.tags, 'ERP');
    if (text.toLowerCase().includes('security') || text.includes('資安')) addTag(company.tags, '資安');
  }

  function applyFilter(companies, filter) {
    if (!filter) return companies;
    if (filter === 'startup') return companies.filter(item => item.is_startup);
    if (filter === 'award') return companies.filter(item => item.award_count > 0);
    if (filter === 'large') return companies.slice(0, 30);
    if (filter === 'ai') {
      return companies.filter(item =>
        String(item.tech_tags || '').toLowerCase().includes('ai') ||
        String(item.industry_vertical || '').includes('AI')
      );
    }
    if (filter === 'erp') {
      return companies.filter(item =>
        String(item.tech_tags || '').toLowerCase().includes('erp') ||
        String(item.industry_vertical || '').includes('ERP')
      );
    }
    if (filter === 'sec') {
      return companies.filter(item =>
        String(item.tech_tags || '').toLowerCase().includes('security') ||
        String(item.tech_tags || '').includes('資安') ||
        String(item.industry_vertical || '').includes('資安')
      );
    }
    return companies;
  }

  try {
    const [companyRecords, solutionRecords] = await Promise.all([
      fetchAll('Companies'),
      fetchAll('Solutions'),
    ]);

    const companyByCid = {};
    const companyByRecId = {};
    const companies = [];

    companyRecords.forEach(rec => {
      const f = rec.fields || {};
      const cid = normalizeCid(f['company_id']);
      const awardCount = Array.isArray(f['Awards']) ? f['Awards'].length : 0;
      const linkedSolutionCount = Array.isArray(f['Solutions']) ? f['Solutions'].length : 0;
      const industryVertical = f['industry_vertical'] || '';
      const techTags = f['tech_tags'] || '';
      const item = {
        id: rec.id,
        cid,
        name: f['company_name'] || '',
        is_startup: f['is_startup'] === 'checked' || f['is_startup_auto'] === '新創',
        has_award: awardCount > 0,
        award_count: awardCount,
        solution_count: linkedSolutionCount,
        linked_solution_count: linkedSolutionCount,
        score_sum: 0,
        score_count: 0,
        contact_count: Number(f['contact_count'] || f['contacts_count'] || 0) || 0,
        industry: industryVertical || f['industry'] || '資訊服務',
        industry_vertical: industryVertical,
        city: f['city'] || '',
        est_year: parseYear(f['established_date']),
        tech_tags: techTags,
        tags: [],
      };
      tagFromFields(item);
      if (cid) companyByCid[cid] = item;
      companyByRecId[rec.id] = item;
      companies.push(item);
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
        if (!company.linked_solution_count) company.solution_count += 1;
        const score = parseScore(f['score_overall']);
        if (score !== null) {
          company.score_sum += score;
          company.score_count += 1;
        }
        if (hasAi || /AI|人工智慧|智慧/.test(text)) addTag(company.tags, 'AI工具');
        if (/ERP|進銷存|企業資源/.test(text)) addTag(company.tags, 'ERP');
        if (/資安|資訊安全|防毒|弱點|防護|備份/.test(text)) addTag(company.tags, '資安');
      });
    });

    const filter = String(req.query?.filter || '').trim();
    const sortedCompanies = companies
      .sort((a, b) => b.solution_count - a.solution_count || a.name.localeCompare(b.name, 'zh-Hant'));
    const filteredCompanies = applyFilter(sortedCompanies, filter);
    const limitedCompanies = (filter ? filteredCompanies : filteredCompanies.slice(0, 200))
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
        tech_tags: item.tech_tags,
        avg_score: item.score_count > 0
          ? Number((item.score_sum / item.score_count).toFixed(1))
          : null,
        tags: item.tags,
      }));

    return res.status(200).json(limitedCompanies);
  } catch (err) {
    console.error('Companies API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

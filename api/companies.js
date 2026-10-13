// api/companies.js — Vercel Serverless Function
import { requireAuth } from '../_lib/auth.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300');

  if (!requireAuth(req, res)) return;

  function normalizeCid(value) {
    if (Array.isArray(value)) return String(value[0] || '').replace(/^\uFEFF/, '').trim();
    return String(value || '').replace(/^\uFEFF/, '').trim();
  }

  function isChecked(value) {
    return value === true || value === 'checked' || value === 'true' || value === 'True' || value === '有';
  }

  function parseScore(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function addTag(tags, value) {
    if (value && !tags.includes(value)) tags.push(value);
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

  async function fetchAllSupabase(url, anonKey) {
    const endpoint = new URL('/rest/v1/companies_with_counts', url);
    endpoint.searchParams.set('select', '*');

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Supabase Error] status=${response.status} endpoint=${req.url} view=companies_with_counts time=${new Date().toISOString()} message=${body}`);
      throw new Error(`Supabase error: ${response.status} - ${body}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async function fetchSupabaseSolutions(url, anonKey) {
    const endpoint = new URL('/rest/v1/solutions', url);
    endpoint.searchParams.set('select', 'company_id,solution_name,description,has_ai,score_overall,industry_category,features_list');
    // Exclude every confirmed retired status beginning with 「已下架」; retain NULL and unverified 「疑似已下架」 statuses.
    endpoint.searchParams.set('or', '(record_status.is.null,record_status.not.like.已下架*)');

    const pageSize = 1000;
    const allSolutions = [];
    let start = 0;

    while (true) {
      const response = await fetch(endpoint, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Range: `${start}-${start + pageSize - 1}`,
          'Range-Unit': 'items',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[Supabase Error] status=${response.status} view=solutions time=${new Date().toISOString()} message=${body}`);
        throw new Error(`Supabase solutions error: ${response.status} - ${body}`);
      }

      const page = await response.json();
      const rows = Array.isArray(page) ? page : [];
      allSolutions.push(...rows);
      if (rows.length < pageSize) break;
      start += pageSize;
    }

    console.log(`[Supabase] companies solutions fetched=${allSolutions.length}`);
    return allSolutions;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY not configured' });
    }

    const [records, solutions] = await Promise.all([
      fetchAllSupabase(supabaseUrl, supabaseAnonKey),
      fetchSupabaseSolutions(supabaseUrl, supabaseAnonKey),
    ]);
    const companyByCid = {};
    const companies = records.map(row => {
      const techTags = Array.isArray(row.tech_tags) ? row.tech_tags : [];
      const industryVertical = row.industry_vertical ?? '';
      const cid = normalizeCid(row.company_id);
      const item = {
        id: row.airtable_rec_id ?? '',
        cid,
        name: row.company_name ?? '',
        is_startup: row.is_startup === true,
        has_award: (row.award_count ?? 0) > 0,
        award_count: row.award_count ?? 0,
        // Count from the filtered Solutions query below, not the unfiltered view aggregate.
        solution_count: 0,
        contact_count: row.contact_count ?? 0,
        industry: industryVertical || '資訊服務',
        industry_vertical: industryVertical,
        city: row.city ?? '',
        est_year: row.est_year ?? null,
        tech_tags: techTags,
        score_sum: 0,
        score_count: 0,
        tags: [],
      };
      tagFromFields(item);
      if (cid) companyByCid[cid] = item;
      return item;
    });

    solutions.forEach(sol => {
      const cid = normalizeCid(sol.company_id);
      const company = companyByCid[cid];
      if (!company) return;

      company.solution_count += 1;
      const hasAi = isChecked(sol.has_ai);
      const text = [
        sol.solution_name,
        sol.industry_category,
        sol.description,
        sol.features_list,
      ].join(' ');
      const score = parseScore(sol.score_overall);
      if (score !== null) {
        company.score_sum += score;
        company.score_count += 1;
      }
      if (hasAi || /AI|人工智慧|智慧/.test(text)) addTag(company.tags, 'AI工具');
      if (/ERP|進銷存|企業資源/.test(text)) addTag(company.tags, 'ERP');
      if (/資安|資訊安全|防毒|弱點|防護|備份/.test(text)) addTag(company.tags, '資安');
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
        tech_tags: (Array.isArray(item.tech_tags) && item.tech_tags.length) ? item.tech_tags : '',
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

// api/company-detail.js - Vercel Serverless Function
const OVERFLOW_CAPITAL_THRESHOLD = 2147483647;
const VERIFIED_MATCH_METHODS = new Set(['EXACT', 'PARTIAL', 'PARTIAL_GROUP']);

function textOrBlank(value) {
  return value ?? '';
}

function normalizeCapital(value) {
  if (value === null || value === undefined || value === '') return null;
  const capital = Number(value);
  return Number.isFinite(capital) && capital < OVERFLOW_CAPITAL_THRESHOLD
    ? capital
    : null;
}

function awardConfidence(matchMethod) {
  const method = String(matchMethod || '').trim().toUpperCase();
  if (VERIFIED_MATCH_METHODS.has(method)) return 'verified';
  if (method === 'AI_EXTRACT') return 'ai_extracted';
  return '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const companyId = String(req.query?.company_id || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'company_id is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  // This key is server-only and is never returned to the client.
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({
      error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured',
    });
  }

  const headers = {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
  };

  async function fetchSupabase(table, select, limit) {
    const endpoint = new URL(`/rest/v1/${table}`, supabaseUrl);
    endpoint.searchParams.set('select', select);
    endpoint.searchParams.set('company_id', `eq.${companyId}`);
    if (limit) endpoint.searchParams.set('limit', String(limit));

    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Supabase Error] status=${response.status} endpoint=${req.url} table=${table} time=${new Date().toISOString()} message=${body}`);
      throw new Error(`Supabase error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  try {
    const companies = await fetchSupabase(
      'companies',
      'company_id,company_name,ceo_name,capital,established_date,website,company_intro,employee_range,company_type',
      1
    );
    const company = companies[0];

    if (!company) {
      return res.status(404).json({ error: 'company not found' });
    }

    const [contacts, awards] = await Promise.all([
      fetchSupabase('contacts', 'contact_name,title,office_phone'),
      fetchSupabase('awards', 'award_name,award_level,host_org,award_year,match_method'),
    ]);

    return res.status(200).json({
      company_id: textOrBlank(company.company_id),
      company_name: textOrBlank(company.company_name),
      ceo_name: textOrBlank(company.ceo_name),
      capital: normalizeCapital(company.capital),
      established_date: textOrBlank(company.established_date),
      website: textOrBlank(company.website),
      company_intro: textOrBlank(company.company_intro),
      employee_range: textOrBlank(company.employee_range),
      company_type: textOrBlank(company.company_type),
      contacts: contacts.map(contact => ({
        contact_name: textOrBlank(contact.contact_name),
        title: textOrBlank(contact.title),
        office_phone: textOrBlank(contact.office_phone),
      })),
      awards: awards.map(award => ({
        award_name: textOrBlank(award.award_name),
        award_level: textOrBlank(award.award_level),
        host_org: textOrBlank(award.host_org),
        award_year: textOrBlank(award.award_year),
        confidence: awardConfidence(award.match_method),
      })),
    });
  } catch (err) {
    console.error('Company detail API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

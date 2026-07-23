// api/cases.js - Vercel Serverless Function
// Fetch all Airtable Cases records with an explicit public whitelist.
const BASE_ID = 'appttP04OnzzC7qxG';
const CASES_TABLE_ID = 'tblgkjVcaohcQntzV';
const DEFAULT_CASES_SOURCE = 'airtable';

const CASE_FIELD_WHITELIST = [
  'case_id',
  'case_name',
  'industry',
  'industry_category',
  'company_size',
  'company_display_name',
  'pain_points',
  'diagnosis',
  'resistance',
  'resolution',
  'outcome',
  'replicable_condition',
  'case_type',
  'outcome_status',
  'pain_point_domain',
  'key_technology',
  'ai_maturity_stage',
  'difficulty_level',
  'is_real',
];

// Never add these source/audit/private fields back to the API response:
// company_real_name, confirmed_by, confirmed_at, source_doc, data_batch,
// case_code, linked_company.
const EXCLUDED_FIELDS = new Set([
  'company_real_name',
  'confirmed_by',
  'confirmed_at',
  'source_doc',
  'data_batch',
  'case_code',
  'linked_company',
]);
const ALLOWED_CONFIDENTIALITY = new Set(['內部可看', '公開']);

function projectCases(records) {
  return records
    .filter(fields => {
      const confidentiality = String(fields?.confidentiality || '').trim();
      return ALLOWED_CONFIDENTIALITY.has(confidentiality);
    })
    .map(fields => CASE_FIELD_WHITELIST.reduce((safeFields, fieldName) => {
      if (EXCLUDED_FIELDS.has(fieldName)) return safeFields;
      safeFields[fieldName] = fields[fieldName] ?? '';
      return safeFields;
    }, {}));
}

function getCasesSource() {
  const source = String(process.env.DB_SOURCE_CASES || DEFAULT_CASES_SOURCE).trim().toLowerCase();
  if (source === 'airtable' || source === 'supabase') return source;
  throw new Error('DB_SOURCE_CASES must be "airtable" or "supabase"');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  function logAirtableError(table, status, body) {
    const time = new Date().toISOString();
    console.error(`[Airtable Error] status=${status} endpoint=${req.url} table=${table} time=${time} message=${body}`);
    if (status === 429) {
      console.error(`[Airtable Rate Limit] status=429 endpoint=${req.url} table=${table} time=${time}`);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function fetchAirtableWithRetry(url, headers, table, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetch(url, { headers });
      if (response.ok) return response;

      if (response.status === 429 && attempt < maxRetries) {
        const waitMs = 300 * Math.pow(2, attempt);
        console.error(`[Airtable Rate Limit] retry=${attempt + 1}/${maxRetries} endpoint=${req.url} table=${table} waitMs=${waitMs} time=${new Date().toISOString()}`);
        await sleep(waitMs);
        continue;
      }

      return response;
    }
  }

  async function fetchAllAirtable(table, token) {
    let allRecords = [];
    let offset = null;

    do {
      let url = `https://api.airtable.com/v0/${BASE_ID}/${table}?pageSize=100`;
      if (offset) url += `&offset=${encodeURIComponent(offset)}`;

      const response = await fetchAirtableWithRetry(url, { Authorization: `Bearer ${token}` }, table);

      if (!response.ok) {
        const body = await response.text();
        logAirtableError(table, response.status, body);
        throw new Error(`Airtable error: ${response.status} - ${body}`);
      }

      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);

    return allRecords;
  }

  async function fetchAllSupabase(url, anonKey) {
    const endpoint = new URL('/rest/v1/cases', url);
    endpoint.searchParams.set('select', '*');

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Supabase Error] status=${response.status} endpoint=${req.url} table=cases time=${new Date().toISOString()} message=${body}`);
      throw new Error(`Supabase error: ${response.status} - ${body}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  try {
    const source = getCasesSource();
    let converted;

    if (source === 'supabase') {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY not configured' });
      }

      const records = await fetchAllSupabase(supabaseUrl, supabaseAnonKey);
      converted = projectCases(records);
    } else {
      const airtableToken = process.env.AIRTABLE_TOKEN;
      if (!airtableToken) {
        return res.status(500).json({ error: 'AIRTABLE_TOKEN not configured' });
      }

      const records = await fetchAllAirtable(CASES_TABLE_ID, airtableToken);
      converted = projectCases(records.map(rec => rec.fields || {}));
    }

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Cases API error:', err);
    return res.status(500).json({ error: err.message });
  }
}


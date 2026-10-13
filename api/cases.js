// api/cases.js - Vercel Serverless Function
import { requireAuth } from '../_lib/auth.js';
// Fetch Supabase Cases records with an explicit public whitelist.
const CASE_FIELD_WHITELIST = [
  'case_id',
  'case_name',
  'industry',
  'industry_code',
  'secondary_industry_codes',
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
  'provider_linked_company_id',
  'case_relationship_type',
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

function resolveIndustryDisplay(rawValue, codeMap) {
  if (!rawValue) return rawValue;
  const name = codeMap.get(rawValue);
  return name ? `${rawValue} ${name}` : rawValue;
}

function projectCases(records, codeMap) {
  return records
    .filter(fields => {
      const confidentiality = String(fields?.confidentiality || '').trim();
      return ALLOWED_CONFIDENTIALITY.has(confidentiality);
    })
    .map(fields => CASE_FIELD_WHITELIST.reduce((safeFields, fieldName) => {
      if (EXCLUDED_FIELDS.has(fieldName)) return safeFields;
      safeFields[fieldName] = fieldName === 'industry_code'
        ? resolveIndustryDisplay(fields.industry_code ?? '', codeMap)
        : fieldName === 'secondary_industry_codes'
          ? fields.secondary_industry_codes ?? []
          : fields[fieldName] ?? '';
      return safeFields;
    }, {}));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (!requireAuth(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  async function fetchIndustryCodeMap(url, anonKey) {
    try {
      const endpoint = new URL('/rest/v1/industry_codes', url);
      endpoint.searchParams.set('select', 'code,name');

      const response = await fetch(endpoint, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[Supabase Industry Codes Error] status=${response.status} endpoint=${req.url} table=industry_codes time=${new Date().toISOString()} message=${body}`);
        return new Map();
      }

      const data = await response.json();
      return new Map(
        (Array.isArray(data) ? data : [])
          .filter(row => row?.code && row?.name)
          .map(row => [row.code, row.name])
      );
    } catch (err) {
      console.error(`[Supabase Industry Codes Error] endpoint=${req.url} table=industry_codes time=${new Date().toISOString()} message=${err.message}`);
      return new Map();
    }
  }

  function normalizeSupabaseCase(fields) {
    const normalized = {};

    for (const [fieldName, value] of Object.entries(fields || {})) {
      normalized[fieldName] = fieldName === 'secondary_industry_codes'
        ? value ?? []
        : value ?? '';
    }

    return normalized;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY not configured' });
    }

    const industryCodeMap = supabaseUrl && supabaseAnonKey
      ? await fetchIndustryCodeMap(supabaseUrl, supabaseAnonKey)
      : new Map();

    const records = await fetchAllSupabase(supabaseUrl, supabaseAnonKey);
    const converted = projectCases(records.map(normalizeSupabaseCase), industryCodeMap);

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Cases API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// api/cases.js - Vercel Serverless Function
// Fetch all Airtable Cases records with an explicit public whitelist.
const BASE_ID = 'appttP04OnzzC7qxG';
const CASES_TABLE_ID = 'tblgkjVcaohcQntzV';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const TOKEN = process.env.AIRTABLE_TOKEN;

  if (!TOKEN) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN not configured' });
  }

  async function fetchAll(table) {
    let allRecords = [];
    let offset = null;

    do {
      let url = `https://api.airtable.com/v0/${BASE_ID}/${table}?pageSize=100`;
      if (offset) url += `&offset=${encodeURIComponent(offset)}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Airtable error: ${response.status} - ${body}`);
      }

      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);

    return allRecords;
  }

  try {
    const records = await fetchAll(CASES_TABLE_ID);

    const converted = records
      .filter(rec => {
        const confidentiality = String(rec.fields?.confidentiality || '').trim();
        return confidentiality === '內部可看' || confidentiality === '公開';
      })
      .map(rec => {
        const fields = rec.fields || {};
        return CASE_FIELD_WHITELIST.reduce((safeFields, fieldName) => {
          if (EXCLUDED_FIELDS.has(fieldName)) return safeFields;
          safeFields[fieldName] = fields[fieldName] ?? '';
          return safeFields;
        }, {});
      });

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Cases API error:', err);
    return res.status(500).json({ error: err.message });
  }
}


// api/cases.js - Vercel Serverless Function
// Fetch all Airtable Cases records for manufacturing reference cases.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appttP04OnzzC7qxG';
  const CASES_TABLE_ID = 'tblgkjVcaohcQntzV';

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

    const converted = records.map((rec, index) => {
      const f = rec.fields || {};
      return {
        id: rec.id,
        caseId: f['case_id'] || '',
        title: f['case_name'] || '',
        industry: f['industry'] || '',
        size: f['company_size'] || '',
        solutionType: f['solution_type'] || '',
        pain: f['pain_points'] || '',
        result: f['outcome'] || '',
        diagnosis: f['diagnosis'] || '',
        resistance: f['resistance'] || '',
        resolution: f['resolution'] || '',
        replicable: f['replicable_condition'] || '',
        isReal: f['is_real'] === true,
        order: index,
      };
    });

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Cases API error:', err);
    return res.status(500).json({ error: err.message });
  }
}


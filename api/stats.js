// api/stats.js — Vercel Serverless Function
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

  function increment(map, key) {
    const normalized = String(key || '').trim();
    if (!normalized) return;
    map[normalized] = (map[normalized] || 0) + 1;
  }

  function parsePrice(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }

  function median(numbers) {
    if (!numbers.length) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid];
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  try {
    const [solutions, companies] = await Promise.all([
      fetchAll('Solutions'),
      fetchAll('Companies'),
    ]);

    const byCategory = {};
    const byProgramType = {};
    const byPriceTier = {};
    const byRegion = {};
    const prices = [];
    let aiCount = 0;

    solutions.forEach(rec => {
      const f = rec.fields || {};
      if (f['has_ai'] === '有') aiCount += 1;
      increment(byCategory, f['industry_category']);
      increment(byProgramType, f['program_type']);

      const price = parsePrice(f['price']);
      if (price !== null) prices.push(price);

      const priceTier = String(f['price_tier'] || '').trim();
      if (priceTier && priceTier !== '待確認') increment(byPriceTier, priceTier);
    });

    companies.forEach(rec => {
      const f = rec.fields || {};
      increment(byRegion, f['region']);
    });

    return res.status(200).json({
      total: solutions.length,
      aiCount,
      validPriceCount: prices.length,
      medianPrice: median(prices),
      byCategory,
      byProgramType,
      byPriceTier,
      byRegion,
      companyTotal: companies.length,
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

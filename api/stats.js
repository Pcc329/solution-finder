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

  function normalizeCity(value) {
    return String(value || '').trim().replace(/臺/g, '台');
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

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const newThisWeek = solutions.filter(rec => new Date(rec.createdTime) > weekAgo).length;
    const newThisMonth = solutions.filter(rec => new Date(rec.createdTime) > monthAgo).length;
    const latest5 = [...solutions]
      .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
      .slice(0, 5)
      .map(rec => ({
        name: rec.fields?.['solution_name'] || '',
        company: rec.fields?.['company_name'] || '',
        category: rec.fields?.['industry_category'] || '',
        createdTime: rec.createdTime,
      }));

    const byCategory = {};
    const byProgramType = {};
    const byPriceTier = {};
    const byRegion = {};
    const byCity = {};
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
      increment(byCity, normalizeCity(f['city']));
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
      byCity,
      companyTotal: companies.length,
      newThisWeek,
      newThisMonth,
      latest5,
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

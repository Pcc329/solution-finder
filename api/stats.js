// api/stats.js — Vercel Serverless Function
const DEFAULT_SOLUTIONS_SOURCE = 'airtable';
const DEFAULT_COMPANIES_SOURCE = 'airtable';
const ACTIVE_SOLUTIONS_FILTER = 'NOT(LEFT({record_status}, 3) = "已下架")';
const SUSPENDED_COMPANY_STATUS = '暫停營業';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appttP04OnzzC7qxG';

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

  async function fetchAll(table, filterByFormula = '') {
    let allRecords = [];
    let offset = null;
    do {
      let url = `https://api.airtable.com/v0/${BASE_ID}/${table}?pageSize=100`;
      if (offset) url += `&offset=${offset}`;
      if (filterByFormula) url += `&filterByFormula=${encodeURIComponent(filterByFormula)}`;
      const response = await fetchAirtableWithRetry(url, { Authorization: `Bearer ${TOKEN}` }, table);
      if (!response.ok) {
        const body = await response.text();
        logAirtableError(table, response.status, body);
        throw new Error(`Airtable error: ${response.status} — ${body}`);
      }
      const data = await response.json();
      allRecords = allRecords.concat(data.records);
      offset = data.offset || null;
    } while (offset);
    return allRecords;
  }

  function getSource(envName, defaultSource) {
    const source = String(process.env[envName] || defaultSource).trim().toLowerCase();
    if (source === 'airtable' || source === 'supabase') return source;
    throw new Error(`${envName} must be "airtable" or "supabase"`);
  }

  async function fetchAllSupabasePaged(url, anonKey, table, selectCols, orderBy, filters = {}) {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.searchParams.set('select', selectCols);
    endpoint.searchParams.set('order', orderBy);
    Object.entries(filters).forEach(([key, value]) => endpoint.searchParams.set(key, value));

    const pageSize = 1000;
    const all = [];
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

      if (response.status === 416) break;
      if (!response.ok) {
        const body = await response.text();
        console.error(`[Supabase Error] status=${response.status} endpoint=${req.url} table=${table} time=${new Date().toISOString()} message=${body}`);
        throw new Error(`Supabase ${table} error: ${response.status} - ${body}`);
      }

      const page = await response.json();
      const rows = Array.isArray(page) ? page : [];
      all.push(...rows);
      if (rows.length < pageSize) break;
      start += pageSize;
    }

    console.log(`[Supabase] stats fetched table=${table} count=${all.length}`);
    return all;
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

  function getFields(record) {
    return record?.fields || record || {};
  }

  function getCreatedTime(record) {
    return record?.createdTime || record?.created_at || '';
  }

  function isAi(value) {
    return value === true || value === '有';
  }

  try {
    const solutionsSource = getSource('DB_SOURCE_SOLUTIONS', DEFAULT_SOLUTIONS_SOURCE);
    const companiesSource = getSource('DB_SOURCE_COMPANIES', DEFAULT_COMPANIES_SOURCE);
    const needsSupabase = solutionsSource === 'supabase' || companiesSource === 'supabase';
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (needsSupabase && (!supabaseUrl || !supabaseAnonKey)) {
      return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY not configured' });
    }

    const activeSolutionsFilter = {
      // Exclude every confirmed retired status beginning with 「已下架」;
      // retain legacy NULL and unverified 「疑似已下架」 statuses.
      or: '(record_status.is.null,record_status.not.like.已下架*)',
    };
    const activeCompaniesFilter = {
      // Supabase companies uses its own enum, distinct from Solutions.record_status.
      company_status: 'neq.暫停營業',
    };

    const [solutionRecords, companyRecords] = await Promise.all([
      solutionsSource === 'supabase'
        ? fetchAllSupabasePaged(
          supabaseUrl,
          supabaseAnonKey,
          'solutions',
          'solution_id,company_id,solution_name,has_ai,industry_category,program_type,data_source,price,price_tier,created_at',
          'solution_id.asc',
          activeSolutionsFilter
        )
        : fetchAll('Solutions', ACTIVE_SOLUTIONS_FILTER),
      companiesSource === 'supabase'
        ? fetchAllSupabasePaged(
          supabaseUrl,
          supabaseAnonKey,
          'companies',
          'company_id,company_name,region,is_startup,city,company_status',
          'company_id.asc',
          activeCompaniesFilter
        )
        : fetchAll('Companies'),
    ]);

    // Airtable Single Select filters on Chinese values are unreliable; retain active rows and
    // remove only the explicit suspended company status in JavaScript.
    const companies = companiesSource === 'airtable'
      ? companyRecords.filter(rec => getFields(rec)['company_status'] !== SUSPENDED_COMPANY_STATUS)
      : companyRecords;
    const solutions = solutionRecords;

    const companyNameById = new Map(
      companies.map(rec => {
        const f = getFields(rec);
        return [String(f['company_id'] || '').trim(), f['company_name'] || ''];
      }).filter(([companyId]) => companyId)
    );

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const newThisWeek = solutions.filter(rec => new Date(getCreatedTime(rec)) > weekAgo).length;
    const newThisMonth = solutions.filter(rec => new Date(getCreatedTime(rec)) > monthAgo).length;
    const latest5 = [...solutions]
      .sort((a, b) => new Date(getCreatedTime(b)) - new Date(getCreatedTime(a)))
      .slice(0, 5)
      .map(rec => {
        const f = getFields(rec);
        return {
          name: f['solution_name'] || '',
          company: f['company_name'] || companyNameById.get(String(f['company_id'] || '').trim()) || '',
          category: f['industry_category'] || '',
          dataSource: f['data_source'] || '',
          createdTime: getCreatedTime(rec),
        };
      });

    const byCategory = {};
    const byProgramType = {};
    const byPriceTier = {};
    const byRegion = {};
    const byCity = {};
    const prices = [];
    let aiCount = 0;

    solutions.forEach(rec => {
      const f = getFields(rec);
      if (isAi(f['has_ai'])) aiCount += 1;
      increment(byCategory, f['industry_category']);
      increment(byProgramType, f['program_type']);

      const price = parsePrice(f['price']);
      if (price !== null) prices.push(price);

      const priceTier = String(f['price_tier'] || '').trim();
      if (priceTier && priceTier !== '待確認') increment(byPriceTier, priceTier);
    });

    companies.forEach(rec => {
      const f = getFields(rec);
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

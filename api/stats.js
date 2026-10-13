// api/stats.js — Vercel Serverless Function
const CASES_TABLE = 'cases';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

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

  async function fetchMaintenance(supabaseUrl, supabaseAnonKey, days = 7) {
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/maintenance_activity`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_days: days }),
      });
      if (!resp.ok) throw new Error(`maintenance_activity HTTP ${resp.status}`);
      const rows = await resp.json();
      const totals = { solutions: 0, companies: 0 };
      const items = [];
      for (const r of Array.isArray(rows) ? rows : []) {
        if (r.label === '__total__') {
          if (r.kind === 'solution') totals.solutions = Number(r.item_count) || 0;
          if (r.kind === 'company') totals.companies = Number(r.item_count) || 0;
        } else if (r.day) {
          items.push({ date: String(r.day).slice(0, 10), kind: r.kind, label: r.label, count: Number(r.item_count) || 0 });
        }
      }
      return { windowDays: days, totals, items };
    } catch (err) {
      console.error('maintenance_activity failed:', err);
      return null;
    }
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

  function getWeekStart(now) {
    const start = new Date(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  function isAi(value) {
    return value === true || value === '有';
  }

  try {
    // Recent case activity is sourced from Supabase so is_real can be enforced server-side.
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY not configured' });
    }

    const activeSolutionsFilter = {
      // Exclude every confirmed retired status beginning with 「已下架」; retain NULL and unverified 「疑似已下架」 statuses.
      or: '(record_status.is.null,record_status.not.like.已下架*)',
    };
    const activeCompaniesFilter = {
      // Supabase companies uses its own enum, distinct from Solutions.record_status.
      company_status: 'neq.暫停營業',
    };

    const [solutionRecords, companyRecords, caseRecords] = await Promise.all([
      fetchAllSupabasePaged(
        supabaseUrl,
        supabaseAnonKey,
        'solutions',
        'solution_id,company_id,solution_name,has_ai,industry_category,program_type,data_source,price,price_tier,created_at',
        'solution_id.asc',
        activeSolutionsFilter
      ),
      fetchAllSupabasePaged(
        supabaseUrl,
        supabaseAnonKey,
        'companies',
        'company_id,company_name,region,is_startup,city,company_status,created_at',
        'company_id.asc',
        activeCompaniesFilter
      ),
      fetchAllSupabasePaged(
        supabaseUrl,
        supabaseAnonKey,
        CASES_TABLE,
        'case_id,case_name,created_at,is_real',
        'created_at.desc',
        { is_real: 'eq.true' }
      ),
    ]);
    const maintenance = supabaseUrl && supabaseAnonKey
      ? await fetchMaintenance(supabaseUrl, supabaseAnonKey, 7)
      : null;

    const companies = companyRecords;
    const solutions = solutionRecords;
    const cases = caseRecords;

    const companyNameById = new Map(
      companies.map(rec => {
        const f = getFields(rec);
        return [String(f['company_id'] || '').trim(), f['company_name'] || ''];
      }).filter(([companyId]) => companyId)
    );

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const weekStart = getWeekStart(now);
    const newThisWeek = solutions.filter(rec => new Date(getCreatedTime(rec)) > weekAgo).length;
    const newThisMonth = solutions.filter(rec => new Date(getCreatedTime(rec)) > monthAgo).length;
    const newCompaniesThisWeek = companies.filter(rec => new Date(getCreatedTime(rec)) >= weekStart).length;
    const newCasesThisWeek = cases.filter(rec => new Date(getCreatedTime(rec)) >= weekStart).length;
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

    const latestCases = [...cases]
      .sort((a, b) => new Date(getCreatedTime(b)) - new Date(getCreatedTime(a)))
      .slice(0, 5)
      .map(rec => {
        const f = getFields(rec);
        return {
          type: 'case',
          name: f['case_name'] || '',
          createdTime: getCreatedTime(rec),
        };
      });

    const recentItems = [
      ...latest5.map(item => ({ ...item, type: 'solution' })),
      ...latestCases,
    ]
      .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
      .slice(0, 5);

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
      caseTotal: cases.length,
      newCasesThisWeek,
      newCompaniesThisWeek,
      recentItems,
      maintenance,
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

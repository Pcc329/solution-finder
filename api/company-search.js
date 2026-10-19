// api/company-search.js - Vercel Serverless Function
import { requireAuth } from '../_lib/auth.js';
import { insertSupabase } from '../_lib/supabase-insert.js';

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const COMPANY_COLUMNS = 'company_id,company_name,city,region,is_startup,logo_url,tax_primary_name,it_code_rank';
const SOLUTION_COLUMNS = 'solution_id,airtable_rec_id,solution_name,program_type,record_status,has_ai,price,monthly_price';
const NAME_ERROR = '公司名稱至少需要 2 個字';

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
    for (const [key, value] of rateLimitMap) {
      if (now - value.windowStart >= RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
    }
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  record.count += 1;
  return true;
}

function normalizeQuery(value) {
  return String(value ?? '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ').trim().replace(/\s+/g, ' ');
}

function toCore(value) {
  return normalizeQuery(value).replace(/(?:股份有限公司|有限公司|公司)$/, '').replace(/\s/g, '');
}

function sanitizeForIlike(core) {
  return core.replace(/[* ,()"\\%]/g, '');
}

function parseQuery(value) {
  const query = normalizeQuery(value);
  const length = Array.from(query).length;
  if (!length || length > 50) return { error: '請輸入 1～50 字的統編或公司名稱' };
  const taxId = query.replace(/[\s-]/g, '');
  if (/^\d+$/.test(taxId)) {
    if (taxId.length !== 8) return { error: '統編須為 8 碼數字' };
    return { query, input_type: 'tax_id', taxId };
  }
  const core = toCore(query);
  const safeCore = sanitizeForIlike(core);
  if (Array.from(core).length < 2 || Array.from(safeCore).length < 2) return { error: NAME_ERROR };
  return { query, input_type: 'name', core, safeCore };
}

function textOrBlank(value) {
  return String(value ?? '');
}

function numberOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function classifyStatus(value) {
  const status = textOrBlank(value);
  if (status.startsWith('已下架')) return 'delisted';
  if (status.startsWith('疑似')) return 'suspected';
  return 'normal';
}

function logReadError(table, status) {
  console.error(`[Supabase Error] status=${status} table=${table} time=${new Date().toISOString()}`);
}

async function fetchSupabaseRows(config, table, select, filters, options = {}) {
  let status = 'unknown';
  try {
    const endpoint = new URL(`/rest/v1/${table}`, config.url);
    endpoint.searchParams.set('select', select);
    for (const [key, value] of Object.entries(filters)) endpoint.searchParams.set(key, value);
    if (options.order) endpoint.searchParams.set('order', options.order);
    if (options.limit) endpoint.searchParams.set('limit', String(options.limit));
    const rows = [];
    const pageSize = 1000;
    for (let start = 0; ; start += pageSize) {
      const headers = { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` };
      if (options.paged) {
        headers.Range = `${start}-${start + pageSize - 1}`;
        headers['Range-Unit'] = 'items';
      }
      const response = await fetch(endpoint, { headers });
      status = response.status;
      if (options.paged && response.status === 416) break;
      if (!response.ok) throw new Error('Supabase read failed');
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('Invalid Supabase response');
      rows.push(...page);
      if (!options.paged || page.length < pageSize) break;
    }
    return rows;
  } catch {
    logReadError(table, status);
    if (options.optional) return [];
    throw new Error('Supabase read failed');
  }
}

function buildCompanyProfile(company, registrations, categories, awards) {
  return {
    company_id: textOrBlank(company.company_id),
    company_name: textOrBlank(company.company_name),
    city: textOrBlank(company.city),
    region: textOrBlank(company.region),
    is_startup: Boolean(company.is_startup),
    logo_url: textOrBlank(company.logo_url),
    tax_primary_name: textOrBlank(company.tax_primary_name),
    it_code_rank: numberOrNull(company.it_code_rank),
    gov_registered: registrations.length > 0,
    cdm_classified: categories.length > 0,
    awards: awards.map(award => ({
      award_name: textOrBlank(award.award_name),
      award_year: textOrBlank(award.award_year),
      award_category: textOrBlank(award.award_category),
    })),
  };
}

function buildSolution(row) {
  return {
    id: textOrBlank(row.airtable_rec_id || row.solution_id).replace(/^\uFEFF/, ''),
    solution_id: textOrBlank(row.solution_id),
    name: textOrBlank(row.solution_name),
    program_type: textOrBlank(row.program_type),
    status: classifyStatus(row.record_status),
    status_label: textOrBlank(row.record_status),
    has_ai: Boolean(row.has_ai),
    price: numberOrNull(row.price),
    monthly_price: numberOrNull(row.monthly_price),
  };
}

function summarizeSolutions(solutions) {
  const summary = { total: solutions.length, normal: 0, suspected: 0, delisted: 0 };
  const bySource = new Map();
  for (const solution of solutions) {
    summary[solution.status] += 1;
    const source = solution.program_type || '未標示';
    bySource.set(source, (bySource.get(source) || 0) + 1);
  }
  return { ...summary, by_source: Object.fromEntries(bySource) };
}

async function buildExactResult(config, input, company) {
  const filters = { company_id: `eq.${company.company_id}` };
  const [rows, registrations, categories, awards] = await Promise.all([
    fetchSupabaseRows(config, 'solutions', SOLUTION_COLUMNS, filters, { order: 'solution_id.asc', paged: true }),
    fetchSupabaseRows(config, 'gov_registrations', 'company_id', filters, { limit: 1, optional: true }),
    fetchSupabaseRows(config, 'company_cdm_categories', 'company_id', filters, { limit: 1, optional: true }),
    fetchSupabaseRows(config, 'awards', 'award_name,award_year,award_category', filters,
      { order: 'award_name.asc,award_year.asc,award_category.asc', paged: true, optional: true }),
  ]);
  const solutions = rows.map(buildSolution);
  return {
    query: input.query, input_type: input.input_type, match_type: 'exact', result_count: 1,
    company: buildCompanyProfile(company, registrations, categories, awards),
    solutions, summary: summarizeSolutions(solutions),
  };
}

function briefCompany(company) {
  return {
    company_id: textOrBlank(company.company_id),
    company_name: textOrBlank(company.company_name),
    city: textOrBlank(company.city),
  };
}

function quoteFilterValue(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function searchCompany(config, input) {
  if (input.input_type === 'tax_id') {
    const companies = await fetchSupabaseRows(config, 'companies', COMPANY_COLUMNS,
      { company_id: `eq.${input.taxId}` }, { limit: 1 });
    if (companies.length) return buildExactResult(config, input, companies[0]);
    return { query: input.query, input_type: input.input_type, match_type: 'none', result_count: 0, near: [] };
  }

  const companies = await fetchSupabaseRows(config, 'companies', COMPANY_COLUMNS,
    { company_name: `ilike.*${input.safeCore}*` }, { limit: 20, order: 'company_name.asc' });
  const exact = companies.filter(company => toCore(company.company_name) === input.core);
  if (exact.length === 1) return buildExactResult(config, input, exact[0]);
  if (companies.length) {
    const candidates = companies.slice(0, 10);
    const ids = candidates.map(company => quoteFilterValue(company.company_id));
    // One batched count query for the displayed candidates, never one per company.
    const rows = await fetchSupabaseRows(config, 'solutions', 'company_id,record_status',
      { company_id: `in.(${ids.join(',')})` });
    const counts = new Map();
    for (const row of rows) {
      const id = textOrBlank(row.company_id);
      const count = counts.get(id) || { total: 0, active: 0 };
      count.total += 1;
      if (classifyStatus(row.record_status) !== 'delisted') count.active += 1;
      counts.set(id, count);
    }
    return {
      query: input.query, input_type: input.input_type, match_type: 'partial', result_count: candidates.length,
      candidates: candidates.map(company => ({ ...briefCompany(company),
        solution_count: counts.get(textOrBlank(company.company_id))?.total || 0,
        active_solution_count: counts.get(textOrBlank(company.company_id))?.active || 0 })),
    };
  }
  const prefix = Array.from(input.safeCore).slice(0, 2).join('');
  const near = await fetchSupabaseRows(config, 'companies', 'company_id,company_name,city',
    { company_name: `ilike.${prefix}*` }, { limit: 5, order: 'company_name.asc' });
  return { query: input.query, input_type: input.input_type, match_type: 'none', result_count: 0,
    near: near.slice(0, 5).map(briefCompany) };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) return res.status(429).json({ error: '查詢過於頻繁，請稍後再試' });
  if (!requireAuth(req, res)) return;
  const input = parseQuery(req.query?.q);
  if (input.error) return res.status(400).json({ error: input.error });
  const config = { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY };
  if (!config.url || !config.anonKey) {
    logReadError('companies', 'unknown');
    return res.status(500).json({ error: '查詢失敗，請稍後再試' });
  }
  let result;
  try {
    result = await searchCompany(config, input);
  } catch {
    return res.status(500).json({ error: '查詢失敗，請稍後再試' });
  }
  try {
    await insertSupabase('search_logs', {
      search_query: input.query, log_type: 'company_search',
      input_type: result.input_type, match_type: result.match_type, result_count: result.result_count,
    });
  } catch {
    logReadError('search_logs', 'unknown');
  }
  return res.status(200).json(result);
}

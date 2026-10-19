import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/company-search.js';
import { createSessionValue } from '../_lib/auth.js';

const company = { company_id: '10000001', company_name: '合成科技股份有限公司', city: '測試市',
  region: '測試區', is_startup: true, logo_url: null, tax_primary_name: '合成行業', it_code_rank: 1,
  contact: 'synthetic-private', email: 'synthetic-private', mobile: 'synthetic-private', office_phone: 'synthetic-private' };
const solutions = [
  { company_id: company.company_id, solution_id: 'S-001', airtable_rec_id: '\uFEFFrec-synthetic',
    solution_name: '合成方案一', program_type: '合成來源', record_status: null, has_ai: true, price: '12.5', monthly_price: null },
  { company_id: company.company_id, solution_id: 'S-002', airtable_rec_id: null,
    solution_name: '合成方案二', program_type: '合成來源', record_status: '疑似已下架_合成原因', has_ai: false, price: null, monthly_price: '25' },
  { company_id: company.company_id, solution_id: 'S-003', solution_name: '合成方案三',
    program_type: '合成來源', record_status: '已下架_合成原因', has_ai: false, price: '', monthly_price: null },
  { company_id: company.company_id, solution_id: '\uFEFFS-004', solution_name: null,
    program_type: null, record_status: '其他狀態', has_ai: null, price: 'not-a-number', monthly_price: '' },
];
const fixtures = {
  companies: [company], solutions,
  gov_registrations: [{ company_id: company.company_id }],
  company_cdm_categories: [{ company_id: company.company_id }],
  awards: [{ company_id: company.company_id, award_name: '合成獎項', award_year: '2026', award_category: '合成類別' }],
};
let requestCounter = 0;

async function invoke(q = company.company_id, options = {}) {
  const env = { SUPABASE_URL: 'https://synthetic-supabase.invalid', SUPABASE_ANON_KEY: 'synthetic-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role', API_KEYS_ALLOWLIST: 'synthetic-api-key',
    SESSION_SECRET: 'synthetic-session-secret' };
  const oldEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch, originalError = console.error, originalNow = Date.now;
  const calls = [], logs = [], responseHeaders = {};
  let settled = false;
  const res = {
    statusCode: undefined, body: undefined,
    setHeader(key, value) { responseHeaders[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) {
      if (this.statusCode === 200 && !options.missingWriteKey) assert.equal(settled, true, 'await the write before responding');
      this.body = body; return this;
    }, end() { return this; },
  };
  try {
    Object.assign(process.env, env);
    if (options.now !== undefined) Date.now = () => options.now;
    if (options.missing) delete process.env[options.missing];
    if (options.missingWriteKey) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.error = (...args) => logs.push(args.join(' '));
    globalThis.fetch = async (input, request = {}) => {
      const url = new URL(input);
      assert.equal(url.origin, env.SUPABASE_URL);
      const table = url.pathname.split('/').at(-1);
      const call = { table, url, ...request };
      calls.push(call);
      if (request.method === 'POST') {
        assert.equal(table, 'search_logs');
        call.row = JSON.parse(request.body);
        await new Promise(resolve => setImmediate(resolve));
        settled = true;
        if (options.writeFailure === 'throw') throw new Error('synthetic-private-failure');
        return { ok: !options.writeFailure, status: options.writeFailure ? 500 : 201,
          json: async () => ({ code: '23514', message: 'synthetic-private-failure' }) };
      }
      assert.notEqual(table, 'contacts');
      assert.ok(Object.hasOwn(fixtures, table));
      if ([options.readFailure].flat().includes(table)) {
        if (options.readMode === 'throw') throw new Error('synthetic-private-failure');
        if (options.readMode === 'json') return { ok: true, status: 200, json: async () => { throw new Error('synthetic-private-failure'); } };
        return { ok: false, status: 500, text: async () => 'synthetic-private-failure' };
      }
      let rows = structuredClone(options[table] ?? fixtures[table]);
      const companyFilter = url.searchParams.get('company_id');
      if (companyFilter?.startsWith('eq.')) rows = rows.filter(row => row.company_id === companyFilter.slice(3));
      if (companyFilter?.startsWith('in.')) {
        const ids = JSON.parse(`[${companyFilter.slice(4, -1)}]`);
        rows = rows.filter(row => ids.includes(row.company_id));
      }
      const nameFilter = url.searchParams.get('company_name');
      if (nameFilter) {
        assert.ok(nameFilter.startsWith('ilike.'));
        const pattern = nameFilter.slice(6), contains = pattern.startsWith('*');
        const core = pattern.replace(/^\*/, '').replace(/\*$/, '').toLowerCase();
        rows = rows.filter(row => contains ? row.company_name.toLowerCase().includes(core) : row.company_name.toLowerCase().startsWith(core));
      }
      const order = url.searchParams.get('order');
      if (order) {
        const field = order.split('.')[0];
        rows.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')));
      }
      if (url.searchParams.has('limit')) rows = rows.slice(0, Number(url.searchParams.get('limit')));
      if (request.headers.Range) {
        const [start, end] = request.headers.Range.split('-').map(Number);
        if (options.range416 && start >= rows.length) return { ok: false, status: 416 };
        rows = rows.slice(start, end + 1);
      }
      // Deliberately retain extra upstream fields: output must still use an explicit whitelist.
      return { ok: true, status: 200, json: async () => rows };
    };
    const identity = options.identity ?? `synthetic-client-${++requestCounter}`;
    const req = {
      method: options.method ?? 'GET', query: q === undefined ? {} : { q },
      headers: { ...(options.socket ? {} : { 'x-forwarded-for': `${identity}, synthetic-proxy` }),
        ...(options.auth === false || options.auth === 'session' ? {} : { 'x-api-key': env.API_KEYS_ALLOWLIST }) },
      socket: { remoteAddress: identity },
      cookies: options.auth === 'session'
        ? { sf_session: createSessionValue(Date.now() + 60_000, env.SESSION_SECRET) } : {},
    };
    await handler(req, res);
    return { res, calls, logs, responseHeaders, writes: calls.filter(call => call.method === 'POST'),
      reads: calls.filter(call => call.method !== 'POST') };
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    Date.now = originalNow;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

function assertNoContactFields(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(key, /contact|email|mobile|office_phone/i);
    assertNoContactFields(child);
  }
}

test('1. tax ID exact match returns whitelisted company, all solutions and summary', async () => {
  const { res, reads } = await invoke();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.query, company.company_id);
  assert.equal(res.body.input_type, 'tax_id');
  assert.equal(res.body.match_type, 'exact');
  assert.equal(res.body.result_count, 1);
  assert.deepEqual(res.body.company, { company_id: company.company_id, company_name: company.company_name,
    city: '測試市', region: '測試區', is_startup: true, logo_url: '', tax_primary_name: '合成行業', it_code_rank: 1,
    gov_registered: true, cdm_classified: true, awards: [{ award_name: '合成獎項', award_year: '2026', award_category: '合成類別' }] });
  assert.deepEqual(res.body.summary, { total: 4, normal: 2, suspected: 1, delisted: 1,
    by_source: { '合成來源': 3, '未標示': 1 } });
  const first = res.body.solutions.find(row => row.solution_id === 'S-001');
  assert.deepEqual(first, { id: 'rec-synthetic', solution_id: 'S-001', name: '合成方案一', program_type: '合成來源',
    status: 'normal', status_label: '', has_ai: true, price: 12.5, monthly_price: null });
  assert.equal(res.body.solutions.find(row => row.solution_id === 'S-002').id, 'S-002');
  assert.equal(res.body.solutions.find(row => row.solution_id === '\uFEFFS-004').id, 'S-004');
  assert.equal(reads.find(call => call.table === 'solutions').url.searchParams.has('record_status'), false);
  assert.equal(reads.find(call => call.table === 'solutions').url.searchParams.has('or'), false);
  const empty = await invoke(undefined, { solutions: [] });
  assert.equal(empty.res.body.summary.total, 0);
  // Exact matches must not silently truncate at PostgREST's page size.
  const large = Array.from({ length: 2000 }, (_, i) => ({ ...solutions[0], solution_id: `PAGE-${String(i).padStart(5, '0')}` }));
  const paged = await invoke(undefined, { solutions: large, range416: true });
  assert.equal(paged.res.body.summary.total, 2000);
  assert.equal(paged.reads.filter(call => call.table === 'solutions').length, 3);
});

test('2. statuses use prefixes, preserve labels and normalize nullable numeric values', async () => {
  const { res } = await invoke();
  assert.equal(res.body.solutions.find(row => row.solution_id === 'S-001').status, 'normal');
  assert.equal(res.body.solutions.find(row => row.solution_id === 'S-002').status, 'suspected');
  assert.equal(res.body.solutions.find(row => row.solution_id === 'S-003').status, 'delisted');
  const other = res.body.solutions.find(row => row.solution_id === '\uFEFFS-004');
  assert.equal(other.status, 'normal'); assert.equal(other.status_label, '其他狀態');
  assert.equal(other.price, null); assert.equal(other.monthly_price, null); assert.equal(other.name, '');
  const prefix = await invoke(undefined, { solutions: [{ ...solutions[0], record_status: '疑似_測試' }] });
  assert.equal(prefix.res.body.solutions[0].status, 'suspected');
});

test('3. full-width digits, letters and spaces normalize; separated tax IDs match', async () => {
  for (const [q, normalized] of [['１００００００１', '10000001'], ['　1000  -  0001　', '1000 - 0001']]) {
    const { res, reads, writes } = await invoke(q);
    assert.equal(res.body.match_type, 'exact'); assert.equal(res.body.query, normalized);
    assert.equal(reads[0].url.searchParams.get('company_id'), 'eq.10000001');
    assert.equal(writes[0].row.search_query, normalized);
  }
  const latin = await invoke('　ＡＣＭＥ　科技　', { companies: [{ ...company, company_name: 'ACME科技股份有限公司' }] });
  assert.equal(latin.res.body.query, 'ACME 科技'); assert.equal(latin.res.body.match_type, 'exact');
});

test('4. seven- or nine-digit numeric input is rejected before reads and writes', async () => {
  for (const q of ['1234567', '123456789', '１２３４５６７', '12-34567']) {
    const { res, calls } = await invoke(q);
    assert.equal(res.statusCode, 400); assert.deepEqual(res.body, { error: '統編須為 8 碼數字' });
    assert.equal(calls.length, 0);
  }
});

test('5. a single equal name core is exact with or without suffix; optional reads fail independently', async () => {
  for (const q of ['合成科技股份有限公司', '合成科技有限公司', '合成科技公司', '合 成 科 技']) {
    const { res } = await invoke(q);
    assert.equal(res.body.match_type, 'exact'); assert.equal(res.body.input_type, 'name');
  }
  for (const readFailure of ['awards', 'gov_registrations', 'company_cdm_categories']) {
    for (const readMode of ['500', 'throw', 'json']) {
      const { res, logs } = await invoke(undefined, { readFailure, readMode });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.company.gov_registered, readFailure !== 'gov_registrations');
      assert.equal(res.body.company.cdm_classified, readFailure !== 'company_cdm_categories');
      assert.equal(res.body.company.awards.length, readFailure === 'awards' ? 0 : 1);
      assert.equal(logs.length, 1); assert.match(logs[0], new RegExp(`table=${readFailure} time=`));
      assert.equal(logs[0].includes('synthetic-private-failure'), false);
    }
  }
  const rows = Array.from({ length: 11 }, (_, i) => ({ ...company, company_id: `candidate-${i}`, company_name: `合成${i}科技股份有限公司` }));
  rows.push(company);
  assert.equal((await invoke('合成科技', { companies: rows })).res.body.match_type, 'exact');
});

test('6. partial matches return at most ten ordered candidates and count with one batched solutions query', async () => {
  const companies = Array.from({ length: 22 }, (_, i) => ({ ...company, company_id: `candidate-${i}`,
    company_name: `合成${String(i).padStart(2, '0')}科技股份有限公司` }));
  const result = await invoke('合成', { companies,
    solutions: [...solutions.map(row => ({ ...row, company_id: 'candidate-0' })),
      { ...solutions[0], company_id: 'candidate-1' }] });
  assert.equal(result.res.body.match_type, 'partial'); assert.equal(result.res.body.result_count, 10);
  assert.equal(result.reads[0].url.searchParams.get('limit'), '20');
  assert.equal(result.reads[0].url.searchParams.get('order'), 'company_name.asc');
  assert.deepEqual(result.res.body.candidates[0], { company_id: 'candidate-0', company_name: companies[0].company_name,
    city: '測試市', solution_count: 4, active_solution_count: 3 });
  assert.equal(result.res.body.candidates[1].active_solution_count, 1);
  assert.equal(result.res.body.candidates[2].solution_count, 0);
  const countCalls = result.reads.filter(call => call.table === 'solutions');
  assert.equal(countCalls.length, 1); assert.equal(countCalls[0].url.searchParams.get('select'), 'company_id,record_status');
  const ids = JSON.parse(`[${countCalls[0].url.searchParams.get('company_id').slice(4, -1)}]`);
  assert.equal(ids.length, 10);
  const ambiguous = await invoke('合成科技', { companies: [company, { ...company, company_id: '10000002', company_name: '合成科技有限公司' }] });
  assert.equal(ambiguous.res.body.match_type, 'partial');
});

test('7. no match returns zero results and at most five prefix hints; tax ID misses never query hints', async () => {
  const companies = Array.from({ length: 6 }, (_, i) => ({ ...company, company_id: `near-${i}`, company_name: `未來${i}科技股份有限公司` }));
  const { res, reads } = await invoke('未來查無股份有限公司', { companies });
  assert.equal(res.body.match_type, 'none'); assert.equal(res.body.result_count, 0); assert.equal(res.body.near.length, 5);
  assert.equal(reads.length, 2); assert.equal(reads[1].url.searchParams.get('company_name'), 'ilike.未來*');
  assert.equal(reads[1].url.searchParams.get('limit'), '5');
  const absent = await invoke('99999999');
  assert.deepEqual(absent.res.body.near, []); assert.equal(absent.reads.length, 1);
});

test('8. user-supplied PostgREST metacharacters are removed from name and prefix filters', async () => {
  for (const q of ['合*,()"\\%成', '未*,()"\\%來查無']) {
    const { res, reads } = await invoke(q);
    assert.equal(res.statusCode, 200);
    for (const call of reads.filter(call => call.table === 'companies')) {
      const core = call.url.searchParams.get('company_name').slice(6).replace(/^\*/, '').replace(/\*$/, '');
      assert.doesNotMatch(core, /[*,()"\\%]/);
      assert.ok(Array.from(core).length >= 2);
    }
  }
  for (const q of ['*,()"\\%', '合*,()"\\%']) {
    const { res, calls } = await invoke(q); assert.equal(res.statusCode, 400); assert.equal(calls.length, 0);
  }
});

test('9. invalid lengths and short cores return exact validation messages without storage', async () => {
  for (const q of ['', '　 ', '合'.repeat(51), null]) {
    const { res, calls } = await invoke(q);
    assert.deepEqual(res.body, { error: '請輸入 1～50 字的統編或公司名稱' }); assert.equal(res.statusCode, 400); assert.equal(calls.length, 0);
  }
  for (const q of ['a', '合股份有限公司', '有限公司', '公司']) {
    const { res, calls } = await invoke(q);
    assert.deepEqual(res.body, { error: '公司名稱至少需要 2 個字' }); assert.equal(calls.length, 0);
  }
  assert.equal((await invoke('合'.repeat(50))).res.statusCode, 200);
});

test('10. every response path omits contact-related fields and never reads contacts', async () => {
  for (const q of [company.company_id, '合成科技', '合成', '查無公司', '1234567']) {
    const { res, calls } = await invoke(q); assertNoContactFields(res.body);
    assert.equal(calls.some(call => call.table === 'contacts'), false);
  }
});

test('11. each 200 awaits one complete search log; storage errors preserve payload and non-200 never writes', async () => {
  for (const q of [company.company_id, '合成', '查無公司']) {
    const expected = await invoke(q);
    assert.equal(expected.writes.length, 1);
    assert.deepEqual(expected.writes[0].row, { search_query: expected.res.body.query, log_type: 'company_search',
      input_type: expected.res.body.input_type, match_type: expected.res.body.match_type, result_count: expected.res.body.result_count });
    assert.deepEqual(expected.writes[0].headers, { apikey: 'synthetic-service-role', Authorization: 'Bearer synthetic-service-role',
      'Content-Type': 'application/json', Prefer: 'return=minimal' });
    for (const writeFailure of ['500', 'throw']) {
      const result = await invoke(q, { writeFailure });
      assert.equal(result.res.statusCode, 200); assert.deepEqual(result.res.body, expected.res.body);
      assert.equal(result.writes.length, 1); assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].includes('synthetic-private-failure'), false);
    }
    const missing = await invoke(q, { missingWriteKey: true });
    assert.equal(missing.res.statusCode, 200); assert.deepEqual(missing.res.body, expected.res.body); assert.equal(missing.logs.length, 1);
  }
  for (const [options, status] of [[{ auth: false }, 401], [{ method: 'POST' }, 405],
    [{ readFailure: 'companies' }, 500], [{ readFailure: 'solutions' }, 500],
    [{ missing: 'SUPABASE_URL' }, 500], [{ missing: 'SUPABASE_ANON_KEY' }, 500]]) {
    const result = await invoke(undefined, options); assert.equal(result.res.statusCode, status); assert.equal(result.writes.length, 0);
    if (status === 500) {
      assert.deepEqual(result.res.body, { error: '查詢失敗，請稍後再試' }); assert.equal(result.logs.length, 1);
      assert.match(result.logs[0], /^\[Supabase Error\] status=(500|unknown) table=(companies|solutions) time=\S+Z$/);
    }
  }
});

test('12. every read uses anon credentials, including session-authenticated requests and optional tables', async () => {
  for (const options of [{}, { auth: 'session' }, { companies: [] }]) {
    const { res, reads } = await invoke(undefined, options); assert.equal(res.statusCode, 200);
    for (const call of reads) {
      assert.equal(call.headers.apikey, 'synthetic-anon'); assert.equal(call.headers.Authorization, 'Bearer synthetic-anon');
      assert.equal(Object.values(call.headers).includes('synthetic-service-role'), false);
    }
  }
});

test('13. the sixty-first request is limited before auth; methods precede limiting and expired windows reset', async () => {
  const identity = `synthetic-limit-${++requestCounter}`, now = 1_700_000_000_000;
  for (let i = 0; i < 60; i += 1) {
    const result = await invoke('a', { identity, now, auth: false });
    assert.equal(result.res.statusCode, 401); assert.equal(result.calls.length, 0);
  }
  const limited = await invoke(undefined, { identity, now, auth: false, socket: true });
  assert.equal(limited.res.statusCode, 429); assert.equal(limited.calls.length, 0);
  assert.deepEqual(limited.res.body, { error: '查詢過於頻繁，請稍後再試' });
  const options = await invoke(undefined, { identity, now, method: 'OPTIONS', auth: false });
  assert.equal(options.res.statusCode, 204); assert.equal(options.calls.length, 0);
  assert.equal(options.responseHeaders['Access-Control-Allow-Origin'], '*');
  assert.equal(options.responseHeaders['Access-Control-Allow-Methods'], 'GET, OPTIONS');
  assert.equal((await invoke(undefined, { identity, now, method: 'POST', auth: false })).res.statusCode, 405);
  assert.equal((await invoke(undefined, { identity, now: now + 60_000 })).res.statusCode, 200);
});

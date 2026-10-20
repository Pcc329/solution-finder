import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fixture } from './fixtures/supabase-read.fixture.mjs';

// Pin the actual main revision containing merged PR #204; no network or SQL is used.
const MAIN_REVISION = 'a64548bf28fc445211834d970ad119903a8b8df0';
const root = new URL('../', import.meta.url);
const authUrl = new URL('../_lib/auth.js', import.meta.url).href;
const apis = ['solutions', 'cases', 'stats', 'companies'];
const originals = {}, current = {};
for (const api of apis) {
  const source = execFileSync('git', ['show', `${MAIN_REVISION}:api/${api}.js`], { cwd: root, encoding: 'utf8' });
  // PR 3 changes only companies' cache policy; all bodies, requests and other headers retain parity.
  const imported = (api === 'companies' ? source.replace("'s-maxage=300'", "'private, no-store'") : source)
    .replace("'../_lib/auth.js'", JSON.stringify(authUrl));
  originals[api] = (await import(`data:text/javascript;base64,${Buffer.from(imported).toString('base64')}`)).default;
  current[api] = (await import(new URL(`../api/${api}.js`, import.meta.url))).default;
}

async function invoke(handler, options = {}) {
  const env = {
    SUPABASE_URL: 'https://synthetic-supabase.invalid', SUPABASE_ANON_KEY: 'synthetic-anon',
    API_KEYS_ALLOWLIST: 'synthetic-auth',
    DB_SOURCE_SOLUTIONS: options.legacyFlag || 'supabase',
    DB_SOURCE_COMPANIES: options.legacyFlag || 'supabase',
    DB_SOURCE_CASES: options.legacyFlag || 'supabase',
  };
  const oldEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const oldFetch = globalThis.fetch, oldDate = globalThis.Date, oldLog = console.log, oldError = console.error, oldWarn = console.warn;
  const requests = [], logs = [];
  class FixedDate extends oldDate {
    constructor(...args) { super(...(args.length ? args : ['2026-10-13T04:00:00Z'])); }
    static now() { return new oldDate('2026-10-13T04:00:00Z').getTime(); }
  }
  try {
    Object.assign(process.env, env);
    if (options.missing) delete process.env[options.missing];
    if (options.legacyFlag === 'unset') {
      for (const key of ['DB_SOURCE_SOLUTIONS', 'DB_SOURCE_COMPANIES', 'DB_SOURCE_CASES']) delete process.env[key];
    }
    globalThis.Date = FixedDate;
    const capture = (...args) => logs.push(args.map(arg => arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg)).join(' '));
    console.log = console.error = console.warn = capture;
    globalThis.fetch = async (input, request = {}) => {
      const url = new URL(input);
      assert.equal(url.origin, env.SUPABASE_URL);
      requests.push({ url: url.href, ...request });
      const table = url.pathname.split('/').at(-1);
      assert.ok(Object.hasOwn(fixture, table), `Unexpected Supabase request ${table}`);
      const failure = options.failure;
      if (failure && (table === failure || failure === 'all'
        || failure === 'optional-data-source' && url.searchParams.get('select') === 'solution_id,data_source')) {
        if (options.networkError) throw new Error('Synthetic network failure');
        return { ok: false, status: 500, text: async () => 'Synthetic upstream failure' };
      }
      let rows = structuredClone(fixture[table]);
      if (table === 'solutions' && options.pageSizeFixture) {
        rows = Array.from({ length: options.pageSizeFixture }, (_, i) => ({ ...rows[0], solution_id: `PAGE-${String(i).padStart(5, '0')}` }));
      }
      if (table === 'companies_with_counts' && options.largeCompanyFixture) {
        rows = Array.from({ length: 205 }, (_, i) => ({ ...rows[0], company_id: String(10000000 + i), company_name: `Synthetic ${i}` }));
      }
      for (const [key, filter] of url.searchParams) {
        if (key === 'or') {
          assert.equal(filter, '(record_status.is.null,record_status.not.like.已下架*)');
          rows = rows.filter(row => !String(row.record_status || '').startsWith('已下架'));
        } else if (key === 'company_status') {
          assert.equal(filter, 'neq.暫停營業');
          rows = rows.filter(row => row.company_status != null && row.company_status !== '暫停營業');
        } else if (key === 'is_real') {
          assert.equal(filter, 'eq.true');
          rows = rows.filter(row => row.is_real === true);
        } else if (key === 'provider_linked_company_id') {
          assert.equal(filter, 'not.is.null');
          rows = rows.filter(row => row.provider_linked_company_id != null);
        }
      }
      const order = url.searchParams.get('order');
      if (order) {
        const [key, direction] = order.split('.');
        rows.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (direction === 'desc' ? -1 : 1));
      }
      if (request.headers?.Range) {
        const [start, end] = request.headers.Range.split('-').map(Number);
        // The existing companies helper expects an empty page; the other helpers accept 416.
        if (start >= rows.length && rows.length && order) return { ok: false, status: 416 };
        rows = rows.slice(start, end + 1);
      }
      const select = url.searchParams.get('select');
      if (select && select !== '*') {
        rows = rows.map(row => Object.fromEntries(select.split(',').map(key => [key, row[key] ?? null])));
      }
      return { ok: true, status: 200, json: async () => rows };
    };
    const res = {
      statusCode: null, headers: {}, body: null,
      setHeader(key, value) { this.headers[key] = value; },
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
    };
    await handler({ method: options.method || 'GET', headers: options.noAuth ? {} : { 'x-api-key': env.API_KEYS_ALLOWLIST },
      cookies: {}, query: options.query || {}, url: '/api/synthetic-test' }, res);
    return { res: { statusCode: res.statusCode, headers: res.headers, body: res.body }, requests, logs };
  } finally {
    globalThis.fetch = oldFetch; globalThis.Date = oldDate;
    console.log = oldLog; console.error = oldError; console.warn = oldWarn;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

async function parity(api, options = {}, candidateOptions = options) {
  const before = await invoke(originals[api], options);
  const after = await invoke(current[api], candidateOptions);
  assert.deepEqual(after.res, before.res);
  assert.equal(JSON.stringify(after.res.body), JSON.stringify(before.res.body), 'JSON field/order parity');
  assert.deepEqual(after.requests, before.requests, 'Query/select/filter/order/pagination/header parity');
  assert.deepEqual(after.logs, before.logs, 'Existing log message parity');
  return after;
}

for (const api of apis) {
  test(`${api}: same fixture produces deep-equal JSON, requests and logs`, async () => {
    const { res } = await parity(api);
    assert.equal(res.statusCode, 200);
    if (api === 'solutions') {
      assert.equal(res.body[0].id, 'rec-solution-01');
      assert.ok(res.body.some(row => row.id === 'S02'));
      assert.equal(res.body.find(row => row.id === 'S02').d, '');
      assert.equal(res.body.some(row => row.id === 'rec-retired'), false);
      assert.equal(res.body[0].pgc, 2);
    } else if (api === 'companies') {
      assert.ok(res.body.some(row => row.id === 'rec-company-01' && row.solution_count === 2));
    } else if (api === 'cases') {
      assert.equal(res.body[0].industry_code, 'C25 金屬製品製造業');
      assert.equal(res.body.some(row => Object.hasOwn(row, 'source_doc')), false);
    } else {
      assert.equal(res.body.total, 5);
      assert.equal(res.body.companyTotal, 3);
      assert.equal(res.body.maintenance.totals.solutions, 3);
    }
  });
  for (const missing of ['SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
    test(`${api}: missing ${missing} preserves 500 response`, async () => {
      const { res, requests } = await parity(api, { missing });
      assert.equal(res.statusCode, 500); assert.equal(requests.length, 0);
    });
  }
  for (const networkError of [false, true]) {
    test(`${api}: ${networkError ? 'network failure' : 'HTTP 500'} preserves error handling`, async () => {
      await parity(api, { failure: 'all', networkError });
    });
  }
  for (const legacyFlag of ['airtable', 'unset', 'invalid-value']) {
    test(`${api}: ignored legacy source flag ${legacyFlag} still reads Supabase`, async () => {
      await parity(api, {}, { legacyFlag });
    });
  }
  test(`${api}: authentication behavior remains unchanged`, async () => { await parity(api, { noAuth: true }); });
}

for (const filter of ['startup', 'award', 'large', 'ai', 'erp', 'sec', 'unknown']) {
  test(`companies: filter=${filter} output remains identical`, async () => { await parity('companies', { query: { filter } }); });
}
test('companies: default 200-item limit remains identical', async () => {
  const { res } = await parity('companies', { largeCompanyFixture: true });
  assert.equal(res.body.length, 200);
});
test('cases: non-GET still returns 405', async () => { await parity('cases', { method: 'POST' }); });
test('cases: industry-code lookup failure retains raw codes', async () => {
  const { res } = await parity('cases', { failure: 'industry_codes' });
  assert.equal(res.body[0].industry_code, 'C25');
});
test('stats: maintenance failure remains null without failing other statistics', async () => {
  const { res } = await parity('stats', { failure: 'maintenance_activity' });
  assert.equal(res.statusCode, 200); assert.equal(res.body.maintenance, null);
});
test('solutions: optional data_source failure remains graceful', async () => {
  const { res } = await parity('solutions', { failure: 'optional-data-source' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.every(row => row.src === ''));
});
for (const api of ['solutions', 'stats', 'companies']) {
  test(`${api}: multi-page requests remain identical`, async () => { await parity(api, { pageSizeFixture: 1001 }); });
}
for (const api of ['solutions', 'stats']) {
  test(`${api}: exact-page 416 handling remains identical`, async () => { await parity(api, { pageSizeFixture: 1000 }); });
}

test('four read APIs and public assets contain no live Airtable/source-switch references', () => {
  const forbidden = /api\.airtable\.com|AIRTABLE_TOKEN|DB_SOURCE_|fetchAirtableWithRetry/;
  const inspect = url => {
    for (const item of readdirSync(url, { withFileTypes: true })) {
      const child = new URL(item.name + (item.isDirectory() ? '/' : ''), url);
      if (item.isDirectory()) inspect(child);
      else assert.doesNotMatch(readFileSync(child, 'utf8'), forbidden, child.pathname);
    }
  };
  for (const api of apis) assert.doesNotMatch(readFileSync(new URL(`../api/${api}.js`, import.meta.url), 'utf8'), forbidden);
  inspect(new URL('../public/', import.meta.url));
});

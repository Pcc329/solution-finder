import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/solutions.js';

const allowed = ['臺灣雲市集', '雲市集工業館', '新創嚴選網', '商業服務業專區', '農業雲市集-數位館', '新北產業AI化輔導計畫'];
const excluded = ['SME AI平台', '政府軟體採購網', '資策會產業調查', '案例反推補建'];
const rainforestSource = '智慧雨林擴散案（廠商官網）';
const activeFilter = '(record_status.is.null,record_status.not.like.已下架*)';

async function loadSolutions(programs, { source = 'supabase' } = {}) {
  const rows = programs.map((entry, index) => ({
    solution_id: `TEST-${String(index + 1).padStart(4, '0')}`,
    company_id: '12345678',
    solution_name: `Synthetic solution ${index + 1}`,
    description_short: 'Synthetic summary',
    score_overall: 4,
    ...(typeof entry === 'string' ? { program_type: entry } : entry),
  }));
  const env = {
    DB_SOURCE_SOLUTIONS: source,
    SUPABASE_URL: 'https://synthetic-supabase.invalid',
    SUPABASE_ANON_KEY: 'synthetic-anon',
    API_KEYS_ALLOWLIST: 'synthetic-auth',
  };
  const originalEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const requests = [];
  try {
    Object.assign(process.env, env);
    console.log = () => {};
    globalThis.fetch = async (input, options) => {
      const url = new URL(input);
      requests.push({ url, options });
      const table = url.pathname.split('/').at(-1);
      const activeRows = rows.filter(row => !String(row.record_status || '').startsWith('已下架'));
      assert.equal(url.origin, env.SUPABASE_URL);
      assert.equal(options.headers.apikey, env.SUPABASE_ANON_KEY);
      assert.equal(options.headers.Range, '0-999');
      assert.ok(url.searchParams.has('order'));
      let data = [];
      if (table === 'solutions') {
        // Model PostgREST filtering and assert the existing query remains unchanged.
        assert.equal(url.searchParams.get('or'), activeFilter);
        data = url.searchParams.get('select') === 'solution_id,data_source'
          ? activeRows.map(row => ({ solution_id: row.solution_id, data_source: 'Synthetic data source' }))
          : activeRows;
      } else if (table === 'companies') {
        data = [{ company_id: '12345678', company_name: 'Synthetic company' }];
      } else {
        assert.ok(['gov_registrations', 'company_cdm_categories', 'cases', 'awards', 'solution_images'].includes(table));
      }
      return { ok: true, status: 200, json: async () => data };
    };
    const req = { method: 'GET', headers: { 'x-api-key': env.API_KEYS_ALLOWLIST }, cookies: {} };
    const res = {
      statusCode: null, body: null,
      setHeader() {},
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
    };
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    // 既有 7 個請求，加上各一次狀態與圖片選用查詢。
    const statusRequests = requests.filter(r => r.url.pathname.endsWith('/solutions')
      && r.url.searchParams.get('select') === 'solution_id,record_status');
    assert.equal(statusRequests.length, 1);
    const imageRequests = requests.filter(r => r.url.pathname === '/rest/v1/solution_images');
    assert.equal(imageRequests.length, 1);
    assert.equal(requests.length - statusRequests.length - imageRequests.length, 7);
    assert.ok(requests.every(request => !request.options.method || request.options.method === 'GET'));
    return res.body;
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function assertPrograms(rows, expected) {
  assert.ok(rows.length);
  for (const row of rows) {
    assert.equal(row.pgc, expected.length);
    assert.deepEqual(row.pgList, expected);
    assert.equal(row.pgc, row.pgList.length);
  }
}

test('cloud marketplace plus III survey counts only one evidenced program', async () => {
  assertPrograms(await loadSolutions(['臺灣雲市集', '資策會產業調查']), ['臺灣雲市集']);
});

test('government platform listings and procurement qualification do not add programs', async () => {
  assertPrograms(await loadSolutions(['臺灣雲市集', 'SME AI平台', '政府軟體採購網']), ['臺灣雲市集']);
});

test('two evidenced programs survive while SME platform is excluded', async () => {
  assertPrograms(await loadSolutions(['臺灣雲市集', '新創嚴選網', 'SME AI平台']), ['臺灣雲市集', '新創嚴選網']);
});

test('all six allowed names count; all four excluded names and future names do not', async () => {
  assertPrograms(await loadSolutions([...allowed, ...excluded, '測試新來源']), allowed);
});

test('only excluded or unknown sources return zero and an empty detail list', async () => {
  assertPrograms(await loadSolutions([...excluded, '測試新來源']), []);
});

test('deduplicates trimmed names without normalizing 台 to 臺', async () => {
  const rows = await loadSolutions([' 臺灣雲市集 ', '臺灣雲市集', '台灣雲市集', '新創嚴選網']);
  assertPrograms(rows, ['臺灣雲市集', '新創嚴選網']);
  assert.deepEqual(rows.map(row => row.p), [' 臺灣雲市集 ', '臺灣雲市集', '台灣雲市集', '新創嚴選網']);
});

test('existing query excludes confirmed retired prefixes but retains suspected retirement and NULL', async () => {
  const rows = await loadSolutions([
    { program_type: '臺灣雲市集', record_status: null },
    { program_type: '新創嚴選網', record_status: '疑似已下架' },
    { program_type: '商業服務業專區', record_status: '已下架' },
    { program_type: '農業雲市集-數位館', record_status: '已下架_資料異常' },
  ]);
  assertPrograms(rows, ['臺灣雲市集', '新創嚴選網']);
  assert.equal(rows.length, 2);
});

test('unlinked companies and empty sources cannot contribute to another company', async () => {
  const rows = await loadSolutions([
    { program_type: '臺灣雲市集', company_id: '12345678' },
    { program_type: '新創嚴選網', company_id: '87654321' },
    { program_type: '商業服務業專區', company_id: '' },
    { program_type: '', company_id: '12345678' },
    { program_type: null, company_id: '12345678' },
    { program_type: '  ', company_id: '12345678' },
  ]);
  assertPrograms(rows.filter(row => row.cid === '12345678'), ['臺灣雲市集']);
  assertPrograms(rows.filter(row => row.cid === '87654321'), ['新創嚴選網']);
  assertPrograms(rows.filter(row => row.cid === ''), []);
});

test('p labels and solution rows remain present even when sources do not count', async () => {
  const sources = [...allowed, ...excluded, '測試新來源'];
  const rows = await loadSolutions(sources);
  assert.equal(rows.length, sources.length);
  assert.deepEqual(rows.map(row => row.p), sources);
  assert.ok(rows.every(row => row.src === 'Synthetic data source'));
});

test('legacy Airtable source flag is ignored; the same Supabase program evidence is returned', async () => {
  const sources = [...allowed, ...excluded];
  const rows = await loadSolutions(sources, { source: 'airtable' });
  assert.equal(rows.length, sources.length);
  assert.deepEqual(rows.map(row => row.p), sources);
  assertPrograms(rows, allowed);
});


test('agricultural digital hall alone keeps its label and counts once', async () => {
  const sources = [' 農業雲市集-數位館 ', '農業雲市集-數位館'];
  const rows = await loadSolutions(sources);
  assertPrograms(rows, ['農業雲市集-數位館']);
  assert.deepEqual(rows.map(row => row.p), sources);
});

test('agricultural AI hall alone keeps its label and counts once', async () => {
  const sources = [' 農業雲市集-AI館 ', '農業雲市集-AI館'];
  const rows = await loadSolutions(sources);
  assertPrograms(rows, ['農業雲市集-AI館']);
  assert.deepEqual(rows.map(row => row.p), sources);
});

for (const halls of [
  ['農業雲市集-數位館', '農業雲市集-AI館'],
  ['農業雲市集-AI館', '農業雲市集-數位館'],
]) {
  test(`both agricultural halls count once with digital input first: ${halls[0] === '農業雲市集-數位館'}`, async () => {
    const rows = await loadSolutions(halls);
    assertPrograms(rows, ['農業雲市集']);
    assert.deepEqual(rows.map(row => row.p), halls);
  });

  test(`agricultural group retains its first position with digital input first: ${halls[0] === '農業雲市集-數位館'}`, async () => {
    const rows = await loadSolutions([halls[0], '臺灣雲市集', halls[1], halls[0]]);
    assertPrograms(rows, ['農業雲市集', '臺灣雲市集']);
  });

  test(`agricultural group follows an earlier program with digital input first: ${halls[0] === '農業雲市集-數位館'}`, async () => {
    const rows = await loadSolutions(['臺灣雲市集', halls[0], halls[1]]);
    assertPrograms(rows, ['臺灣雲市集', '農業雲市集']);
  });
}

test('AI hall does not allow excluded, unknown or display-only source names', async () => {
  const sources = ['臺灣雲市集', '農業雲市集-AI館', ...excluded,
    '測試新來源', '農業雲市集', '農業雲市集-AI館-測試新來源'];
  const rows = await loadSolutions(sources);
  assertPrograms(rows, ['臺灣雲市集', '農業雲市集-AI館']);
  assert.deepEqual(rows.map(row => row.p), sources);
});

test('all eight allowed source names form exactly seven ordered program groups', async () => {
  const sources = ['臺灣雲市集', '雲市集工業館', '新創嚴選網', '商業服務業專區',
    '農業雲市集-數位館', '農業雲市集-AI館', '新北產業AI化輔導計畫', rainforestSource];
  assertPrograms(await loadSolutions([...sources, ...excluded, '測試新來源']),
    ['臺灣雲市集', '雲市集工業館', '新創嚴選網', '商業服務業專區', '農業雲市集', '新北產業AI化輔導計畫', rainforestSource]);
});

test('rainforest keeps its exact source label and counts one evidenced program per company', async () => {
  const rows = await loadSolutions([rainforestSource, rainforestSource, '智慧雨林擴散案', '資策會產業調查']);
  assertPrograms(rows, [rainforestSource]);
  assert.deepEqual(rows.slice(0, 2).map(row => row.p), [rainforestSource, rainforestSource]);
});

test('agricultural hall grouping stays within each linked company', async () => {
  const rows = await loadSolutions([
    { program_type: '農業雲市集-數位館', company_id: '12345678' },
    { program_type: '農業雲市集-AI館', company_id: '87654321' },
    { program_type: '農業雲市集-AI館', company_id: '' },
  ]);
  assertPrograms(rows.filter(row => row.cid === '12345678'), ['農業雲市集-數位館']);
  assertPrograms(rows.filter(row => row.cid === '87654321'), ['農業雲市集-AI館']);
  assertPrograms(rows.filter(row => row.cid === ''), []);
});

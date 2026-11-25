import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import ask from '../api/ask.js';
import claude from '../api/claude.js';
import feedback from '../api/feedback.js';

const privateMarker = 'synthetic-private-content';
const handlers = { ask, claude, feedback };
const answer = 'Synthetic answer';
const searchResult = { keyword: 'synthetic-search', category: '生產物流' };
const bodies = {
  ask: { question: privateMarker, searchQuery: 'synthetic-search', solutions: [{ s: 'Synthetic solution' }] },
  claude: { query: privateMarker },
  feedback: { name: privateMarker, milestone: '其他回饋', detail: privateMarker },
};
const rows = {
  ask: { question: privateMarker, search_query: 'synthetic-search', result_count: 1, answer_length: answer.length },
  claude: { search_query: privateMarker, log_type: 'ai_search' },
  feedback: { name: privateMarker, department: null, milestone: '其他回饋', detail: privateMarker,
    score: null, relevant_count: null, path_choice: null, would_cite: null },
};
const tables = { ask: 'ask_logs', claude: 'search_logs', feedback: 'feedback_submissions' };
let ipCounter = 0;

async function invoke(api, mode = 'success', options = {}) {
  const env = {
    SUPABASE_URL: 'https://synthetic-supabase.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
    SUPABASE_ANON_KEY: 'synthetic-anon-must-not-be-used',
    ANTHROPIC_API_KEY: 'synthetic-anthropic',
    CLAUDE_API_KEY: 'synthetic-claude',
    API_KEYS_ALLOWLIST: 'synthetic-auth', LOG_HASH_SALT: 'synthetic-log-salt',
  };
  const oldEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const calls = [];
  const logs = [];
  try {
    Object.assign(process.env, env);
    if (mode === 'missing-url') delete process.env.SUPABASE_URL;
    if (mode === 'missing-key') delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.error = (...args) => logs.push(args.join(' '));
    globalThis.fetch = async (url, request) => {
      const endpoint = String(url);
      calls.push({ endpoint, ...request, row: JSON.parse(request.body) });
      if (endpoint === 'https://api.anthropic.com/v1/messages') {
        return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: api === 'ask' ? answer : JSON.stringify(searchResult) }] }) };
      }
      if (endpoint.endsWith('/rest/v1/usage_logs')) return { ok: true, status: 201 };
      assert.equal(endpoint, `${env.SUPABASE_URL}/rest/v1/${tables[api]}`);
      if (mode === 'network-error') throw new Error(privateMarker);
      if (mode === 'success') {
        return { ok: true, status: 201, json: async () => { throw new Error('Do not parse return=minimal'); } };
      }
      const status = mode === '500' ? 500 : mode === '429' ? 429 : 400;
      return {
        ok: false, status,
        json: async () => {
          if (mode === 'invalid-json') throw new SyntaxError(privateMarker);
          return { code: mode === 'unsafe-code' ? `23514 ${privateMarker}` : '23514',
            message: privateMarker, details: privateMarker, hint: privateMarker };
        },
      };
    };
    const req = {
      method: options.method || 'POST',
      body: options.body ?? bodies[api],
      headers: { ...(options.auth === false ? {} : { 'x-api-key': env.API_KEYS_ALLOWLIST }),
        'x-forwarded-for': options.ip || `synthetic-ip-${++ipCounter}` },
      cookies: {},
    };
    const res = {
      statusCode: undefined, body: undefined,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
      end() { return this; },
    };
    await handlers[api](req, res);
    return { res, calls, logs, ip: req.headers['x-forwarded-for'] };
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

for (const api of Object.keys(handlers)) {
  for (const mode of ['success', '400', '500', '429', 'network-error', 'invalid-json', 'unsafe-code', 'missing-url', 'missing-key']) {
    test(`${api}: ${mode} preserves response and safe single-write behavior`, async () => {
      const { res, calls, logs, ip } = await invoke(api, mode);
      const missingConfig = mode.startsWith('missing-');
      const storageCalls = calls.filter(call => call.endpoint.endsWith(`/rest/v1/${tables[api]}`));
      const usageCalls = calls.filter(call => call.endpoint.endsWith('/rest/v1/usage_logs'));
      assert.equal(usageCalls.length, missingConfig || api === 'feedback' ? 0 : 1);
      if (usageCalls.length) {
        assert.deepEqual(usageCalls[0].row, { user_id: null, auth_method: 'api_key',
          action: api === 'ask' ? 'ai_ask' : 'ai_search', detail: { endpoint: api, ok: true, status: 200 }, ip_hash: createHmac('sha256', 'synthetic-log-salt').update(ip).digest('hex') });
        assert.deepEqual(calls.map(call => call.endpoint), ['https://api.anthropic.com/v1/messages', 'https://synthetic-supabase.invalid/rest/v1/usage_logs', `https://synthetic-supabase.invalid/rest/v1/${tables[api]}`]);
      }
      assert.equal(storageCalls.length, missingConfig ? 0 : 1);
      assert.equal(calls.filter(call => call.endpoint.includes('/rest/v1/')).length, storageCalls.length + usageCalls.length);
      assert.equal(calls.some(call => call.endpoint.includes('airtable')), false);
      if (storageCalls.length) {
        const call = storageCalls[0];
        assert.equal(call.method, 'POST');
        assert.deepEqual(call.headers, { apikey: 'synthetic-service-role', Authorization: 'Bearer synthetic-service-role',
          'Content-Type': 'application/json', Prefer: 'return=minimal' });
        assert.deepEqual(call.row, rows[api]);
        for (const field of ['id', 'created_at', 'source']) assert.equal(Object.hasOwn(call.row, field), false);
      }
      if (api === 'feedback' && mode !== 'success') {
        assert.equal(res.statusCode, missingConfig ? 500 : 502);
        assert.deepEqual(res.body, { error: missingConfig
          ? 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' : 'Storage write failed' });
      } else {
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, api === 'ask' ? { answer } : api === 'claude' ? searchResult : { ok: true });
      }
      assert.equal(calls.filter(call => call.endpoint.includes('anthropic')).length, api === 'feedback' ? 0 : 1);
      const usageErrors = logs.filter(log => log.includes('table=usage_logs '));
      assert.equal(usageErrors.length, api !== 'feedback' && missingConfig ? 1 : 0);
      const businessLogs = logs.filter(log => !log.includes('table=usage_logs '));
      assert.equal(businessLogs.length, mode === 'success' || (api === 'feedback' && missingConfig) ? 0 : 1);
      for (const log of logs) {
        const status = missingConfig || mode === 'network-error' ? 'unknown' : mode === '500' ? '500' : mode === '429' ? '429' : '400';
        const code = missingConfig || ['network-error', 'invalid-json', 'unsafe-code'].includes(mode) ? 'unknown' : '23514';
        assert.match(log, new RegExp(`^\\[Supabase Error\\] status=${status} table=${log.includes('table=usage_logs ') ? 'usage_logs' : tables[api]} code=${code} time=\\d{4}-\\d{2}-\\d{2}T.+Z$`));
        assert.equal(log.includes(privateMarker), false);
        for (const field of ['message=', 'details=', 'hint=', 'endpoint=', 'synthetic-service-role']) assert.equal(log.includes(field), false);
      }
    });
  }

  test(`${api}: requireAuth still blocks unauthenticated requests`, async () => {
    const { res, calls } = await invoke(api, 'success', { auth: false });
    assert.equal(res.statusCode, 401);
    assert.equal(calls.length, 0);
  });
}

test('feedback: validated optional fields including zero remain intact', async () => {
  const body = { ...bodies.feedback, department: ' synthetic-department ', score: 1, relevant_count: 0,
    path_choice: 'AI 搜尋', would_cite: '不會' };
  const { res, calls } = await invoke('feedback', 'success', { body });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls[0].row, { ...rows.feedback, department: 'synthetic-department', score: 1, relevant_count: 0,
    path_choice: 'AI 搜尋', would_cite: '不會' });
});

const invalidFeedback = [
  { name: '' }, { name: 'x'.repeat(51) }, { department: 'x'.repeat(51) },
  { milestone: '' }, { milestone: 'x'.repeat(51) }, { milestone: 'not-allowed' },
  { detail: '' }, { detail: 'x'.repeat(2001) },
  { score: 0 }, { score: 6 }, { score: 1.5 },
  { relevant_count: -1 }, { relevant_count: 6 },
  { path_choice: 'not-allowed' }, { path_choice: 'x'.repeat(21) },
  { would_cite: 'not-allowed' }, { would_cite: 'x'.repeat(11) },
];
for (const patch of invalidFeedback) {
  test(`feedback: rejects ${JSON.stringify(patch).slice(0, 90)} before writing`, async () => {
    const { res, calls } = await invoke('feedback', 'success', { body: { ...bodies.feedback, ...patch } });
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
}

test('feedback: malformed JSON still returns 400', async () => {
  const { res, calls } = await invoke('feedback', 'success', { body: '{' });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'JSON 格式錯誤' });
  assert.equal(calls.length, 0);
});

test('feedback: same-IP fourth request is rate limited; another IP is allowed', async () => {
  const ip = `rate-limit-test-${++ipCounter}`;
  for (let i = 0; i < 3; i += 1) assert.equal((await invoke('feedback', 'success', { ip })).res.statusCode, 200);
  const { res, calls } = await invoke('feedback', 'success', { ip });
  assert.equal(res.statusCode, 429);
  assert.equal(calls.length, 0);
  assert.equal((await invoke('feedback')).res.statusCode, 200);
});

for (const api of ['ask', 'claude']) {
  test(`${api}: OPTIONS stays available without auth`, async () => {
    const { res, calls } = await invoke(api, 'success', { method: 'OPTIONS', auth: false });
    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 0);
  });
}

test('ask: absent search query remains an empty string in storage', async () => {
  const { res, calls } = await invoke('ask', 'success', { body: { ...bodies.ask, searchQuery: '' } });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.find(call => call.endpoint.endsWith('/rest/v1/ask_logs')).row.search_query, '');
});

test('migration is byte-for-byte identical to the supplied SQL', () => {
  const bytes = readFileSync(new URL('../migrations/20261012_create_airtable_replacement_tables.sql', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'a8961212bab2f91a37cd071cb65d863f065ea3154561999c8ced017e71ba3003');
});

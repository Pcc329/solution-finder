import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import handler from '../api/company-detail.js';
import { createSessionValue } from '../_lib/auth.js';

// All inputs are synthetic. Compare the entire payload with the actual main baseline.
const source = execFileSync('git', ['show', '4d47b89:api/company-detail.js'], {
  cwd: new URL('../', import.meta.url), encoding: 'utf8',
}).replace("'../_lib/auth.js'", JSON.stringify(new URL('../_lib/auth.js', import.meta.url).href));
const baseline = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
const fixtures = {
  companies: [{ company_id: 'synthetic-company', company_name: 'Synthetic company', capital: 100 }],
  contacts: [{ contact_name: 'Synthetic contact', title: 'Synthetic title',
    office_phone: null, email: 'synthetic@example.invalid', mobile: 'synthetic-mobile' },
  { email: 'nan', mobile: '09' + '12' + '0'.repeat(6), office_phone: '1234' + '0'.repeat(6) }],
  awards: [{ award_name: 'Synthetic award', match_method: 'EXACT' }],
};
let ipCounter = 0;

async function invoke(options = {}) {
  const env = {
    SUPABASE_URL: 'https://synthetic-supabase.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
    SESSION_SECRET: 'synthetic-session-secret', API_KEYS_ALLOWLIST: 'synthetic-api-key',
    LOG_HASH_SALT: options.salt ?? 'synthetic-log-salt',
  };
  const savedEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch, originalError = console.error;
  const calls = [], logs = [];
  const ip = options.ip ?? `synthetic-ip-${++ipCounter}`;
  const session = createSessionValue(Date.now() + 60_000, env.SESSION_SECRET);
  const auth = options.auth ?? 'session';
  const req = {
    method: options.method ?? 'GET', query: { company_id: options.companyId ?? 'synthetic-company' },
    headers: { ...(options.socket ? {} : { 'x-forwarded-for': `${ip}, synthetic-proxy` }),
      ...(['api_key', 'both'].includes(auth) ? { 'x-api-key': env.API_KEYS_ALLOWLIST } : {}) },
    socket: { remoteAddress: ip },
    cookies: ['session', 'both'].includes(auth) ? { sf_session: session } : {},
  };
  const res = {
    statusCode: undefined, body: undefined,
    setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) {
      // A successful response must wait until the single POST has settled.
      if (this.statusCode === 200 && !options.baseline) assert.equal(postSettled, true);
      this.body = body; return this;
    },
    end() { return this; },
  };
  let postSettled = false;
  try {
    Object.assign(process.env, env);
    if (options.noSalt) delete process.env.LOG_HASH_SALT;
    if (options.missingConfig) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.error = (...args) => logs.push(args.join(' '));
    globalThis.fetch = async (url, request = {}) => {
      const endpoint = new URL(url);
      assert.equal(endpoint.origin, env.SUPABASE_URL);
      const table = endpoint.pathname.split('/').at(-1);
      const call = { table, ...request };
      calls.push(call);
      if (request.method === 'POST') {
        assert.equal(table, 'contact_access_logs');
        call.row = JSON.parse(request.body);
        await new Promise(resolve => setImmediate(resolve));
        postSettled = true;
        if (options.writeMode === 'throw') throw new Error('synthetic-private-error');
        const failed = ['500', 'missing-table'].includes(options.writeMode);
        return { ok: !failed, status: failed ? 500 : 201,
          json: async () => ({ code: options.writeMode === 'missing-table' ? '42P01' : '23514',
            message: 'synthetic-private-error' }) };
      }
      assert.ok(Object.hasOwn(fixtures, table));
      if (options.readFailure === table) {
        return { ok: false, status: 500, text: async () => 'synthetic-read-error' };
      }
      const data = options.notFound && table === 'companies' ? []
        : table === 'contacts' && options.contacts ? options.contacts : fixtures[table];
      return { ok: true, json: async () => structuredClone(data) };
    };
    await (options.baseline ? baseline : handler)(req, res);
    return { res, calls, writes: calls.filter(call => call.method === 'POST'), logs, ip, session };
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('1. success awaits exactly one service-role POST with complete typed fields from filtered contacts', async () => {
  const { res, writes, logs } = await invoke();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, (await invoke({ baseline: true })).res.body);
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].row).sort(), [
    'company_id', 'contact_count', 'has_email', 'has_mobile', 'auth_method', 'session_hash', 'ip_hash',
  ].sort());
  assert.deepEqual(writes[0].headers, {
    apikey: 'synthetic-service-role', Authorization: 'Bearer synthetic-service-role',
    'Content-Type': 'application/json', Prefer: 'return=minimal',
  });
  const row = writes[0].row;
  assert.equal(row.company_id, 'synthetic-company');
  assert.equal(row.contact_count, res.body.contacts.length);
  assert.equal(row.auth_method, 'session');
  assert.equal(row.has_email, true);
  assert.equal(row.has_mobile, true);
  for (const key of ['session_hash', 'ip_hash']) assert.match(row[key], /^[a-f0-9]{64}$/);
  assert.deepEqual(logs, []);
  for (const contacts of [[fixtures.contacts[1]], [], [{ email: null, mobile: null }]]) {
    const filtered = await invoke({ contacts });
    assert.equal(filtered.writes[0].row.contact_count, contacts.length);
    assert.equal(filtered.writes[0].row.has_email, false);
    assert.equal(filtered.writes[0].row.has_mobile, false);
  }
});

test('2. POST body and logs never contain raw IP, session, email or mobile', async () => {
  const { writes, logs, ip, session } = await invoke();
  const serialized = writes[0].body + logs.join('\n');
  for (const raw of [ip, session, fixtures.contacts[0].email, fixtures.contacts[0].mobile]) {
    assert.equal(serialized.includes(raw), false);
  }
  const expected = crypto.createHmac('sha256', 'synthetic-log-salt').update(session).digest('hex');
  assert.equal(writes[0].row.session_hash === expected, true);
});

test('3. HMAC uses the first forwarded IP or socket fallback and changes with salt', async () => {
  const ip = `synthetic-stable-ip-${++ipCounter}`;
  const first = (await invoke({ ip })).writes[0].row.ip_hash;
  const same = (await invoke({ ip })).writes[0].row.ip_hash;
  const different = (await invoke({ ip, salt: 'synthetic-other-salt' })).writes[0].row.ip_hash;
  const socket = (await invoke({ ip, socket: true })).writes[0].row.ip_hash;
  const expected = crypto.createHmac('sha256', 'synthetic-log-salt').update(ip).digest('hex');
  assert.equal(first === expected, true);
  assert.equal(first === same, true);
  assert.equal(first !== different, true);
  assert.equal(first === socket, true);
});

test('4. missing or empty salt writes null hashes, emits one safe error and preserves 200 payload', async () => {
  for (const options of [{ noSalt: true }, { salt: '' }]) {
    const { res, writes, logs } = await invoke(options);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, (await invoke({ baseline: true })).res.body);
    assert.equal(writes[0].row.ip_hash, null);
    assert.equal(writes[0].row.session_hash, null);
    assert.deepEqual(logs, ['[Contact Access Log Error] code=missing_hash_salt']);
  }
});

test('5. POST 500, missing table or network failure preserves the entire baseline response', async () => {
  const expected = (await invoke({ baseline: true })).res.body;
  for (const writeMode of ['500', 'missing-table', 'throw']) {
    const { res, writes, logs, ip, session } = await invoke({ writeMode });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, expected);
    assert.equal(writes.length, 1);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /^\[Supabase Error\] status=(500|unknown) table=contact_access_logs code=(23514|42P01|unknown) time=\S+Z$/);
    for (const raw of [ip, session, 'synthetic-private-error', fixtures.contacts[0].email,
      fixtures.contacts[0].mobile, 'synthetic-service-role']) assert.equal(logs[0].includes(raw), false);
  }
});

test('6. non-200 responses never POST; the thirty-first request retains the existing rate limit', async () => {
  for (const [options, expected] of [
    [{ notFound: true }, 404], [{ auth: 'none' }, 401], [{ companyId: '' }, 400],
    [{ missingConfig: true }, 500], [{ readFailure: 'companies' }, 500],
    [{ readFailure: 'contacts' }, 500], [{ readFailure: 'awards' }, 500],
    [{ method: 'OPTIONS', auth: 'none' }, 204], [{ method: 'POST' }, 405],
  ]) {
    const { res, writes } = await invoke(options);
    assert.equal(res.statusCode, expected);
    assert.equal(writes.length, 0);
  }
  const ip = `synthetic-rate-limit-${++ipCounter}`;
  for (let i = 0; i < 30; i += 1) assert.equal((await invoke({ ip, notFound: true })).res.statusCode, 404);
  const limited = await invoke({ ip });
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.calls.length, 0);
});

test('7. API-key authentication has no session hash; a valid session takes precedence when both exist', async () => {
  const { res, writes } = await invoke({ auth: 'api_key' });
  assert.equal(res.statusCode, 200);
  assert.equal(writes[0].row.auth_method, 'api_key');
  assert.equal(writes[0].row.session_hash, null);
  assert.match(writes[0].row.ip_hash, /^[a-f0-9]{64}$/);
  const both = await invoke({ auth: 'both' });
  assert.equal(both.writes[0].row.auth_method, 'session');
  assert.match(both.writes[0].row.session_hash, /^[a-f0-9]{64}$/);
});

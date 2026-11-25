import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import authApi from '../api/auth.js';
import { createSessionValue, createUserSessionValue, verifySession, requireAuth,
  resetAuthCacheForTests } from '../_lib/auth.js';
import { passwordPolicyError } from '../_lib/password-policy.js';
import { recordUsage } from '../_lib/usage.js';
import claude from '../api/claude.js';
import ask from '../api/ask.js';
import analyze from '../api/manufacturing-analyze.js';
import recommend from '../api/manufacturing-recommend.js';
import companyDetail from '../api/company-detail.js';

const id = '11111111-2222-4333-8444-555555555555';
const otherId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const secret = 'synthetic-session-secret';
const token = 'synthetic-access-token-private';
const privateMarker = 'synthetic-query-never-in-usage';
const unavailable = { error: '登入服務暫時無法使用，請稍後再試' };
const originalFetch = globalThis.fetch, originalNow = Date.now, originalError = console.error;
let ctx, counter = 0;
function response(status = 200, data = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(data), text: async () => 'synthetic-upstream-error' };
}
function res() {
  return { code: null, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; },
    json(value) { this.body = value; this.eventsAtResponse = [...ctx.events]; return this; },
    end() { return this; } };
}
function cookie() { return createUserSessionValue(ctx.now + 7 * 86400_000, id, secret); }
function req(options = {}) {
  return { method: 'POST', query: {}, body: {}, headers: { 'x-forwarded-for': `${ctx.ip}, proxy` },
    socket: { remoteAddress: ctx.ip }, cookies: { sf_session: cookie() }, ...options };
}
async function action(name, body = {}, options = {}) {
  const result = res();
  await authApi(req({ query: { action: name }, body, ...options }), result);
  return result;
}
async function authenticate(options = {}, authOptions = {}) {
  const result = res();
  const identity = await requireAuth(req(options), result, authOptions);
  return { result, identity };
}
const grantCalls = () => ctx.calls.filter(call => call.url.pathname === '/auth/v1/token');
const roleCalls = () => ctx.calls.filter(call => call.url.pathname.endsWith('/user_roles') && call.method !== 'PATCH');
beforeEach(() => {
  counter += 1;
  ctx = { now: 1_900_000_000_000, ip: `synthetic-ip-${counter}`, email: `person${counter}@iii.org.tw`,
    role: { email: `person${counter}@iii.org.tw`, role: 'user', is_active: true, must_change_password: false },
    roleStatus: 200, grantStatus: 200, updateStatus: 200, patchStatus: 204, usageStatus: 201,
    aiStatus: 200, calls: [], events: [], logs: [] };
  Object.assign(process.env, { SESSION_SECRET: secret, SUPABASE_URL: 'https://synthetic-supabase.invalid',
    SUPABASE_ANON_KEY: 'synthetic-anon', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
    API_KEYS_ALLOWLIST: 'synthetic-key', SHARED_PASSWORD_ENABLED: '', SITE_PASSWORD: 'synthetic-shared',
    LOG_HASH_SALT: 'synthetic-salt', ANTHROPIC_API_KEY: 'synthetic-ai', CLAUDE_API_KEY: 'synthetic-ai' });
  resetAuthCacheForTests();
  Date.now = () => ctx.now;
  console.error = (...args) => ctx.logs.push(args.join(' '));
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    assert.ok(['https://synthetic-supabase.invalid', 'https://api.anthropic.com'].includes(url.origin), 'all traffic must be mocked');
    const call = { url, ...options, row: options.body ? JSON.parse(options.body) : null };
    ctx.calls.push(call);
    if (url.pathname === '/auth/v1/token') {
      if (ctx.grantThrow) throw new Error('synthetic-secret-error');
      return response(ctx.grantStatus, { user: { id: ctx.grantId ?? id }, access_token: token, refresh_token: 'synthetic-refresh-private' });
    }
    if (url.pathname === '/auth/v1/user') {
      if (ctx.updateThrow) throw new Error('synthetic-secret-error');
      return response(ctx.updateStatus);
    }
    if (url.pathname === '/rest/v1/user_roles') {
      assert.equal(options.headers.apikey, 'synthetic-service');
      assert.equal(options.headers.Authorization, 'Bearer synthetic-service');
      assert.equal(url.searchParams.get('user_id'), `eq.${id}`);
      if (options.method === 'PATCH') {
        if (ctx.patchThrow) throw new Error('synthetic-secret-error');
        if (ctx.patchStatus < 300) ctx.role.must_change_password = false;
        return response(ctx.patchStatus);
      }
      assert.equal(url.searchParams.get('select'), 'email,role,is_active,must_change_password');
      assert.equal(url.searchParams.get('limit'), '1');
      if (ctx.roleThrow) throw new Error('synthetic-secret-error');
      return response(ctx.roleStatus, ctx.noRole ? [] : [ctx.role]);
    }
    if (url.pathname === '/v1/messages') {
      if (ctx.aiThrow) throw new Error('synthetic-ai-error');
      return response(ctx.aiStatus, { content: [{ type: 'text', text: ctx.aiText ?? '{}' }] });
    }
    if (url.pathname === '/rest/v1/usage_logs') {
      await new Promise(resolve => setImmediate(resolve));
      ctx.events.push('usage-settled');
      if (ctx.usageThrow) throw new Error('synthetic-write-error');
      return response(ctx.usageStatus);
    }
    if (url.pathname.endsWith('/search_logs') || url.pathname.endsWith('/ask_logs') || url.pathname.endsWith('/contact_access_logs')) return response(201);
    if (url.pathname.endsWith('/companies')) return response(200, [{ company_id: 'synthetic-company', company_name: 'Synthetic' }]);
    if (url.pathname.endsWith('/contacts')) return response(200, [{ email: 'synthetic-private@example.invalid', mobile: 'synthetic-private-mobile' }]);
    if (url.pathname.endsWith('/awards')) return response(200, []);
    assert.fail(`unexpected mocked path ${url.pathname}`);
  };
});
afterEach(() => { globalThis.fetch = originalFetch; Date.now = originalNow; console.error = originalError; });

test('v2 signs exactly the version, expiry and UUID; v1 wire format stays identical', () => {
  const expiry = ctx.now + 60_000;
  const payload = `v2.${expiry}.${id}`;
  assert.equal(createUserSessionValue(expiry, id, secret), `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`);
  assert.equal(verifySession(req()), true);
  assert.equal(createSessionValue(expiry, secret), `${expiry}.${crypto.createHmac('sha256', secret).update(String(expiry)).digest('hex')}`);
  assert.throws(() => createUserSessionValue(expiry, 'not-a-uuid', secret), /UUID/);
});
for (const mode of ['user-tamper', 'signature-tamper', 'expired', 'non-uuid', 'extra', 'missing-secret', 'missing-cookie']) {
  test(`v2 rejects ${mode} before looking up roles`, async () => {
    let value = cookie();
    if (mode === 'user-tamper') value = value.replace(id, otherId);
    if (mode === 'signature-tamper') value = value.slice(0, -1) + (value.endsWith('a') ? 'b' : 'a');
    if (mode === 'expired') value = createUserSessionValue(ctx.now, id, secret);
    if (mode === 'non-uuid') {
      const payload = `v2.${ctx.now + 60_000}.invalid`;
      value = `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
    }
    if (mode === 'extra') value += '.extra';
    if (mode === 'missing-secret') delete process.env.SESSION_SECRET;
    const request = req({ cookies: mode === 'missing-cookie' ? {} : { sf_session: value } });
    assert.equal(verifySession(request), false);
    const result = res();
    assert.equal(await requireAuth(request, result), null);
    assert.equal(result.code, 401); assert.equal(ctx.calls.length, 0);
  });
}
test('active v2 returns user identity; status cache refreshes at 60 seconds', async () => {
  assert.deepEqual((await authenticate()).identity, { method: 'user', userId: id, email: ctx.email, role: 'user' });
  await authenticate(); ctx.now += 59_999; await authenticate();
  assert.equal(roleCalls().length, 1);
  ctx.now += 1001; await authenticate(); assert.equal(roleCalls().length, 2);
});
test('suspension remains cached inside TTL and is denied after expiry with cookie cleared', async () => {
  assert.ok((await authenticate()).identity);
  ctx.role.is_active = false; ctx.now += 59_999;
  assert.ok((await authenticate()).identity);
  ctx.now += 1001;
  const { identity, result } = await authenticate();
  assert.equal(identity, null); assert.equal(result.code, 401);
  assert.match(result.headers['Set-Cookie'], /Max-Age=0/);
});
for (const mode of ['inactive', 'missing']) test(`role ${mode} denies and clears session`, async () => {
  ctx.role.is_active = mode !== 'inactive'; ctx.noRole = mode === 'missing';
  const { result, identity } = await authenticate();
  assert.equal(identity, null); assert.equal(result.code, 401); assert.match(result.headers['Set-Cookie'], /Max-Age=0/);
});
for (const mode of ['non-2xx', 'throw', 'missing-url', 'missing-key', 'malformed']) test(`role lookup ${mode} fails closed and is never cached`, async () => {
  if (mode === 'non-2xx') ctx.roleStatus = 500;
  if (mode === 'throw') ctx.roleThrow = true;
  if (mode === 'missing-url') delete process.env.SUPABASE_URL;
  if (mode === 'missing-key') delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (mode === 'malformed') ctx.role.is_active = 'true';
  for (let i = 0; i < 2; i++) {
    const { result, identity } = await authenticate();
    assert.equal(identity, null); assert.equal(result.code, 503);
    assert.deepEqual(result.body, { error: '登入驗證服務暫時無法使用，請稍後再試' });
  }
  assert.equal(roleCalls().length, mode.startsWith('missing-') ? 0 : 2);
  Object.assign(process.env, { SUPABASE_URL: 'https://synthetic-supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service' });
  ctx.roleStatus = 200; ctx.roleThrow = false; ctx.role.is_active = true;
  assert.ok((await authenticate()).identity);
});
test('expired cached status is not served after failed revalidation', async () => {
  await authenticate(); ctx.now += 61_000; ctx.roleStatus = 500;
  assert.equal((await authenticate()).result.code, 503);
  ctx.roleStatus = 200; ctx.role.is_active = false;
  assert.equal((await authenticate()).result.code, 401);
});
test('must-change-password blocks business API and is allowed explicitly for auth actions', async () => {
  ctx.role.must_change_password = true;
  const denied = await authenticate(); assert.equal(denied.result.code, 403);
  assert.deepEqual(denied.result.body, { error: '請先變更密碼', code: 'must_change_password' });
  assert.equal((await authenticate({}, { allowMustChange: true })).identity.mustChangePassword, true);
});
for (const flag of [undefined, '', 'TRUE', '1', 'false', 'true']) test(`shared v1 switch is strict: ${JSON.stringify(flag)}`, async () => {
  if (flag === undefined) delete process.env.SHARED_PASSWORD_ENABLED; else process.env.SHARED_PASSWORD_ENABLED = flag;
  const { result, identity } = await authenticate({ cookies: { sf_session: createSessionValue(ctx.now + 60_000, secret) } });
  if (flag === 'true') assert.deepEqual(identity, { method: 'shared' });
  else { assert.equal(identity, null); assert.equal(result.code, 401); }
  assert.equal(ctx.calls.length, 0);
});
test('allowlisted API key bypasses role database even when unavailable', async () => {
  delete process.env.SUPABASE_URL;
  assert.deepEqual((await authenticate({ cookies: {}, headers: { 'x-api-key': 'synthetic-key' } })).identity, { method: 'api_key' });
  assert.equal(ctx.calls.length, 0);
});
test('login normalizes email, issues a 7-day v2 cookie, and exposes no Supabase tokens', async () => {
  ctx.role.must_change_password = true;
  const result = await action('login', { email: `  ${ctx.email.toUpperCase()} `, password: 'synthetic-temp' });
  assert.equal(result.code, 200); assert.deepEqual(result.body, { ok: true, must_change_password: true });
  assert.match(result.headers['Set-Cookie'], /^sf_session=v2\.\d+\.[a-f0-9-]+\.[a-f0-9]{64}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=604800$/);
  assert.deepEqual(grantCalls()[0].row, { email: ctx.email, password: 'synthetic-temp' });
  assert.equal(grantCalls()[0].headers.apikey, 'synthetic-anon');
  assert.equal(grantCalls()[0].url.searchParams.get('grant_type'), 'password');
  assert.doesNotMatch(JSON.stringify(result), /synthetic-access-token-private|synthetic-refresh-private/);
});
test('login keeps nonexistent and incorrect-password errors indistinguishable', async () => {
  ctx.grantStatus = 400;
  const result = await action('login', { email: ctx.email, password: 'wrong' });
  const unknown = await action('login', { email: 'unknown@iii.org.tw', password: 'wrong' });
  assert.equal(result.code, 401); assert.deepEqual(result.body, { error: '帳號或密碼錯誤' });
  assert.deepEqual(unknown.body, result.body); assert.equal(unknown.code, result.code);
});
for (const mode of ['inactive', 'missing']) test(`login denies ${mode} account`, async () => {
  ctx.role.is_active = mode !== 'inactive'; ctx.noRole = mode === 'missing';
  const result = await action('login', { email: ctx.email, password: 'temporary' });
  assert.equal(result.code, 403); assert.deepEqual(result.body, { error: '帳號未啟用，請洽系統管理者' });
  assert.equal(result.headers['Set-Cookie'], undefined);
});
test('login refreshes cached inactive status after account reactivation', async () => {
  ctx.role.is_active = false; await authenticate(); ctx.role.is_active = true;
  assert.equal((await action('login', { email: ctx.email, password: 'temporary' })).code, 200);
  assert.equal(roleCalls().length, 2);
});
test('login IP request 21 is limited; method check precedes limiter; 60-second window expires', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await action('login')).code, 400);
  assert.equal((await action('login')).code, 429);
  assert.equal((await action('login', {}, { method: 'GET' })).code, 405);
  ctx.now += 60_000; assert.equal((await action('login')).code, 400);
  assert.equal(ctx.calls.length, 0);
});
for (const name of ['login', 'change-password']) {
  for (const status of [429, 500, 503]) test(`${name}: six Supabase ${status} grants return 503 without account lock`, async () => {
    ctx.grantStatus = status;
    const body = name === 'login' ? { email: ctx.email, password: 'temporary' } : { current_password: 'temporary', new_password: 'Secure!8392' };
    for (let i = 0; i < 6; i++) {
      const result = await action(name, body); assert.equal(result.code, 503); assert.deepEqual(result.body, unavailable);
    }
    assert.equal(grantCalls().length, 6);
    ctx.grantStatus = 200;
    assert.equal((await action(name, body)).code, 200);
    assert.equal(grantCalls().length, 7);
  });
  for (const status of [400, 401, 403]) test(`${name}: five credential failures (${status}) lock account; sixth avoids Supabase; unlocks after 15 minutes`, async () => {
    ctx.grantStatus = status;
    const body = name === 'login' ? { email: ctx.email, password: 'wrong' } : { current_password: 'wrong', new_password: 'Secure!8392' };
    for (let i = 0; i < 5; i++) assert.equal((await action(name, body)).code, 401);
    const callsBefore = ctx.calls.length;
    assert.equal((await action(name, body)).code, 429);
    assert.equal(ctx.calls.length, callsBefore); assert.equal(grantCalls().length, 5);
    ctx.now += 15 * 60_000; ctx.grantStatus = 200;
    assert.equal((await action(name, body)).code, 200);
  });
  test(`${name}: grant network failure gives 503 without leaking upstream error`, async () => {
    ctx.grantThrow = true;
    const result = await action(name, name === 'login' ? { email: ctx.email, password: 'temporary' } : { current_password: 'temporary', new_password: 'Secure!8392' });
    assert.equal(result.code, 503); assert.deepEqual(result.body, unavailable); assert.deepEqual(ctx.logs, []);
  });
}
test('successful login clears accumulated account failures', async () => {
  const body = { email: ctx.email, password: 'temporary' };
  ctx.grantStatus = 400; for (let i = 0; i < 4; i++) await action('login', body);
  ctx.grantStatus = 200; assert.equal((await action('login', body)).code, 200);
  ctx.grantStatus = 400; for (let i = 0; i < 5; i++) assert.equal((await action('login', body)).code, 401);
  assert.equal((await action('login', body)).code, 429);
});
test('change-password IP limiter is separate from login; socket fallback works', async () => {
  const options = { headers: {}, cookies: {} };
  for (let i = 0; i < 20; i++) assert.equal((await action('login', {}, options)).code, 400);
  for (let i = 0; i < 20; i++) assert.equal((await action('change-password', {}, options)).code, 401);
  assert.equal((await action('change-password', {}, options)).code, 429);
  ctx.now += 60_000; assert.equal((await action('change-password', {}, options)).code, 401);
});
test('login account failures do not lock the separate change-password account counter', async () => {
  ctx.grantStatus = 400;
  for (let i = 0; i < 5; i++) await action('login', { email: ctx.email, password: 'wrong' });
  ctx.grantStatus = 200;
  assert.equal((await action('change-password', { current_password: 'temporary', new_password: 'Secure!8392' })).code, 200);
});
test('shared login requires exact enabled switch; personal login validates email before fetch', async () => {
  assert.equal((await action('login', { password: 'synthetic-shared' })).code, 400);
  assert.equal((await action('login', { email: 'invalid', password: 'temporary' })).code, 400);
  process.env.SHARED_PASSWORD_ENABLED = 'true';
  const result = await action('login', { password: 'synthetic-shared' });
  assert.equal(result.code, 200); assert.deepEqual(result.body, { ok: true });
  assert.match(result.headers['Set-Cookie'], /^sf_session=\d+\.[a-f0-9]{64};/);
  assert.equal((await action('login', { password: 'wrong' })).code, 401);
  assert.equal(ctx.calls.length, 0);
});
for (const mode of ['shared', 'api_key', 'none']) test(`change-password rejects ${mode} credentials`, async () => {
  process.env.SHARED_PASSWORD_ENABLED = 'true';
  const options = { cookies: mode === 'shared' ? { sf_session: createSessionValue(ctx.now + 60_000, secret) } : {},
    headers: mode === 'api_key' ? { 'x-api-key': 'synthetic-key' } : {} };
  assert.equal((await action('change-password', {}, options)).code, 401); assert.equal(ctx.calls.length, 0);
});
const policyCases = [
  ['seven characters', 'abc!123', /8/], ['over 72 bytes', '中'.repeat(25), /72/],
  ['same password', 'temporary', /目前密碼/], ['account name ignoring case', 'XXPERSONYY', /帳號名稱/],
  ['blacklist ignoring case', 'PaSsWoRd1', /常見密碼/],
];
for (const [label, value, error] of policyCases) test(`change-password rejects ${label} before password grant`, async () => {
  ctx.role.email = 'person@iii.org.tw';
  const result = await action('change-password', { current_password: 'temporary', new_password: value });
  assert.equal(result.code, 400); assert.match(result.body.error, error); assert.equal(grantCalls().length, 0);
});
test('password length uses Unicode code points and accepts eight Chinese characters', async () => {
  assert.match(passwordPolicyError('old', '😀'.repeat(7), ctx.email), /8/);
  assert.equal(passwordPolicyError('old', '😀'.repeat(8), ctx.email), null);
  assert.equal(passwordPolicyError('old', 'abcdefgX', 'ab@iii.org.tw'), null);
  const result = await action('change-password', { current_password: 'temporary', new_password: '春夏秋冬日月星辰' });
  assert.equal(result.code, 200);
});
for (const password of ['12345678','123456789','1234567890','87654321','11111111','00000000','password','password1','passw0rd','qwertyui','qwerty123','abcd1234','1qaz2wsx','iloveyou','a1234567','aa123456','iii12345','iii@1234','solution','solution1','sf123456','admin123','welcome1','taiwan123']) {
  test(`required common-password blacklist: ${password}`, () => assert.match(passwordPolicyError('different', password.toUpperCase(), 'otherperson@iii.org.tw'), /常見密碼/));
}
test('password change grants, updates with ephemeral Bearer, clears flag and invalidates cache without replacing session', async () => {
  ctx.role.must_change_password = true; await authenticate({}, { allowMustChange: true });
  const result = await action('change-password', { current_password: 'temporary', new_password: 'Secure!8392' });
  assert.equal(result.code, 200); assert.deepEqual(result.body, { ok: true });
  assert.deepEqual(ctx.calls.map(call => [call.method ?? 'GET', call.url.pathname]), [
    ['GET', '/rest/v1/user_roles'], ['POST', '/auth/v1/token'], ['PUT', '/auth/v1/user'], ['PATCH', '/rest/v1/user_roles'],
  ]);
  assert.equal(ctx.calls[2].headers.Authorization, `Bearer ${token}`);
  assert.deepEqual(ctx.calls[2].row, { password: 'Secure!8392' });
  assert.deepEqual(ctx.calls[3].row, { must_change_password: false });
  assert.equal(result.headers['Set-Cookie'], undefined);
  assert.equal((await authenticate()).identity.method, 'user'); assert.equal(roleCalls().length, 2);
  assert.doesNotMatch(JSON.stringify(result) + ctx.logs.join(''), /synthetic-access-token-private|synthetic-refresh-private/);
});
for (const step of ['put-status', 'put-throw', 'patch-status', 'patch-throw']) test(`password ${step} failure is a safe 502 and preserves must-change restriction`, async () => {
  ctx.role.must_change_password = true;
  if (step === 'put-status') ctx.updateStatus = 400;
  if (step === 'put-throw') ctx.updateThrow = true;
  if (step === 'patch-status') ctx.patchStatus = 500;
  if (step === 'patch-throw') ctx.patchThrow = true;
  const result = await action('change-password', { current_password: 'temporary', new_password: 'Secure!8392' });
  assert.equal(result.code, 502); assert.doesNotMatch(JSON.stringify(result.body), /synthetic/);
  assert.equal((await authenticate()).result.code, 403);
});
test('password change rejects password grant for a different user', async () => {
  ctx.grantId = otherId;
  assert.equal((await action('change-password', { current_password: 'temporary', new_password: 'Secure!8392' })).code, 401);
  assert.equal(ctx.calls.some(call => call.method === 'PUT'), false);
});
test('session-check provides user-only identity and allows must-change-password', async () => {
  ctx.role.must_change_password = true;
  const result = await action('session-check', {}, { method: 'GET' });
  assert.equal(result.code, 200); assert.deepEqual(result.body, { authenticated: true, method: 'user', email: ctx.email, role: 'user', must_change_password: true });
});
test('session-check distinguishes unauthorized from unavailable; logout still expires cookie', async () => {
  const options = { method: 'GET', cookies: {} };
  assert.deepEqual((await action('session-check', {}, options)).body, { authenticated: false, shared_login_enabled: false });
  process.env.SHARED_PASSWORD_ENABLED = 'true';
  assert.deepEqual((await action('session-check', {}, options)).body, { authenticated: false, shared_login_enabled: true });
  const key = await action('session-check', {}, { method: 'GET', cookies: {}, headers: { 'x-api-key': 'synthetic-key' } });
  assert.deepEqual(key.body, { authenticated: true, method: 'api_key' });
  ctx.roleStatus = 500;
  assert.equal((await action('session-check', {}, { method: 'GET' })).code, 503);
  const logout = await action('logout'); assert.equal(logout.code, 200); assert.match(logout.headers['Set-Cookie'], /Max-Age=0/);
});

const endpointCases = [
  ['claude', claude, 'ai_search', { query: privateMarker }],
  ['ask', ask, 'ai_ask', { question: privateMarker, solutions: [{ s: 'synthetic-solution' }] }],
  ['manufacturing-analyze', analyze, 'ai_manufacturing', { fileBase64: 'c3ludGhldGlj', mediaType: 'application/pdf', fileName: 'synthetic.pdf' }],
  ['manufacturing-recommend', recommend, 'ai_manufacturing', { solutions: [{ s: privateMarker }] }],
  ['company-detail', companyDetail, 'contact_view', {}],
];
async function invokeEndpoint(name, handler, body, method = 'user') {
  const result = res();
  const request = req({ method: name === 'company-detail' ? 'GET' : 'POST', body, query: { company_id: 'synthetic-company' } });
  if (method === 'api_key') { request.cookies = {}; request.headers['x-api-key'] = 'synthetic-key'; }
  if (method === 'shared') { process.env.SHARED_PASSWORD_ENABLED = 'true'; request.cookies.sf_session = createSessionValue(ctx.now + 60_000, secret); }
  await handler(request, result);
  return result;
}
const usageCalls = () => ctx.calls.filter(call => call.url.pathname === '/rest/v1/usage_logs');
for (const [name, handler, usageAction, body] of endpointCases) {
  for (const method of ['user', 'api_key', 'shared']) test(`${name}: one ${method} usage row with correct identity and no content`, async () => {
    const result = await invokeEndpoint(name, handler, body, method);
    assert.equal(result.code, 200); assert.equal(usageCalls().length, 1);
    assert.ok(result.eventsAtResponse.includes('usage-settled'), 'await usage before response');
    const row = usageCalls()[0].row;
    assert.equal(row.action, usageAction); assert.equal(row.auth_method, method); assert.equal(row.user_id, method === 'user' ? id : null);
    assert.deepEqual(Object.keys(row).sort(), ['user_id','auth_method','action','detail','ip_hash'].sort());
    assert.equal(row.ip_hash, crypto.createHmac('sha256', 'synthetic-salt').update(ctx.ip).digest('hex'));
    assert.deepEqual(row.detail, name === 'company-detail' ? { company_id: 'synthetic-company' } : { endpoint: name, ok: true, status: 200 });
    for (const forbidden of [privateMarker, 'synthetic-private@example.invalid', 'synthetic-private-mobile', token, cookie()]) assert.equal(usageCalls()[0].body.includes(forbidden), false);
    if (name === 'company-detail') {
      const contact = ctx.calls.find(call => call.url.pathname.endsWith('/contact_access_logs')).row;
      assert.equal(contact.auth_method, method === 'api_key' ? 'api_key' : 'session');
      assert.equal(contact.user_id, method === 'user' ? id : null);
    }
  });
  test(`${name}: usage storage rejection and throw both preserve complete endpoint response`, async () => {
    const expected = await invokeEndpoint(name, handler, body);
    for (const mode of ['status', 'throw']) {
      ctx.calls = []; ctx.usageStatus = mode === 'status' ? 500 : 201; ctx.usageThrow = mode === 'throw';
      const result = await invokeEndpoint(name, handler, body);
      assert.equal(result.code, expected.code); assert.deepEqual(result.body, expected.body); assert.equal(usageCalls().length, 1);
    }
  });
  if (name !== 'company-detail') {
    test(`${name}: non-2xx Anthropic response still meters exactly once`, async () => {
      ctx.aiStatus = 429;
      const result = await invokeEndpoint(name, handler, body);
      assert.equal(result.code, name === 'ask' ? 500 : 429);
      assert.equal(usageCalls().length, 1); assert.deepEqual(usageCalls()[0].row.detail, { endpoint: name, ok: false, status: 429 });
    });
    test(`${name}: Anthropic network exception does not meter`, async () => {
      ctx.aiThrow = true; assert.equal((await invokeEndpoint(name, handler, body)).code, 500); assert.equal(usageCalls().length, 0);
    });
  }
}
test('recordUsage strips non-allowlisted keys and non-primitive values; hash fallback is unchanged', async () => {
  const request = req({ headers: {} });
  await recordUsage(request, { method: 'api_key' }, 'ai_search', { endpoint: 'claude', ok: true, status: 200,
    company_id: { query: privateMarker }, query: privateMarker, cookie: cookie(), token });
  assert.deepEqual(usageCalls()[0].row.detail, { endpoint: 'claude', ok: true, status: 200 });
  delete process.env.LOG_HASH_SALT;
  await recordUsage(request, { method: 'shared' }, 'contact_view');
  assert.equal(usageCalls()[1].row.ip_hash, null);
  await assert.doesNotReject(() => recordUsage(request, null, 'ai_search'));
});

test('static guard: every requireAuth call awaits; business 10, auth actions 2, total 12', () => {
  const root = new URL('../', import.meta.url);
  const files = [];
  function scan(dir) {
    for (const entry of readdirSync(new URL(dir, root), { withFileTypes: true })) {
      const path = `${dir}${entry.name}`;
      if (entry.isDirectory()) scan(`${path}/`); else if (path.endsWith('.js') && path !== '_lib/auth.js') files.push(path);
    }
  }
  scan('api/'); scan('_lib/');
  const calls = [], errors = [];
  for (const file of files) {
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const match of source.matchAll(/\brequireAuth\s*\(/g)) {
      const line = source.slice(0, match.index).split('\n').length;
      calls.push({ file, line });
      if (!/\bawait\s+$/.test(source.slice(0, match.index))) errors.push(`${file}:${line}`);
    }
  }
  assert.deepEqual(errors, [], `Missing await: ${errors.join(', ')}`);
  assert.equal(calls.filter(call => call.file !== 'api/auth.js').length, 10);
  assert.equal(calls.filter(call => call.file === 'api/auth.js').length, 2);
  assert.equal(calls.length, 12);
});
test('restricted sources match main 2675eb5 exactly after only explicitly permitted edits', () => {
  const root = new URL('../', import.meta.url);
  for (const name of ['solutions', 'claude', 'ask']) {
    const path = `api/${name}.js`;
    let expected = execFileSync('git', ['show', `2675eb5:${path}`], { cwd: root, encoding: 'utf8' });
    expected = expected.replace('if (!requireAuth(req, res)) return;', name === 'solutions' ? 'if (!(await requireAuth(req, res))) return;' : 'const auth = await requireAuth(req, res); if (!auth) return;');
    if (name !== 'solutions') {
      expected = expected.replace("import { requireAuth } from '../_lib/auth.js';", "import { requireAuth } from '../_lib/auth.js';\nimport { recordUsage } from '../_lib/usage.js';")
        .replace('    if (!response.ok) {', `    await recordUsage(req, auth, '${name === 'claude' ? 'ai_search' : 'ai_ask'}', { endpoint: '${name}', ok: response.ok, status: response.status });\n    if (!response.ok) {`);
    }
    assert.equal(readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n'), expected.replace(/\r\n/g, '\n'), path);
  }
  const configBefore = JSON.parse(execFileSync('git', ['show', '2675eb5:vercel.json'], { cwd: root, encoding: 'utf8' }));
  const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
  const added = config.rewrites.filter(item => item.source === '/api/change-password');
  assert.deepEqual(added, [{ source: '/api/change-password', destination: '/api/auth?action=change-password' }]);
  config.rewrites = config.rewrites.filter(item => item.source !== '/api/change-password');
  assert.deepEqual(config, configBefore);
  assert.equal(readdirSync(new URL('api/', root)).filter(file => file.endsWith('.js')).length, 12);
});

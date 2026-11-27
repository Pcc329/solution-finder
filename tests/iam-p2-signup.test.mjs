import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import authApi from '../api/auth.js';
import { getUserRole, requireAuth, createUserSessionValue, resetAuthCacheForTests } from '../_lib/auth.js';

const id = '11111111-2222-4333-8444-555555555555';
const password = 'SyntheT!9438';
const service = 'synthetic-signup-service-private';
const upstream = 'synthetic-upstream-original-private';
const email = 'applicant@iii.org.tw';
const approved = '2026-11-25T06:54:39Z';
const unavailable = { error: '申請服務暫時無法使用，請稍後再試' };
const pending = { error: '帳號申請審核中，核准後即可登入', code: 'pending_approval' };
const originalFetch = globalThis.fetch, originalNow = Date.now, originalError = console.error;
let ctx, serial = 0;
function reply(status, data = {}) { return { status, data }; }
function response(value) {
  if (value instanceof Error) throw value;
  return { ok: value.status >= 200 && value.status < 300, status: value.status,
    json: async () => { if (value.badJson) throw new Error(upstream); return structuredClone(value.data); } };
}
function result() {
  return { code: null, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; ctx.results.push(this); return this; }, end() { return this; } };
}
function request(action = 'signup', body = { name: ' 測試申請人 ', email, password }, options = {}) {
  return { method: 'POST', query: { action }, body, headers: { 'x-forwarded-for': ` ${ctx.ip} , proxy` }, ...options };
}
async function invoke(action = 'signup', body, options) {
  const res = result(); await authApi(request(action, body, options), res);
  if (action === 'signup') assert.equal(res.headers['Set-Cookie'], undefined);
  return res;
}
const inserts = () => ctx.calls.filter(call => call.url.pathname === '/rest/v1/user_roles' && call.method === 'POST');
const deletes = () => ctx.calls.filter(call => call.method === 'DELETE');
beforeEach(() => {
  ctx = { now: 1_900_000_000_000, ip: `synthetic-signup-ip-${++serial}`, calls: [], logs: [], results: [],
    admin: reply(201, { id }), insert: reply(201), remove: reply(204),
    role: { email, role: 'user', is_active: true, must_change_password: false, signup_source: 'super', approved_at: approved } };
  Object.assign(process.env, { SUPABASE_URL: 'https://synthetic-signup.invalid', SUPABASE_SERVICE_ROLE_KEY: service,
    SUPABASE_ANON_KEY: 'synthetic-anon', SESSION_SECRET: 'synthetic-secret', SHARED_PASSWORD_ENABLED: '', API_KEYS_ALLOWLIST: '' });
  resetAuthCacheForTests(); Date.now = () => ctx.now;
  console.error = (...args) => ctx.logs.push(args.join(' '));
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://synthetic-signup.invalid');
    const call = { url, ...options, body: options.body ? JSON.parse(options.body) : null };
    ctx.calls.push(call);
    if (url.pathname === '/auth/v1/admin/users') return response(ctx.admin);
    if (url.pathname === `/auth/v1/admin/users/${id}` && options.method === 'DELETE') return response(ctx.remove);
    if (url.pathname === '/auth/v1/token') return response(reply(200, { user: { id }, access_token: 'synthetic-access' }));
    if (url.pathname === '/rest/v1/user_roles') {
      if (options.method === 'POST') return response(ctx.insert);
      assert.equal(url.searchParams.get('select'), 'email,role,is_active,must_change_password,signup_source,approved_at');
      return response(reply(200, ctx.role ? [ctx.role] : []));
    }
    assert.fail(`unexpected mocked path ${url.pathname}`);
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch; Date.now = originalNow; console.error = originalError;
  const output = JSON.stringify({ results: ctx.results.map(res => ({ body: res.body, headers: res.headers })), logs: ctx.logs });
  for (const value of [password, service, upstream]) assert.equal(output.includes(value), false, 'no private upstream data in output');
  assert.equal(ctx.calls.some(call => call.url.pathname.includes('usage_logs')), false);
});

test('signup creates confirmed auth user then exact pending role with service role, no session or usage', async () => {
  const res = await invoke(); assert.equal(res.code, 201); assert.deepEqual(res.body, { ok: true, pending: true });
  assert.deepEqual(ctx.calls.map(call => [call.method, call.url.pathname]), [['POST', '/auth/v1/admin/users'], ['POST', '/rest/v1/user_roles']]);
  assert.deepEqual(ctx.calls[0].body, { email, password, email_confirm: true });
  assert.deepEqual(ctx.calls[1].body, { user_id: id, email, role: 'user', signup_source: 'self', is_active: false,
    must_change_password: false, note: '自行申請；申請人填寫姓名：測試申請人' });
  for (const call of ctx.calls) {
    assert.equal(call.headers.apikey, service); assert.equal(call.headers.Authorization, `Bearer ${service}`);
    assert.equal(call.headers['Content-Type'], 'application/json');
  }
  assert.equal(ctx.calls[1].headers.Prefer, 'return=minimal'); assert.deepEqual(ctx.logs, []);
});
for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) test(`signup rejects ${method} without fetch`, async () => {
  assert.equal((await invoke('signup', undefined, { method })).code, 405); assert.equal(ctx.calls.length, 0);
});
const invalidCases = [
  ['blank name', { name: '  ' }, /姓名/], ['non-string name', { name: 123 }, /姓名/],
  ['51 code points', { name: '😀'.repeat(51) }, /姓名/], ['missing name', { name: undefined }, /姓名/],
  ['invalid email', { email: 'bad-email' }, /有效的 email/], ['non-string email', { email: 42 }, /有效的 email/],
  ['gmail domain', { email: 'applicant@gmail.com' }, /^請使用院內 email（@iii.org.tw 或 @isd4.biz）$/],
  ['suffix spoof', { email: 'applicant@iii.org.tw.invalid' }, /請使用院內 email/],
  ['subdomain', { email: 'applicant@sub.iii.org.tw' }, /請使用院內 email/],
  ['seven characters', { password: 'Az!3456' }, /8 個字元/], ['non-string password', { password: 12345678 }, /8 個字元/],
  ['blacklist', { password: 'password' }, /常見密碼/], ['account in password', { password: 'APPlicant!934' }, /帳號名稱/],
  ['over 72 bytes', { password: '密'.repeat(25) }, /72 bytes/],
];
for (const [label, overrides, message] of invalidCases) test(`signup validation: ${label} returns 400 without fetch`, async () => {
  const res = await invoke('signup', { name: '測試', email, password, ...overrides });
  assert.equal(res.code, 400); assert.match(res.body.error, message); assert.equal(ctx.calls.length, 0);
});
for (const domain of ['iii.org.tw', 'isd4.biz']) test(`signup normalizes uppercase and whitespace for ${domain}`, async () => {
  const res = await invoke('signup', { name: '😀'.repeat(50), email: `  APPLICANT@${domain.toUpperCase()} `, password: '密'.repeat(24) });
  assert.equal(res.code, 201); assert.equal(ctx.calls[0].body.email, `applicant@${domain}`);
  assert.equal(inserts()[0].body.note, `自行申請；申請人填寫姓名：${'😀'.repeat(50)}`);
});
test('signup sixth request blocked through 59:59.999, recovers at exactly 60 minutes', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await invoke()).code, 201);
  ctx.now += 3_599_999;
  const blocked = await invoke(); assert.equal(blocked.code, 429); assert.deepEqual(blocked.body, { error: '申請次數過多，請稍後再試' });
  assert.equal(ctx.calls.length, 10); ctx.now++;
  assert.equal((await invoke()).code, 201); assert.equal(ctx.calls.length, 12);
});
test('invalid signup counts; signup, login and change-password IP limits are independent', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await invoke('signup', {})).code, 400);
  for (let i = 0; i < 20; i++) assert.equal((await invoke('login', { email: 'bad-email' })).code, 400);
  assert.equal((await invoke('login', { email: 'bad-email' })).code, 429);
  assert.equal((await invoke('signup', {})).code, 429);
  assert.equal((await invoke('change-password', {}, { cookies: {} })).code, 401); assert.equal(ctx.calls.length, 0);
  ctx.ip += '-other'; assert.equal((await invoke('signup', {})).code, 400);
});
test('signup IP extraction shares trimmed first forwarded address and socket fallback with login', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await invoke('signup', {}, { headers: {}, socket: { remoteAddress: ctx.ip } })).code, 400);
  assert.equal((await invoke()).code, 429); assert.equal(ctx.calls.length, 0);
});
for (const code of ['email_exists', 'user_already_exists']) for (const field of ['code', 'error_code']) {
  test(`signup duplicate ${field}=${code} returns 409 without role insert`, async () => {
    ctx.admin = reply(422, { [field]: code, message: upstream, password, key: service });
    const res = await invoke(); assert.equal(res.code, 409);
    assert.deepEqual(res.body, { error: '此 email 已申請或已有帳號，請洽系統管理者' }); assert.equal(ctx.calls.length, 1);
  });
}
test('signup duplicate code is recognized independently of HTTP 422', async () => {
  ctx.admin = reply(400, { code: 'email_exists', message: upstream });
  assert.equal((await invoke()).code, 409); assert.equal(inserts().length, 0);
});
for (const code of ['weak_password', 'validation_failed', 'unrecognized']) test(`signup other 422 ${code} returns safe 400 without role insert`, async () => {
  ctx.admin = reply(422, { code, message: upstream }); const res = await invoke();
  assert.equal(res.code, 400); assert.deepEqual(res.body, { error: '申請資料不符合要求，請確認 email 與密碼' });
  assert.equal(ctx.calls.length, 1); assert.equal(inserts().length, 0);
});
for (const mode of ['500', '503', '429', '400', 'network', 'invalid-uuid', 'missing-id', 'null-json', 'invalid-json', 'missing-url', 'missing-key']) {
  test(`signup admin ${mode} returns safe 503 without role insert`, async () => {
    if (/^\d+$/.test(mode)) ctx.admin = reply(Number(mode), { message: upstream });
    if (mode === 'network') ctx.admin = new Error(upstream);
    if (mode === 'invalid-uuid') ctx.admin = reply(201, { id: 'invalid-id' });
    if (mode === 'missing-id') ctx.admin = reply(201, {});
    if (mode === 'null-json') ctx.admin = reply(201, null);
    if (mode === 'invalid-json') ctx.admin = { status: 201, badJson: true };
    if (mode === 'missing-url') delete process.env.SUPABASE_URL;
    if (mode === 'missing-key') delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await invoke(); assert.equal(res.code, 503); assert.deepEqual(res.body, unavailable);
    assert.equal(inserts().length, 0); assert.equal(deletes().length, 0); assert.deepEqual(ctx.logs, []);
    if (mode.startsWith('missing-') && mode !== 'missing-id') assert.equal(ctx.calls.length, 0);
  });
}
for (const mode of ['500', 'network', 'invalid-json', 'unrelated-constraint']) test(`role insert ${mode} compensates with exactly one service role DELETE`, async () => {
  ctx.insert = mode === 'network' ? new Error(upstream) : mode === 'invalid-json' ? { status: 500, badJson: true }
    : reply(500, { code: '23514', message: upstream });
  const res = await invoke(); assert.equal(res.code, 503); assert.deepEqual(res.body, unavailable);
  assert.deepEqual(ctx.calls.map(call => call.method), ['POST', 'POST', 'DELETE']); assert.equal(deletes().length, 1);
  const cleanup = deletes()[0]; assert.equal(cleanup.url.pathname, `/auth/v1/admin/users/${id}`);
  assert.equal(cleanup.headers.apikey, service); assert.equal(cleanup.headers.Authorization, `Bearer ${service}`); assert.deepEqual(ctx.logs, []);
});
test('pending queue constraint compensates and returns specific safe error', async () => {
  ctx.insert = reply(400, { code: '23514', message: `待核准申請已達 20 筆 ${upstream}` });
  const res = await invoke(); assert.equal(res.code, 503);
  assert.deepEqual(res.body, { error: '目前待核准的申請已滿，請洽系統管理者' }); assert.equal(deletes().length, 1);
});
for (const mode of ['wrong-code', 'wrong-message']) test(`queue classification requires both code and message: ${mode}`, async () => {
  ctx.insert = reply(400, { code: mode === 'wrong-code' ? 'other' : '23514', message: mode === 'wrong-code' ? '待核准申請已達' : upstream });
  assert.deepEqual((await invoke()).body, unavailable); assert.equal(deletes().length, 1);
});
for (const mode of ['500', 'network']) for (const full of [false, true]) test(`failed cleanup ${mode}, queue-full=${full}: only fixed orphan code is logged`, async () => {
  ctx.insert = reply(400, { code: '23514', message: full ? `待核准申請已達 ${upstream}` : upstream });
  ctx.remove = mode === 'network' ? new Error(`${email} ${id} ${password} ${service} ${upstream}`) : reply(500, { message: upstream });
  const res = await invoke(); assert.equal(res.code, 503); assert.equal(deletes().length, 1);
  assert.deepEqual(res.body, full ? { error: '目前待核准的申請已滿，請洽系統管理者' } : unavailable);
  assert.deepEqual(ctx.logs, ['[Signup Error] code=orphan_auth_user']);
  for (const value of [email, id, password, service, upstream]) assert.equal(ctx.logs[0].includes(value), false);
});
for (const mode of ['pending', 'suspended-self', 'inactive-super', 'missing']) test(`login ${mode} denies without cookie`, async () => {
  ctx.role.is_active = false;
  if (mode === 'pending') Object.assign(ctx.role, { signup_source: 'self', approved_at: null });
  if (mode === 'suspended-self') ctx.role.signup_source = 'self';
  if (mode === 'missing') ctx.role = null;
  const res = await invoke('login', { email, password }); assert.equal(res.code, 403); assert.equal(res.headers['Set-Cookie'], undefined);
  assert.deepEqual(res.body, mode === 'pending' ? pending : { error: '帳號未啟用，請洽系統管理者' });
});
const badRoles = [ ['source unknown', 'signup_source', 'other'], ['source missing', 'signup_source', undefined],
  ['source null', 'signup_source', null], ['approved number', 'approved_at', 0], ['approved missing', 'approved_at', undefined],
  ['approved boolean', 'approved_at', false], ['approved object', 'approved_at', {}] ];
for (const [label, field, value] of badRoles) test(`getUserRole ${label} fails closed with 503 and no cache`, async () => {
  ctx.role[field] = value;
  const req = request('', {}, { cookies: { sf_session: createUserSessionValue(ctx.now + 60_000, id, 'synthetic-secret') } });
  for (let i = 0; i < 2; i++) {
    const res = result(); assert.equal(await requireAuth(req, res), null); assert.equal(res.code, 503);
    assert.deepEqual(res.body, { error: '登入驗證服務暫時無法使用，請稍後再試' });
  }
  assert.equal(ctx.calls.length, 2);
  Object.assign(ctx.role, { signup_source: 'super', approved_at: approved });
  const res = result(); assert.deepEqual(await requireAuth(req, res), { method: 'user', userId: id, email, role: 'user' });
  assert.equal(ctx.calls.length, 3);
});
test('getUserRole exposes new fields while requireAuth identity remains unchanged', async () => {
  const role = await getUserRole(id); assert.equal(role.signupSource, 'super'); assert.equal(role.approvedAt, approved);
  const res = result(); assert.deepEqual(await requireAuth(request('', {}, {
    cookies: { sf_session: createUserSessionValue(ctx.now + 60_000, id, 'synthetic-secret') },
  }), res), { method: 'user', userId: id, email, role: 'user' });
});
test('pending role remains unauthorized under requireAuth and never gets identity fields', async () => {
  Object.assign(ctx.role, { signup_source: 'self', approved_at: null, is_active: false });
  assert.equal((await getUserRole(id)).approvedAt, null);
  const res = result(); assert.equal(await requireAuth(request('', {}, {
    cookies: { sf_session: createUserSessionValue(ctx.now + 60_000, id, 'synthetic-secret') },
  }), res), null); assert.equal(res.code, 401); assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
});

const source = readFileSync(new URL('../public/auth-gate.js', import.meta.url), 'utf8');
const notice = '本系統為院內試行服務。登入後，AI 搜尋與查看公司聯絡資訊的使用紀錄（時間、帳號、功能）將被保存，用於服務改善與成本統計，不作其他用途。';
const description = '請填寫姓名、院內 email（@iii.org.tw 或 @isd4.biz）並自行設定密碼。送出後需由系統管理者核准，核准前無法登入。';
function gateEnvironment(replies) {
  let gate, ready, reloaded = 0;
  const calls = [];
  const document = {
    addEventListener(name, callback) { assert.equal(name, 'DOMContentLoaded'); ready = callback; },
    getElementById() { return gate; }, body: { append(value) { gate = value; } },
    createElement() {
      const nodes = new Map();
      return { innerHTML: '', remove() { gate = null; }, querySelector(selector) {
        let exists;
        if (selector.startsWith('#')) exists = this.innerHTML.includes(`id="${selector.slice(1)}"`);
        else if (selector.startsWith('.')) exists = this.innerHTML.includes(`class="${selector.slice(1)}"`);
        else if (selector === '[role="alert"]') exists = this.innerHTML.includes('role="alert"');
        else if (selector === 'input') {
          const first = this.innerHTML.match(/<input id="([^"]+)"/); return first ? this.querySelector(`#${first[1]}`) : null;
        } else exists = this.innerHTML.includes(`<${selector}`);
        if (!exists) return null;
        if (!nodes.has(selector)) nodes.set(selector, { value: '', disabled: false, textContent: '',
          set innerHTML(_) { assert.fail('errors must never be inserted as HTML'); },
          focus() {}, addEventListener(name, callback) { this[name] = callback; } });
        return nodes.get(selector);
      } };
    },
  };
  vm.runInNewContext(source, { document, window: { location: { reload() { reloaded++; } } },
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options }); assert.ok(replies.length, 'all VM traffic mocked');
      return response(replies.shift());
    } });
  return { calls, start: () => ready(), get gate() { return gate; }, get reloaded() { return reloaded; },
    async click(selector) { await gate.querySelector(selector).click({ preventDefault() {} }); },
    async submit() { await gate.querySelector('form').submit({ preventDefault() {} }); },
    fill() { for (const [selector, value] of [['#sf-auth-name', '測試'], ['#sf-auth-email', email], ['#sf-auth-password', password], ['#sf-auth-confirm-password', password]]) gate.querySelector(selector).value = value; },
  };
}
test('gate personal signup entry opens exact fields, title, description, policy and full notice; back restores personal', async () => {
  const env = gateEnvironment([reply(401, { shared_login_enabled: true })]); await env.start();
  assert.ok(env.gate.innerHTML.includes('還沒有帳號？申請帳號')); await env.click('.sf-auth-signup');
  for (const text of ['內部系統登入', description, notice, '至少 8 個字元，可使用中文；請勿使用常見密碼', '姓名', '院內 email', '確認密碼']) assert.ok(env.gate.innerHTML.includes(text));
  for (const selector of ['#sf-auth-name', '#sf-auth-email', '#sf-auth-password', '#sf-auth-confirm-password']) assert.ok(env.gate.querySelector(selector));
  assert.equal(env.gate.querySelector('.sf-auth-switch'), null); assert.equal(env.gate.querySelector('.sf-auth-signup'), null);
  await env.click('.sf-auth-back'); assert.equal(env.gate.querySelector('#sf-auth-name'), null); assert.ok(env.gate.querySelector('.sf-auth-signup'));
});
for (const trigger of ['login', 'session-check']) test(`gate ${trigger} change-password mode has no signup entry`, async () => {
  const replies = trigger === 'login' ? [reply(401, {}), reply(200, { must_change_password: true })] : [reply(200, { authenticated: true, must_change_password: true })];
  const env = gateEnvironment(replies); await env.start(); if (trigger === 'login') await env.submit();
  assert.ok(env.gate.querySelector('#sf-auth-new-password')); assert.equal(env.gate.querySelector('.sf-auth-signup'), null);
  assert.equal(env.gate.innerHTML.includes('申請帳號'), false);
});
test('gate password mismatch makes no request; 201 shows completion without form or reload; back restores personal', async () => {
  const env = gateEnvironment([reply(401, {}), reply(201, { ok: true, pending: true })]);
  await env.start(); await env.click('.sf-auth-signup'); env.fill(); env.gate.querySelector('#sf-auth-confirm-password').value = 'different';
  await env.submit(); assert.equal(env.calls.length, 1); assert.equal(env.gate.querySelector('[role="alert"]').textContent, '兩次密碼不一致');
  env.gate.querySelector('#sf-auth-confirm-password').value = password; await env.submit();
  assert.equal(env.calls.length, 2); assert.equal(env.calls[1].url, '/api/signup'); assert.equal(env.calls[1].method, 'POST');
  assert.equal(env.calls[1].credentials, 'same-origin'); assert.deepEqual(JSON.parse(env.calls[1].body), { name: '測試', email, password });
  assert.equal(env.reloaded, 0); assert.equal(env.gate.querySelector('form'), null);
  assert.ok(env.gate.innerHTML.includes('申請已送出。請通知系統管理者核准，核准後即可使用此 email 與密碼登入。'));
  assert.ok(env.gate.innerHTML.includes(notice)); await env.click('.sf-auth-back');
  assert.ok(env.gate.querySelector('#sf-auth-email')); assert.equal(env.gate.querySelector('#sf-auth-confirm-password'), null); assert.equal(env.reloaded, 0);
});
for (const status of [400, 409, 429, 503]) test(`gate signup ${status} uses textContent and keeps retry enabled`, async () => {
  const error = `<synthetic-signup-${status}>`;
  const env = gateEnvironment([reply(401, {}), reply(status, { error })]);
  await env.start(); await env.click('.sf-auth-signup'); env.fill(); await env.submit();
  assert.equal(env.gate.querySelector('[role="alert"]').textContent, error); assert.equal(env.gate.innerHTML.includes(error), false);
  assert.equal(env.gate.querySelector('button').disabled, false); assert.equal(env.reloaded, 0);
});
test('gate pending login displays exact server message without reload', async () => {
  const env = gateEnvironment([reply(401, {}), reply(403, pending)]); await env.start(); await env.submit();
  assert.equal(env.gate.querySelector('[role="alert"]').textContent, pending.error); assert.equal(env.reloaded, 0);
});
test('P2.1 protected sources byte-match d9f1529 and config adds exactly one signup rewrite', () => {
  const root = new URL('../', import.meta.url);
  for (const path of ['api/solutions.js', 'api/claude.js', 'api/ask.js', 'api/stats.js']) {
    const baseline = execFileSync('git', ['show', `d9f1529:${path}`], { cwd: root });
    const actual = readFileSync(new URL(path, root)).toString('utf8').replace(/\r\n/g, '\n');
    assert.equal(actual, baseline.toString('utf8'));
  }
  const baseline = JSON.parse(execFileSync('git', ['show', 'd9f1529:vercel.json'], { cwd: root, encoding: 'utf8' }));
  const current = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
  const added = current.rewrites.filter(row => row.source === '/api/signup');
  assert.deepEqual(added, [{ source: '/api/signup', destination: '/api/auth?action=signup' }]);
  current.rewrites = current.rewrites.filter(row => row.source !== '/api/signup'); assert.deepEqual(current, baseline);
});

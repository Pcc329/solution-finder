import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createSessionValue } from '../_lib/auth.js';
import { createHandler, createToken, verifyToken } from '../supabase/functions/dash-data/handler.mjs';
import relay from '../api/platform-overview.js';
import { aiShare, renderProfiles, renderOverlap, renderVendors, safeLink, summarize } from '../public/platform-overview-render.mjs';
import * as rendering from '../public/platform-overview-render.mjs';

// Disposable test inputs only. No production credentials or database exports.
const sevenDays = 7 * 24 * 60 * 60 * 1000;
const now = Date.now();
const secret = randomBytes(32).toString('hex');
const password = randomBytes(24).toString('hex');
const serviceKey = randomBytes(24).toString('hex');
const env = key => ({ DASH_TOKEN_SECRET: secret, DASH_PASSWORD: password,
  SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: serviceKey })[key];
const request = (action, options = {}) => new Request(`https://synthetic.invalid/functions/v1/dash-data/${action}`, options);
const login = (value = password) => request('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: value }) });

test('seven-day HMAC tokens match the existing password gate format', async () => {
  const expiry = now + sevenDays;
  const token = await createToken(expiry, secret);
  assert.equal(token, createSessionValue(expiry, secret));
  assert.equal(await verifyToken(token, secret, now), true);
  assert.equal(await verifyToken(token, secret, expiry), false);
  assert.equal(await verifyToken(token + '.extra', secret, now), false);
  assert.equal(await verifyToken(`${expiry + 1}.${token.split('.')[1]}`, secret, now), false);
  assert.equal(await verifyToken(await createToken(expiry + 1, secret), secret, now), false);
  assert.equal(await verifyToken(token, randomBytes(32).toString('hex'), now), false);
});

test('login rejects malformed payloads and wrong passwords without touching data', async () => {
  const handler = createHandler({ env, now: () => now, fetcher: () => assert.fail('must not query the database') });
  assert.equal((await handler(login('wrong'))).status, 401);
  assert.equal((await handler(request('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await handler(request('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' }))).status, 401);
  assert.equal((await handler(request('login', { method: 'POST', body: 'password=x' }))).status, 415);
  assert.equal((await handler(login('x'.repeat(5000)))).status, 413);
  assert.equal((await handler(request('data', { method: 'POST' }))).status, 405);
  assert.equal((await handler(request('unknown'))).status, 404);
  const response = await handler(login());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(Date.parse(body.expires_at) - now, sevenDays);
  assert.equal(await verifyToken(body.token, secret, now), true);
  assert.equal(JSON.stringify(body).includes(password), false);
});

test('missing, expired and tampered tokens return no data and never query Supabase', async () => {
  const handler = createHandler({ env, now: () => now, fetcher: () => assert.fail('unauthorized database query') });
  const valid = await createToken(now + 1000, secret);
  for (const token of ['', 'invalid', await createToken(now - 1, secret), valid.replace(/.$/, valid.endsWith('0') ? '1' : '0')]) {
    const response = await handler(request('data', { headers: { Authorization: `Bearer ${token}` } }));
    assert.equal(response.status, 401);
    assert.equal('platforms' in await response.json(), false);
  }
});

test('service-role read pagination is complete, retains IDs and reflects updates', async () => {
  let revision = 'before';
  const calls = [];
  const handler = createHandler({ env, now: () => now, fetcher: async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.method ?? 'GET', 'GET');
    assert.equal(options.headers.Authorization, `Bearer ${serviceKey}`);
    assert.equal(options.headers.apikey, serviceKey);
    assert.equal(options.cache, 'no-store');
    const offset = Number(url.searchParams.get('offset'));
    const vendors = url.pathname.endsWith('dash_vendor_platforms');
    const profiles = url.pathname.endsWith('platform_profiles');
    const rows = vendors ? (offset === 0 ? [{ company_id: '00000001' }, { company_id: '00000002' }] : [{ company_id: '00000003' }])
      : profiles ? [{ value: revision }] : [{ platform_key: 'synthetic' }];
    return new Response(JSON.stringify(rows), { headers: { 'content-range': `${offset}-${offset + rows.length - 1}/${vendors ? 3 : 1}` } });
  } });
  const token = await createToken(now + 1000, secret);
  const read = async () => (await handler(request('data', { headers: { Authorization: `Bearer ${token}` } }))).json();
  const first = await read();
  assert.equal(first.vendors.length, 3);
  assert.equal(first.vendors[0].company_id, '00000001');
  assert.equal(first.profiles[0].value, 'before');
  assert.equal(first.generated_at, new Date(now).toISOString());
  revision = 'after';
  assert.equal((await read()).profiles[0].value, 'after');
  assert.equal(calls.some(c => c.url.pathname.endsWith('dash_vendor_platforms') && c.url.searchParams.get('offset') === '2'), true);
});

test('upstream failure fails closed without leaking service credentials or partial data', async () => {
  const handler = createHandler({ env, fetcher: async () => new Response(serviceKey, { status: 500 }) });
  const token = await createToken(Date.now() + 1000, secret);
  const response = await handler(request('data', { headers: { Authorization: `Bearer ${token}` } }));
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.equal(body.includes(serviceKey), false);
  assert.equal(body.includes('profiles'), false);
});

test('AI shares show reviewed pending ranges and handle missing/zero denominators', () => {
  assert.deepEqual(aiShare({ solutions: 20, ai_solutions: 10, ai_pending: 2, ai_label_method: '逐筆複核' }),
    { lower: .5, upper: .6, label: '50.0%–60.0%' });
  assert.equal(aiShare({ solutions: 20, ai_solutions: 10, ai_pending: 2, ai_label_method: '自動標記' }).label, '50.0%');
  assert.equal(aiShare({ solutions: 0, ai_solutions: 0 }).label, '未提供');
  assert.equal(aiShare({ solutions: 20, ai_solutions: null }).label, '未提供');
});

const sample = () => ({ platforms: [{ platform_key: 'sme_ai', platform_name: '測試甲' }, { platform_key: 'moea_cloud', platform_name: '測試乙' }],
  profiles: [], vendors: [{ company_id: '00000001', company_name: '<script>unsafe</script>', city: '測試市', n_platforms: 2, n_ai_solutions: 5, n_solutions: 7, sme_ai: true, moea_cloud: true },
    { company_id: '00000002', company_name: '測試乙', n_platforms: 1, n_ai_solutions: 0, n_solutions: 1, sme_ai: false, moea_cloud: true }], generated_at: new Date(now).toISOString() });

test('real booleans drive heatmap, dot matrix and first-wave selection', () => {
  const data = sample();
  assert.deepEqual(summarize(data.vendors), { total: 2, cross: 1, crossShare: '50.0%', wave: 1, ai: 1 });
  assert.match(renderOverlap(data), />2<\/td>/);
  const vendors = renderVendors(data, { waveOnly: true });
  assert.equal(vendors.total, 1);
  assert.equal((vendors.html.match(/aria-label="有收錄"/g) || []).length, 2);
  assert.match(vendors.html, /00000001/);
  assert.doesNotMatch(vendors.html, /<script>/);
  assert.equal(renderVendors(data, { search: '00000002' }).total, 1);
});

test('profiles produce two tables with eight platforms, nine dimensions, safe notes and dates', () => {
  const rows = Array.from({ length: 72 }, (_, index) => ({ platform_key: `synthetic-${Math.floor(index / 9)}`, platform_name: `平台 ${Math.floor(index / 9)}`,
    platform_url: 'example.invalid', platform_order: Math.floor(index / 9) + 1, dimension: `構面 ${index % 9}`, dimension_order: index % 9,
    value: index === 0 ? '待查證' : '測試內容', note: index === 0 ? '<img src=x onerror=alert(1)>' : null, differs_from_reference: index === 0, verified_at: '2026-01-01' }));
  const html = renderProfiles(rows.reverse());
  assert.equal((html.match(/<table /g) || []).length, 2);
  assert.equal((html.match(/<td>/g) || []).length, 72);
  assert.match(html, /◆ /);
  assert.match(html, /class="unverified"/);
  assert.match(html, /查證 2026-01-01/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.equal(safeLink('javascript:alert(1)'), null);
  assert.equal(safeLink('data:text/html,bad'), null);
  assert.equal(safeLink('www.example.invalid'), 'https://www.example.invalid/');
});

test('Vercel relay forwards only password or bearer, never a service-role key', async () => {
  const saved = process.env.SUPABASE_URL, originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://synthetic.invalid';
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response('{"ok":true}'); };
  const invoke = async req => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
    await relay(req, res); return res;
  };
  try {
    const noToken = await invoke({ method: 'GET', query: { action: 'data' }, headers: {} });
    assert.equal(noToken.code, 401);
    assert.equal(calls.length, 0);
    await invoke({ method: 'POST', query: { action: 'login' }, body: { password, extra: 'excluded' } });
    assert.equal(calls[0].url.pathname, '/functions/v1/dash-data/login');
    assert.deepEqual(JSON.parse(calls[0].options.body), { password });
    const result = await invoke({ method: 'GET', query: { action: 'data' }, headers: { authorization: 'Bearer synthetic-token', apikey: 'excluded' } });
    assert.deepEqual(calls[1].options.headers, { Authorization: 'Bearer synthetic-token' });
    assert.equal(result.headers['Cache-Control'], 'private, no-store');
    assert.equal((await invoke({ method: 'POST', query: { action: 'data' } })).code, 405);
  } finally {
    globalThis.fetch = originalFetch;
    if (saved === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved;
  }
});

function frontend({ token, fetcher }) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { hidden: id !== 'login', innerHTML: '', value: '', checked: false, handlers: {},
      replaceChildren() { this.innerHTML = ''; }, addEventListener(name, fn) { this.handlers[name] = fn; } });
    return elements.get(id);
  };
  const storage = new Map(token ? [['sf_platform_overview_token', token]] : []);
  const handlers = {}, timers = [];
  const context = vm.createContext({ ...rendering, console, AbortController, Date,
    document: { getElementById: get, hidden: false, addEventListener(name, fn) { handlers[name] = fn; } },
    window: { addEventListener(name, fn) { handlers[name] = fn; } },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, fetch: fetcher });
  const script = readFileSync(new URL('../public/platform-overview.mjs', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
  vm.runInContext(script, context);
  return { get, storage, handlers, timers, context };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('no token: no requests, no numbers or data in the dashboard DOM', async () => {
  const ui = frontend({ fetcher: () => assert.fail('must not fetch without a token') });
  await settle();
  assert.equal(ui.get('dashboard').innerHTML, '');
  assert.equal(ui.get('dashboard').hidden, true);
  assert.equal(ui.get('login').hidden, false);
});

test('expired or rejected token: return to password screen and erase localStorage', async () => {
  let requests = 0;
  const expired = frontend({ token: await createToken(now - 1, secret), fetcher: () => assert.fail('expired token must not fetch') });
  assert.equal(expired.storage.size, 0);
  const rejected = frontend({ token: await createToken(Date.now() + 10000, secret), fetcher: async () => { requests++; return new Response('{}', { status: 401 }); } });
  await settle();
  assert.equal(requests, 1);
  assert.equal(rejected.storage.size, 0);
  assert.equal(rejected.get('dashboard').innerHTML, '');
  assert.equal(rejected.get('login').hidden, false);
});

test('authenticated data appears only after verification; expiry erases all rendered data', async () => {
  const ui = frontend({ token: await createToken(Date.now() + 10000, secret), fetcher: async () => new Response(JSON.stringify(sample())) });
  assert.equal(ui.get('dashboard').innerHTML, '');
  await settle();
  assert.equal(ui.get('dashboard').hidden, false);
  assert.match(ui.get('dashboard').innerHTML, /AI 方案佔比/);
  ui.timers[0]();
  assert.equal(ui.get('dashboard').innerHTML, '');
  assert.equal(ui.get('dashboard').hidden, true);
  assert.equal(ui.storage.size, 0);
});

test('logout while a data request is in flight cannot redisplay a stale response', async () => {
  let release;
  const ui = frontend({ token: await createToken(Date.now() + 10000, secret), fetcher: () => new Promise(resolve => { release = resolve; }) });
  vm.runInContext('showLogin()', ui.context);
  release(new Response(JSON.stringify(sample())));
  await settle();
  assert.equal(ui.get('dashboard').innerHTML, '');
  assert.equal(ui.get('login').hidden, false);
});

test('leaving the page clears data and cancels any in-flight rendering', async () => {
  let release;
  const ui = frontend({ token: await createToken(Date.now() + 10000, secret), fetcher: () => new Promise(resolve => { release = resolve; }) });
  ui.handlers.pagehide();
  release(new Response(JSON.stringify(sample())));
  await settle();
  assert.equal(ui.get('dashboard').innerHTML, '');
  assert.equal(ui.get('dashboard').hidden, true);
});

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createSessionValue } from '../_lib/auth.js';
import { createHandler, createToken, verifyToken } from '../supabase/functions/dash-data/handler.mjs';
import { aiShare, renderProfiles, renderOverlap, renderVendors, selectVendors, renderTakeaway, renderNextSteps, renderCoverage, renderAI, safeLink, summarize,
  isFirstWave, isCandidate, renderKPIs, renderVersionWarning, renderDataNotes, renderPlatformName, warnMissingSurveyPlatforms, SURVEY_PLATFORMS, formatDataTime } from '../public/platform-overview-render.mjs';
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
    { lower: .5, upper: .6, label: '50%–60%' });
  assert.equal(aiShare({ solutions: 20, ai_solutions: 10, ai_pending: 2, ai_label_method: '自動標記' }).label, '50%');
  assert.equal(aiShare({ solutions: 20, ai_solutions: 10, ai_pending: 2, ai_label_method: '尚未複核' }).label, '50%');
  assert.equal(aiShare({ solutions: 0, ai_solutions: 0 }).label, '未提供');
  assert.equal(aiShare({ solutions: 20, ai_solutions: null }).label, '未提供');
});

const platformRows = () => [
  ['sme_ai', 'SME AI平台'], ['moea_cloud', '雲市集工業館'], ['startup_select', '新創嚴選網'],
  ['smebiz', '商業服務業專區'], ['gov_software', '政府軟體採購網'], ['agri', '農業雲市集-數位館'], ['ntpc', '新北產業AI化輔導計畫'],
].map(([platform_key, platform_name]) => ({ platform_key, platform_name }));
const sample = () => ({ platforms: platformRows(),
  profiles: [], vendors: [{ company_id: '00000001', company_name: '<script>unsafe</script>', city: '測試市', n_platforms: 2, n_ai_solutions: 5, n_solutions: 7,
    n_platforms_normal: 2, n_ai_solutions_normal: 5, n_solutions_normal: 7, sme_ai: true, moea_cloud: true },
    { company_id: '00000002', company_name: '測試乙', n_platforms: 1, n_ai_solutions: 0, n_solutions: 1,
      n_platforms_normal: 1, n_ai_solutions_normal: 0, n_solutions_normal: 1, sme_ai: false, moea_cloud: true }], generated_at: new Date(now).toISOString() });

test('real booleans drive heatmap, dot matrix and first-wave selection', () => {
  const data = sample();
  assert.deepEqual(summarize(data.vendors), { total: 2, cross: 1, crossShare: '50%', wave: 1, candidate: 0, ai: 1 });
  assert.match(renderOverlap(data), />2<\/span>/);
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

const productionOrigin = 'https://solution-finder-gray.vercel.app';
// Synthetic deployment names, not links to shared preview content.
const previewOrigins = [
  'https://solution-finder-xxx-patrick0814-6136s-projects.vercel.app',
  'https://solution-finder-git-example-patrick0814-6136s-projects.vercel.app',
];

test('CORS accepts only the exact production origin and rejects all preview origins', async () => {
  const handler = createHandler({ env, fetcher: () => assert.fail('unauthorized requests must not read data') });
  for (const origin of [productionOrigin]) {
    const response = await handler(request('data', { headers: { Origin: origin } }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('vary'), /Origin/);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
  }
  const deniedHandler = createHandler({ env: () => assert.fail('denied origins must not read secrets'), fetcher: () => assert.fail('denied origins must not read data') });
  for (const origin of [...previewOrigins, 'https://evil.example.com', 'https://unrelated.vercel.app', 'https://solution-finder-random-other-team.vercel.app',
    'https://solution-finder-gray.vercel.app.evil.invalid', 'http://solution-finder-gray.vercel.app',
    'https://solution-finder-gray.vercel.app:8443', `${previewOrigins[0]}.evil.invalid`, 'null']) {
    const response = await deniedHandler(request('data', { headers: { Origin: origin } }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.deepEqual(await response.json(), { error: '來源未獲允許' });
  }
});

test('CORS preflight allows only the endpoint method and explicit authentication/content headers', async () => {
  const handler = createHandler({ env: () => assert.fail('preflight must not read secrets'), fetcher: () => assert.fail('preflight must not read data') });
  for (const origin of [productionOrigin]) {
    for (const [action, method, headers] of [['login', 'POST', 'content-type'], ['data', 'GET', 'Authorization, Content-Type']]) {
      const response = await handler(request(action, { method: 'OPTIONS', headers: {
        Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers,
      } }));
      assert.equal(response.status, 204);
      assert.equal(await response.text(), '');
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-methods'), method);
      assert.equal(response.headers.get('access-control-allow-headers'), 'Authorization, Content-Type');
    }
  }
  for (const headers of [
    { 'Access-Control-Request-Method': 'GET' },
    { Origin: productionOrigin, 'Access-Control-Request-Method': 'DELETE' },
    { Origin: productionOrigin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-api-key' },
  ]) assert.equal((await handler(request('data', { method: 'OPTIONS', headers }))).status, 403);
  for (const origin of previewOrigins) {
    for (const [action, method] of [['login', 'POST'], ['data', 'GET']]) {
      const response = await handler(request(action, { method: 'OPTIONS', headers: {
        Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'Content-Type',
      } }));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.deepEqual(await response.json(), { error: '來源未獲允許' });
    }
  }
});

test('all four negative-auth cases stay 401 without data for production and requests without Origin', async () => {
  const handler = createHandler({ env, fetcher: () => assert.fail('negative auth must not query data') });
  for (const origin of [null, productionOrigin]) {
    const headers = origin ? { Origin: origin } : {};
    const requests = [request('data', { headers }), request('login', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'incorrect-test-only' }) }),
      request('data', { headers: { ...headers, Authorization: 'Bearer abc.def' } }), request('data', { headers: { ...headers, Authorization: 'Bearer ' } })];
    for (const negative of requests) {
      const response = await handler(negative);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      const body = await response.json();
      for (const field of ['vendors', 'platforms', 'profiles']) assert.equal(Object.hasOwn(body, field), false);
    }
  }
});

function frontend({ token, fetcher }) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { hidden: id !== 'login', innerHTML: '', value: '', checked: false, handlers: {},
      attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
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

test('frontend login and data requests go directly to Edge with no cookies or API key', async () => {
  const token = await createToken(Date.now() + 10000, secret);
  const calls = [];
  const ui = frontend({ fetcher: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(url.endsWith('/login') ? { token } : sample()));
  } });
  ui.get('password').value = 'synthetic-login-input';
  await ui.get('login-form').handlers.submit({ preventDefault() {} });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://apdbvjruevjprslhhvlx.supabase.co/functions/v1/dash-data/login');
  assert.equal(calls[1].url, 'https://apdbvjruevjprslhhvlx.supabase.co/functions/v1/dash-data/data');
  assert.deepEqual(Object.keys(calls[0].options.headers), ['Content-Type']);
  assert.deepEqual(Object.keys(calls[1].options.headers), ['Authorization']);
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`);
  for (const call of calls) {
    assert.equal(call.options.credentials, 'omit');
    assert.equal(call.options.cache, 'no-store');
  }
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.rewrites.some(route => route.source.startsWith('/api/platform-overview')), false);
  const csp = config.headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy').value;
  const connect = csp.split(';').find(directive => directive.trim().startsWith('connect-src'));
  assert.ok(connect.split(/\s+/).includes(new URL(calls[0].url).origin));
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

test('reference view switches, pair filters, search and sortable columns compose', () => {
  const vendors = [...sample().vendors,
    { company_id: '00000003', company_name: 'Alpha', city: '測試市', n_platforms: 3, n_ai_solutions: 4,
      n_platforms_normal: 2, n_ai_solutions_normal: 4, n_solutions_normal: 5, sme_ai: true, moea_cloud: true },
    { company_id: '00000004', company_name: 'Beta', n_platforms: 2, n_ai_solutions: 7,
      n_platforms_normal: 1, n_ai_solutions_normal: 4, n_solutions_normal: 5, sme_ai: 'true', moea_cloud: true }];
  assert.equal(selectVendors(vendors, { view: 'cross' }).length, 3);
  assert.equal(selectVendors(vendors, { view: 'first' }).length, 1);
  assert.deepEqual(selectVendors(vendors, { view: 'candidate' }).map(v => v.company_id), ['00000004']);
  assert.deepEqual(selectVendors(vendors, { pair: ['moea_cloud', 'sme_ai'] }).map(v => v.company_id), ['00000003', '00000001']);
  assert.equal(selectVendors(vendors, { pair: ['sme_ai', 'sme_ai'], search: 'Alpha' }).length, 1);
  assert.equal(selectVendors(vendors, { pair: ['not-a-platform'] }).length, 0);
  assert.deepEqual(selectVendors(vendors.filter(v => ['Alpha', 'Beta'].includes(v.company_name)), { sortKey: 'name', sortDir: 1 }).map(v => v.company_name), ['Alpha', 'Beta']);
  assert.equal(selectVendors(vendors, { sortKey: 'n_ai', sortDir: -1 })[0].company_id, '00000004');
  assert.equal(selectVendors(vendors, { sortKey: 'sme_ai', sortDir: -1 })[0].sme_ai, true);
});

test('reference summary, warning, AI badges and static next steps retain their meaning', () => {
  assert.match(renderTakeaway(sample().vendors), /為下限/);
  assert.match(renderTakeaway(sample().vendors), /首波招商名單/);
  assert.match(renderCoverage([{ platform_name: '測試平台', no_id_solutions: 2 }]), /跨平台比例是下限/);
  assert.equal(renderCoverage([{ platform_name: '測試平台', no_id_solutions: 0 }]), '');
  const ai = renderAI([{ platform_name: '低比例', solutions: 20, ai_solutions: 1, ai_pending: 0, ai_label_method: '來源標記' },
    { platform_name: '高比例', solutions: 20, ai_solutions: 10, ai_pending: 2, ai_label_method: '逐筆複核' }]);
  assert.ok(ai.indexOf('高比例') < ai.indexOf('低比例'));
  assert.match(ai, /已複核，2 筆待確認/);
  assert.doesNotMatch(renderAI([{ platform_name: '未複核平台', solutions: 20, ai_solutions: 10, ai_pending: 2, ai_label_method: '尚未複核' }]), /class="vp-tag/);
  const next = renderNextSteps();
  for (const title of ['補齊資料', '確認範圍', '提出定位建議']) assert.ok(next.includes(title));
});

test('heatmap cells expose keyboard buttons, symmetric selection and disabled empty intersections', () => {
  const html = renderOverlap(sample(), ['moea_cloud', 'sme_ai']);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 2);
  assert.match(html, /data-pair-a="sme_ai" data-pair-b="moea_cloud"/);
  assert.match(html, /disabled/);
  const vendors = renderVendors(sample(), { sortKey: 'n_ai', sortDir: 1 }).html;
  assert.match(vendors, /aria-sort="ascending"/);
  assert.match(vendors, /data-sort="n_ai"/);
  assert.match(vendors, /class="vp-tag">首波/);
  assert.match(vendors, /class="bar hi"/);
});

test('frontend heatmap, view, chip and column handlers update the vendor list', async () => {
  const ui = frontend({ token: await createToken(Date.now() + 10000, secret), fetcher: async () => new Response(JSON.stringify(sample())) });
  await settle();
  ui.get('view-cross').handlers.click();
  assert.equal(ui.get('view-cross').attributes['aria-pressed'], 'true');
  assert.match(ui.get('vendor-count').textContent, /顯示 1／2 家/);
  const cell = { disabled: false, dataset: { pairA: 'sme_ai', pairB: 'moea_cloud' } };
  ui.get('overlap-table').handlers.click({ target: { closest: () => cell } });
  assert.equal(ui.get('view-all').attributes['aria-pressed'], 'true');
  assert.equal(ui.get('pair-chip').hidden, false);
  assert.match(ui.get('vendor-count').textContent, /顯示 1／2 家/);
  ui.get('overlap-table').handlers.click({ target: { closest: () => ({ ...cell, dataset: { pairA: 'moea_cloud', pairB: 'sme_ai' } }) } });
  assert.equal(ui.get('pair-chip').hidden, true);
  assert.match(ui.get('vendor-count').textContent, /顯示 2／2 家/);
  ui.get('vendor-table').handlers.click({ target: { closest: () => ({ dataset: { sort: 'n_ai' } }) } });
  assert.match(ui.get('vendor-table').innerHTML, /data-sort="n_ai"[^>]*>AI 方案數 ↓/);
  ui.get('vendor-table').handlers.click({ target: { closest: () => ({ dataset: { sort: 'n_ai' } }) } });
  assert.match(ui.get('vendor-table').innerHTML, /data-sort="n_ai"[^>]*>AI 方案數 ↑/);
  ui.get('view-first').handlers.click();
  assert.match(ui.get('vendor-count').textContent, /顯示 1／2 家/);
});

test('first-wave and candidate predicates use normal counts and exclusive thresholds', () => {
  const cases = [
    { normalPlatforms: 2, normalAi: 5, platforms: 2, ai: 5, first: true, candidate: false },
    { normalPlatforms: 2, normalAi: 4, platforms: 2, ai: 5, first: false, candidate: true },
    { normalPlatforms: 1, normalAi: 5, platforms: 2, ai: 5, first: false, candidate: true },
    { normalPlatforms: 1, normalAi: 1, platforms: 1, ai: 1, first: false, candidate: false },
    { normalPlatforms: 2, normalAi: 4, platforms: 3, ai: 4, first: false, candidate: false },
  ];
  for (const c of cases) {
    const row = { n_platforms_normal: c.normalPlatforms, n_ai_solutions_normal: c.normalAi, n_solutions_normal: 8,
      n_platforms: c.platforms, n_ai_solutions: c.ai };
    assert.equal(isFirstWave(row), c.first, JSON.stringify(c));
    assert.equal(isCandidate(row), c.candidate, JSON.stringify(c));
  }
});

test('every missing or invalid normal field makes both KPIs unknown instead of zero', () => {
  for (const key of ['n_platforms_normal', 'n_solutions_normal', 'n_ai_solutions_normal']) {
    for (const value of [undefined, null, '', 'invalid', Infinity, -1]) {
      const vendors = [sample().vendors[0], { ...sample().vendors[1], [key]: value }];
      const kpis = renderKPIs(vendors);
      assert.equal((kpis.match(/class="num">—</g) || []).length, 2, `${key}=${value}`);
      assert.equal(summarize(vendors).wave, null);
      assert.equal(summarize(vendors).candidate, null);
      assert.match(renderVersionWarning(vendors), /資料版本不符，首波名單暫無法計算，請重新整理或聯絡管理者/);
      assert.doesNotMatch(renderTakeaway(vendors), /<b>0<\/b> 家/);
      assert.equal(isFirstWave(vendors[1]), false);
      assert.equal(isCandidate(vendors[1]), false);
      for (const view of ['first', 'candidate']) {
        assert.equal(selectVendors(vendors, { view }).length, 0);
        assert.match(renderVendors({ ...sample(), vendors }, { view }).html, /暫無法顯示此名單/);
      }
      assert.equal(selectVendors(vendors).length, 2);
      assert.doesNotMatch(renderVendors({ ...sample(), vendors }).html, /class="vp-tag/);
    }
  }
  assert.equal(renderVersionWarning(sample().vendors), '');
  assert.equal(summarize([]).wave, 0);
  assert.equal(summarize([]).candidate, 0);
});

const waveFixture = () => ({ ...sample(), vendors: Array.from({ length: 32 }, (_, index) => ({
  company_id: String(index + 1).padStart(8, '0'), company_name: `合成廠商 ${index + 1}`,
  sme_ai: true, moea_cloud: true, n_platforms: 2, n_ai_solutions: 6, n_solutions: 8,
  n_platforms_normal: 2, n_ai_solutions_normal: index < 21 ? 5 : 4, n_solutions_normal: 6,
})) });

test('32 qualifying mock vendors render 21 first-wave and 11 candidates with correct takeaway', () => {
  const data = waveFixture();
  assert.deepEqual(summarize(data.vendors), { total: 32, cross: 32, crossShare: '100%', wave: 21, candidate: 11, ai: 32 });
  const kpis = renderKPIs(data.vendors);
  assert.match(kpis, /class="num">21<\/span><span class="lbl">首波：跨平台且 AI 方案 ≥ 5（只計正常方案）/);
  assert.match(kpis, /class="num">11<\/span><span class="lbl">候補：計入疑似下架才達門檻（待查證）/);
  const takeaway = renderTakeaway(data.vendors);
  assert.match(takeaway, /共 <b>32<\/b> 家，其中 <b>32<\/b> 家（<b>100%<\/b>，為下限）/);
  assert.match(takeaway, /只計正常方案，<b>21<\/b> 家/);
  assert.match(takeaway, /另有 <b>11<\/b> 家需計入疑似下架方案才達門檻/);
  const html = renderVendors(data).html;
  assert.equal((html.match(/class="vp-tag">首波/g) || []).length, 21);
  assert.equal((html.match(/class="vp-tag candidate-tag"/g) || []).length, 11);
  assert.match(html, /title="計入疑似下架方案才達首波門檻，產品現況待確認">候補/);
});

test('candidate view preserves search, pair filtering, sorting and pagination', () => {
  const data = waveFixture();
  const result = renderVendors(data, { view: 'candidate', page: 1, pageSize: 5, sortKey: 'name', sortDir: 1 });
  assert.equal(result.total, 11);
  assert.equal(result.pages, 3);
  assert.equal(result.page, 1);
  assert.equal((result.html.match(/class="vp-tag candidate-tag"/g) || []).length, 5);
  assert.doesNotMatch(result.html, /class="vp-tag">首波/);
  assert.equal(selectVendors(data.vendors, { view: 'candidate', search: '00000032', pair: ['sme_ai', 'moea_cloud'] }).length, 1);
  assert.equal(selectVendors(data.vendors, { view: 'candidate', pair: ['ntpc', 'sme_ai'] }).length, 0);
  assert.equal(renderVendors(data, { view: 'candidate', page: 100, pageSize: 5 }).page, 2);
});

test('seven platform source badges classify three survey and four database sources exactly', () => {
  assert.deepEqual(SURVEY_PLATFORMS, ['雲市集工業館', 'SME AI平台', '商業服務業專區']);
  const platforms = platformRows().map(row => ({ ...row, solutions: 10, ai_solutions: 5, ai_label_method: '原始標記' }));
  const ai = renderAI(platforms);
  assert.equal((ai.match(/class="vp-source survey"/g) || []).length, 3);
  assert.equal((ai.match(/class="vp-source database"/g) || []).length, 4);
  assert.match(ai, /title="本 SF 資料庫另行收錄的政府來源，不在補助平台盤點範圍內"/);
  for (const name of ['SME AI 平台', ' SME AI平台', 'SME AI平台 ', 'ＳＭＥ AI平台']) {
    assert.match(renderPlatformName(name), /class="vp-source database"/);
  }
  const data = { ...sample(), platforms };
  const header = renderOverlap(data).split('</thead>')[0];
  assert.equal((header.match(/class="vp-source survey"/g) || []).length, 3);
  assert.equal((header.match(/class="vp-source database"/g) || []).length, 4);
  assert.match(renderVendors(data).html, /data-sort="sme_ai"[^>]*>.*?vp-source survey/);
  assert.match(renderProfiles([{ platform_key: 'sme_ai', platform_name: 'SME AI平台', dimension: '測試' }]), /vp-source survey/);
  assert.doesNotMatch(renderPlatformName('<img src=x onerror=alert(1)>'), /<img/);
});

test('missing survey names warn with exact missing names and leave static scope notes intact', t => {
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  warnMissingSurveyPlatforms(platformRows());
  assert.deepEqual(warnings, []);
  const platforms = platformRows().map(row => row.platform_name === 'SME AI平台' ? { ...row, platform_name: 'SME AI 平台' } : row);
  warnMissingSurveyPlatforms(platforms);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /SME AI平台/);
  assert.doesNotMatch(warnings[0], /雲市集工業館|商業服務業專區/);
  warnMissingSurveyPlatforms([]);
  for (const name of SURVEY_PLATFORMS) assert.ok(warnings[1].includes(name));
  assert.match(renderDataNotes(), /臺灣雲市集已停止服務，未納入統計/);
});

test('AI methods and nonzero missing-ID counts are generated dynamically without duplicated notes', () => {
  const platforms = [
    { platform_name: '測試已複核', solutions: 20, ai_solutions: 10, ai_pending: 2, ai_label_method: '逐筆複核', no_id_solutions: 3 },
    { platform_name: '測試原始', solutions: 10, ai_solutions: 1, ai_label_method: '原始標記', no_id_solutions: 0 },
    { platform_name: '<script>測試動態</script>', solutions: 10, ai_solutions: 1, ai_label_method: '<b>來源標記</b>', no_id_solutions: 7 },
  ];
  assert.match(renderAI(platforms), /已複核，2 筆待確認/);
  assert.match(renderAI(platforms), /原始標記/);
  assert.match(renderAI(platforms), /&lt;b&gt;來源標記&lt;\/b&gt;/);
  const coverage = renderCoverage(platforms);
  assert.match(coverage, /測試已複核.*3 筆/);
  assert.match(coverage, /&lt;script&gt;測試動態&lt;\/script&gt;.*7 筆/);
  assert.doesNotMatch(coverage, /測試原始|<script>/);
  assert.doesNotMatch(renderDataNotes(), /已複核|原始標記|方案缺統編|資料時間 <time/);
});

test('data response timestamps use fixed Taipei minute format including midnight and date rollover', () => {
  assert.equal(formatDataTime('2026-10-22T16:00:59Z'), '2026-10-23 00:00');
  assert.equal(formatDataTime('2026-10-23T07:43:00Z'), '2026-10-23 15:43');
});

test('frontend candidate control, source badges and singular data explanations render together', async () => {
  const data = waveFixture();
  data.platforms[0].no_id_solutions = 3;
  const ui = frontend({ token: await createToken(Date.now() + 60000, secret), fetcher: async () => new Response(JSON.stringify(data)) });
  await settle();
  const html = ui.get('dashboard').innerHTML;
  for (const phrase of ['在架方案（正常＋疑似下架）', '首波名單只計正常方案', '其他平台沿用匯入時的原始標記', '方案缺統編', '資料時間 <time', '<h2>資料說明</h2>']) {
    assert.equal(html.split(phrase).length - 1, 1, phrase);
  }
  assert.ok(html.indexOf('<h2>資料說明') > html.indexOf('<h2>盤點總表'));
  assert.match(html, /臺灣雲市集已停止服務，未納入統計/);
  assert.equal(ui.get('generated-at').textContent, formatDataTime(data.generated_at));
  ui.get('view-candidate').handlers.click();
  assert.equal(ui.get('view-candidate').attributes['aria-pressed'], 'true');
  assert.match(ui.get('vendor-count').textContent, /顯示 11／32 家/);
  assert.doesNotMatch(ui.get('vendor-table').innerHTML, /class="vp-tag">首波/);
  ui.get('vendor-search').value = '00000032';
  ui.get('vendor-search').handlers.input();
  assert.match(ui.get('vendor-count').textContent, /顯示 1／32 家/);
  ui.get('view-first').handlers.click();
  assert.match(ui.get('vendor-count').textContent, /顯示 0／32 家/);
});

test('frontend puts version warning above KPI and preserves notes when a survey name is absent', async t => {
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  const data = sample();
  delete data.vendors[1].n_solutions_normal;
  data.platforms = data.platforms.filter(row => row.platform_name !== '商業服務業專區');
  data.platforms[0].no_id_solutions = 3;
  const ui = frontend({ token: await createToken(Date.now() + 60000, secret), fetcher: async () => new Response(JSON.stringify(data)) });
  await settle();
  const html = ui.get('dashboard').innerHTML;
  assert.ok(html.indexOf('資料版本不符') < html.indexOf('aria-label="摘要 KPI"'));
  assert.equal((html.match(/class="num">—</g) || []).length, 2);
  assert.equal(html.split('方案缺統編').length - 1, 1);
  assert.match(html, /臺灣雲市集已停止服務，未納入統計/);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /商業服務業專區/);
  ui.get('view-candidate').handlers.click();
  assert.match(ui.get('vendor-table').innerHTML, /暫無法顯示此名單/);
});

test('new public notes and labels contain no personal, client or database identifiers', () => {
  const publicText = renderDataNotes() + platformRows().map(row => renderPlatformName(row.platform_name)).join('')
    + renderVersionWarning([{}]) + renderKPIs(waveFixture().vendors) + renderTakeaway(waveFixture().vendors);
  assert.doesNotMatch(publicText, /PPC|Pcc329|Claude|委託方|職稱|姓名|appttP04|tblqQk|dash_vendor_platforms|dash_platform_overview|platform_profiles|SUPABASE_SERVICE_ROLE_KEY/);
});

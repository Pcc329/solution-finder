import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createSessionValue } from '../_lib/auth.js';
import { createHandler, createToken, verifyToken } from '../supabase/functions/dash-data/handler.mjs';
import { aiShare, renderProfiles, renderOverlap, renderVendors, selectVendors, renderTakeaway, renderNextSteps, renderCoverage, renderAI, safeLink, summarize,
  inviteTiers, invitationTrial, renderInvitationTrial, renderKPIs, renderVersionWarning, renderDataNotes, renderPlatformName, warnMissingSurveyPlatforms, SURVEY_PLATFORMS, formatDataTime } from '../public/platform-overview-render.mjs';
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
    invite_tier: '第一波', invite_reason: '虛構原因甲', n_platforms_normal: 2, n_ai_solutions_normal: 5, n_solutions_normal: 7, sme_ai: true, moea_cloud: true },
    { company_id: '00000002', company_name: '測試乙', n_platforms: 1, n_ai_solutions: 0, n_solutions: 1,
      invite_tier: '公開受理', invite_reason: '虛構原因乙', n_platforms_normal: 1, n_ai_solutions_normal: 0, n_solutions_normal: 1, sme_ai: false, moea_cloud: true }], generated_at: new Date(now).toISOString() });

test('real booleans drive heatmap, dot matrix and first-wave selection', () => {
  const data = sample();
  assert.deepEqual(summarize(data.vendors), { total: 2, cross: 1, crossShare: '50%', waves: [1, 1, 1], ai: 1 });
  assert.match(renderOverlap(data), />2<\/span>/);
  const vendors = renderVendors(data, { view: 'first' });
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
      invite_tier: '第三波', n_platforms_normal: 2, n_ai_solutions_normal: 4, n_solutions_normal: 5, sme_ai: true, moea_cloud: true },
    { company_id: '00000004', company_name: 'Beta', n_platforms: 2, n_ai_solutions: 7,
      invite_tier: '第二波', n_platforms_normal: 1, n_ai_solutions_normal: 4, n_solutions_normal: 5, sme_ai: 'true', moea_cloud: true }];
  assert.equal(selectVendors(vendors, { view: 'cross' }).length, 3);
  assert.equal(selectVendors(vendors, { view: 'first' }).length, 1);
  assert.deepEqual(selectVendors(vendors, { view: 'second' }).map(v => v.company_id), ['00000004']);
  assert.deepEqual(selectVendors(vendors, { pair: ['moea_cloud', 'sme_ai'], sortKey: 'n_platforms', sortDir: -1 }).map(v => v.company_id), ['00000003', '00000001']);
  assert.equal(selectVendors(vendors, { pair: ['sme_ai', 'sme_ai'], search: 'Alpha' }).length, 1);
  assert.equal(selectVendors(vendors, { pair: ['not-a-platform'] }).length, 0);
  assert.deepEqual(selectVendors(vendors.filter(v => ['Alpha', 'Beta'].includes(v.company_name)), { sortKey: 'name', sortDir: 1 }).map(v => v.company_name), ['Alpha', 'Beta']);
  assert.equal(selectVendors(vendors, { sortKey: 'n_ai', sortDir: -1 })[0].company_id, '00000004');
  assert.equal(selectVendors(vendors, { sortKey: 'sme_ai', sortDir: -1 })[0].sme_ai, true);
});

test('reference summary, warning, AI badges and static next steps retain their meaning', () => {
  assert.match(renderTakeaway(sample().vendors), /為下限/);
  assert.match(renderTakeaway(sample().vendors), /第一波/);
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
  assert.match(vendors, /class="vp-tag vp-wave-tag wave-0"[^>]*>第一波/);
  assert.match(vendors, /class="bar"/);
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
  assert.equal(ui.get('pair-chip').textContent, '只看：SME AI × 工業館　×');
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

// Fully invented vendors spanning every trial bucket; unrelated to live totals.
const waveFixture = () => ({ ...sample(), vendors: [
  ['第一波', 2, 8], ['第二波', 2, 4], ['第二波', 2, 5], ['第三波', 3, 2],
  ['第三波', 2, 3], ['公開受理', 2, 1], ['公開受理', 3, 0], ['公開受理', 1, 12],
].map(([invite_tier, n_platforms, n_ai_solutions], index) => ({
  company_id: `mock-${index}`, company_name: `虛構廠商 ${index}`, city: '虛構市',
  invite_tier, invite_reason: `虛構歸類原因 ${index}`, n_platforms, n_ai_solutions,
  n_solutions: n_ai_solutions + 2, sme_ai: true, moea_cloud: n_platforms >= 2,
  agri: n_platforms >= 3,
})) });

test('invitation labels are authoritative even when counts contradict historical thresholds', () => {
  const vendors = inviteTiers.map(invite_tier => ({ invite_tier, n_platforms: 1, n_ai_solutions: 0 }));
  assert.deepEqual(summarize(vendors).waves, [1, 2, 3]);
  for (const [index, view] of ['first', 'second', 'third'].entries()) {
    assert.deepEqual(selectVendors(vendors, { view }).map(v => v.invite_tier), [inviteTiers[index]]);
  }
  const highCounts = [{ invite_tier: '公開受理', n_platforms_normal: 7, n_ai_solutions_normal: 17,
    n_platforms: 7, n_ai_solutions: 19 }];
  assert.deepEqual(summarize(highCounts).waves, [0, 0, 0]);
  assert.equal(selectVendors(highCounts, { view: 'first' }).length, 0);
});

test('missing or invalid invitation tiers show unknown cumulative KPIs without inferring a tier', () => {
  for (const value of [undefined, null, '', 'unknown']) {
    const vendors = [sample().vendors[0], { ...sample().vendors[1], invite_tier: value }];
    assert.equal((renderKPIs(vendors).match(/class="num">—</g) || []).length, 3);
    assert.equal(summarize(vendors).waves, null);
    assert.match(renderVersionWarning(vendors), /資料版本不符，三波邀請名單暫無法計算/);
    assert.match(renderTakeaway(vendors), /三波邀請名單暫無法計算/);
    for (const view of ['first', 'second', 'third']) {
      assert.equal(selectVendors(vendors, { view }).length, 0);
      assert.match(renderVendors({ ...sample(), vendors }, { view }).html, /暫無法顯示此名單/);
    }
    const all = renderVendors({ ...sample(), vendors });
    assert.equal(all.total, vendors.length);
    assert.match(all.html, /未提供/);
    assert.match(renderInvitationTrial(vendors), /<b>—<\/b>/);
  }
  assert.equal(renderVersionWarning(sample().vendors), '');
  assert.deepEqual(summarize([]).waves, [0, 0, 0]);
});

test('exclusive invitation tiers partition cross-platform vendors and produce cumulative cards', () => {
  const data = waveFixture();
  const cross = selectVendors(data.vendors, { view: 'cross' });
  const counts = inviteTiers.map(tier => cross.filter(v => v.invite_tier === tier).length);
  assert.equal(counts.reduce((sum, n) => sum + n, 0), cross.length);
  assert.deepEqual(summarize(data.vendors), { total: 8, cross: 7, crossShare: '88%', waves: [1, 3, 5], ai: 7 });
  const kpis = renderKPIs(data.vendors);
  for (const [value, label] of [[1, '第一波'], [3, '第二波（累計）'], [5, '第三波（累計）']]) {
    assert.ok(kpis.includes(`class="num">${value}</span><span class="lbl">${label}`));
  }
  assert.match(renderTakeaway(data.vendors), /第二波累計 <b>3<\/b> 家、第三波累計 <b>5<\/b> 家/);
});

test('trial caps the top bucket, splits platform counts, and accumulates down to all cross-platform vendors', () => {
  const data = waveFixture();
  const rows = invitationTrial(data.vendors);
  assert.deepEqual(rows, [
    { ai: 5, total: 2, two: 2, threePlus: 0, cumulative: 2 },
    { ai: 4, total: 1, two: 1, threePlus: 0, cumulative: 3 },
    { ai: 3, total: 1, two: 1, threePlus: 0, cumulative: 4 },
    { ai: 2, total: 1, two: 0, threePlus: 1, cumulative: 5 },
    { ai: 1, total: 1, two: 1, threePlus: 0, cumulative: 6 },
    { ai: 0, total: 1, two: 0, threePlus: 1, cumulative: 7 },
  ]);
  assert.equal(rows.at(-1).cumulative, summarize(data.vendors).cross);
  assert.ok(rows.every(row => row.two + row.threePlus === row.total));
  const html = renderInvitationTrial(data.vendors);
  for (const label of ['AI 方案數', '家數', '跨 2 平台', '跨 3 平台以上', '門檻設在此時的名單家數', '5 個以上', '第一波', '第二波累計', '第三波累計']) assert.ok(html.includes(label));
  // The tier staircase is independent of the threshold table.
  assert.match(html, /第二波累計<\/span><b>3<\/b>/);
  assert.equal(invitationTrial([]).at(-1).cumulative, 0);
  for (const value of [undefined, null, '', 'invalid', -1, 1.5]) {
    const vendors = [{ n_platforms: 2, n_ai_solutions: value }];
    assert.equal(invitationTrial(vendors), null);
    assert.match(renderInvitationTrial(vendors), /AI 方案數資料不完整/);
  }
  assert.equal(invitationTrial([{ n_platforms: 1 }]).at(-1).cumulative, 0);
});

test('tier sorting, exclusive filters, search, pair filters and pagination compose', () => {
  const data = waveFixture();
  const ordered = selectVendors([...data.vendors].reverse());
  assert.deepEqual(ordered.map(v => v.invite_tier), [...data.vendors].map(v => v.invite_tier));
  assert.equal(selectVendors(data.vendors, { sortKey: 'invite_tier', sortDir: -1 })[0].invite_tier, '公開受理');
  const result = renderVendors(data, { view: 'second', page: 1, pageSize: 1, sortKey: 'name', sortDir: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.pages, 2);
  assert.equal(result.page, 1);
  assert.equal((result.html.match(/>第二波<\/span>/g) || []).length, 1);
  assert.doesNotMatch(result.html, />第一波<\/span>/);
  assert.equal(selectVendors(data.vendors, { view: 'second', search: 'mock-2', pair: ['sme_ai', 'moea_cloud'] }).length, 1);
  assert.equal(selectVendors(data.vendors, { view: 'third', pair: ['agri', 'sme_ai'] }).length, 1);
  assert.equal(renderVendors(data, { view: 'second', page: 100, pageSize: 1 }).page, 1);
  assert.match(renderVendors(data).html, /aria-sort="ascending"><button type="button" data-sort="invite_tier"/);
});

test('dedicated tier cells escape database reasons and labels including attribute injection', () => {
  const data = sample();
  data.vendors[0].invite_reason = '\"><img src=x onerror=alert(1)> & 虛構原因';
  const html = renderVendors(data).html;
  assert.match(html, /data-sort="invite_tier" title="波次">波次 ↑/);
  assert.match(html, /<td><span class="vp-tag vp-wave-tag wave-0" tabindex="0" title="&quot;&gt;&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&amp; 虛構原因/);
  data.vendors[0].invite_tier = '<script>unknown</script>';
  assert.doesNotMatch(renderVendors(data).html, /<script>/);
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

test('missing platform names return escaped plain text and never classify unknown vendor columns', () => {
  for (const name of [undefined, null, '', '   ']) {
    assert.equal(renderPlatformName(name), '未提供');
    assert.equal(renderPlatformName(name, 'SME AI'), 'SME AI');
    assert.equal(renderPlatformName(name, '<img src=x>'), '&lt;img src=x&gt;');
  }
  const data = sample();
  data.platforms = data.platforms.filter(row => row.platform_key !== 'sme_ai');
  assert.equal(rendering.platformLabels(data).has('sme_ai'), false);
  const html = renderVendors(data).html;
  const column = html.match(/<button[^>]*data-sort="sme_ai"[^>]*>(.*?)<\/button>/)?.[1];
  assert.equal(column, 'SME AI');
  assert.doesNotMatch(column, /本SF資料庫|補助平台盤點|vp-source/);
  assert.match(html, /vp-source survey/); // Known platform columns keep their badges.
  const heatmap = renderOverlap(data);
  assert.match(heatmap, /<th scope="col" title="SME AI">SME AI<\/th>/);
  assert.match(heatmap, /<th scope="row">SME AI<\/th>/);
});

test('coverage explanations use plain platform names without source badges', () => {
  const html = renderCoverage([
    { platform_name: 'SME AI平台', no_id_solutions: 3 },
    { platform_name: '政府軟體採購網', no_id_solutions: 2 },
    { platform_name: '<img src=x>', no_id_solutions: 1 },
    { platform_name: '不列出', no_id_solutions: 0 },
  ]);
  assert.equal(html, '<p>依統一編號比對：SME AI平台 3 筆、政府軟體採購網 2 筆、&lt;img src=x&gt; 1 筆方案缺統編，未計入家數，因此跨平台比例是下限。</p>');
  assert.doesNotMatch(html, /本SF資料庫|補助平台盤點|vp-source|<img/);
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

test('frontend wave controls, default sorting and trial section render together and refresh from new tiers', async () => {
  const data = waveFixture();
  data.platforms[0].no_id_solutions = 3;
  const ui = frontend({ token: await createToken(Date.now() + 60000, secret), fetcher: async () => new Response(JSON.stringify(data)) });
  await settle();
  const html = ui.get('dashboard').innerHTML;
  for (const phrase of ['在架方案（正常＋疑似下架）', '邀請名單依既有波次分類', '其他平台沿用匯入時的原始標記', '方案缺統編', '資料時間 <time', '<h2>資料說明</h2>']) {
    assert.equal(html.split(phrase).length - 1, 1, phrase);
  }
  assert.ok(html.indexOf('<h2>三波邀請試算') < html.indexOf('<h2>廠商點陣'));
  assert.ok(html.indexOf('<h2>資料說明') > html.indexOf('<h2>盤點總表'));
  assert.match(html, /臺灣雲市集已停止服務，未納入統計/);
  assert.equal(ui.get('generated-at').textContent, formatDataTime(data.generated_at));
  for (const view of ['first', 'second', 'third']) {
    ui.get(`view-${view}`).handlers.click();
    assert.equal(ui.get(`view-${view}`).attributes['aria-pressed'], 'true');
    assert.equal(ui.get('vendor-count').textContent, `顯示 ${view === 'first' ? 1 : 2}／8 家`);
  }
  ui.get('vendor-table').handlers.click({ target: { closest: () => ({ dataset: { sort: 'invite_tier' } }) } });
  assert.match(ui.get('vendor-table').innerHTML, /data-sort="invite_tier"[^>]*>波次 ↓/);
  ui.get('vendor-search').value = 'mock-2';
  ui.get('vendor-search').handlers.input();
  assert.equal(ui.get('vendor-count').textContent, '顯示 0／8 家');
  ui.get('view-second').handlers.click();
  assert.equal(ui.get('vendor-count').textContent, '顯示 1／8 家');
  data.vendors[0].invite_tier = '第二波';
  ui.get('refresh').handlers.click();
  await settle();
  assert.match(ui.get('dashboard').innerHTML, /class="num">0<\/span><span class="lbl">第一波/);
  assert.match(ui.get('dashboard').innerHTML, /class="num">3<\/span><span class="lbl">第二波（累計）/);
});

test('frontend puts version warning above KPI and preserves notes when a survey name is absent', async t => {
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  const data = sample();
  delete data.vendors[1].invite_tier;
  data.platforms = data.platforms.filter(row => row.platform_name !== '商業服務業專區');
  data.platforms[0].no_id_solutions = 3;
  const ui = frontend({ token: await createToken(Date.now() + 60000, secret), fetcher: async () => new Response(JSON.stringify(data)) });
  await settle();
  const html = ui.get('dashboard').innerHTML;
  assert.ok(html.indexOf('資料版本不符') < html.indexOf('aria-label="摘要 KPI"'));
  assert.equal((html.match(/class="num">—</g) || []).length, 3);
  assert.equal(html.split('方案缺統編').length - 1, 1);
  assert.match(html, /臺灣雲市集已停止服務，未納入統計/);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /商業服務業專區/);
  ui.get('view-second').handlers.click();
  assert.match(ui.get('vendor-table').innerHTML, /暫無法顯示此名單/);
});

test('new public notes and labels contain no personal, client or database identifiers', () => {
  const publicText = renderDataNotes() + platformRows().map(row => renderPlatformName(row.platform_name)).join('')
    + renderVersionWarning([{}]) + renderKPIs(waveFixture().vendors) + renderTakeaway(waveFixture().vendors);
  assert.doesNotMatch(publicText, /PPC|Pcc329|Claude|委託方|職稱|姓名|appttP04|tblqQk|dash_vendor_platforms|dash_platform_overview|platform_profiles|SUPABASE_SERVICE_ROLE_KEY/);
});

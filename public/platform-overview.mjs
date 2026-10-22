import { renderKPIs, renderCoverage, renderAI, renderOverlap, renderVendors, renderNextSteps, renderProfiles } from './platform-overview-render.mjs';

const TOKEN_KEY = 'sf_platform_overview_token';
const login = document.getElementById('login');
const dashboard = document.getElementById('dashboard');
const loading = document.getElementById('loading');
const error = document.getElementById('login-error');
const password = document.getElementById('password');
const button = document.getElementById('login-button');
let data = null, page = 0, expiryTimer, controller, generation = 0;

function storedToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
function forgetToken() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* Storage may be disabled. */ } }
function tokenExpiry(token) {
  if (typeof token !== 'string' || !/^\d+\.[a-f0-9]{64}$/i.test(token)) return 0;
  const expiry = Number(token.split('.')[0]);
  return Number.isSafeInteger(expiry) ? expiry : 0;
}

function showLogin(message = '') {
  generation++;
  controller?.abort();
  clearTimeout(expiryTimer);
  forgetToken();
  data = null;
  dashboard.replaceChildren();
  dashboard.hidden = true;
  loading.hidden = true;
  login.hidden = false;
  error.textContent = message;
  password.value = '';
}

function drawVendors() {
  const result = renderVendors(data, { search: document.getElementById('vendor-search').value,
    waveOnly: document.getElementById('wave-only').checked, page });
  page = result.page;
  document.getElementById('vendor-table').innerHTML = result.html;
  document.getElementById('page-info').textContent = `${result.total.toLocaleString('zh-TW')} 家 · 第 ${page + 1}／${result.pages} 頁`;
  document.getElementById('previous').disabled = page === 0;
  document.getElementById('next').disabled = page + 1 >= result.pages;
}

function render() {
  dashboard.innerHTML = `<header><div><span class="eyebrow">SOLUTION FINDER · LIVE OVERVIEW</span><h1>政府數位工具平台盤點</h1><p class="muted">跨平台廠商分布、AI 方案與查證進度</p></div><div class="header-tools"><p>資料時間 <time id="generated-at"></time></p><button id="refresh" class="secondary">重新整理</button><button id="logout" class="secondary">登出</button></div></header>
    <section aria-label="摘要 KPI" class="kpis">${renderKPIs(data.vendors)}</section>
    <section class="panel coverage-panel"><h2>缺統編說明</h2>${renderCoverage(data.platforms)}</section>
    <section class="panel"><div class="section-heading"><h2>AI 方案佔比</h2><span class="muted">已複核平台顯示確認值至含待確認值的範圍</span></div>${renderAI(data.platforms)}</section>
    <section class="panel"><h2>跨平台重疊熱圖</h2>${renderOverlap(data)}</section>
    <section class="panel"><div class="section-heading"><h2>廠商點陣</h2><span class="muted">● 有收錄　— 未收錄</span></div><div class="filters"><label for="vendor-search" class="sr-only">搜尋廠商、統編或縣市</label><input id="vendor-search" type="search" placeholder="搜尋廠商、統編或縣市"><label class="check"><input id="wave-only" type="checkbox">僅看首波名單</label></div><div id="vendor-table"></div><div class="pagination"><span id="page-info" class="muted"></span><button id="previous" class="secondary">上一頁</button><button id="next" class="secondary">下一頁</button></div></section>
    <section class="panel"><h2>下一步</h2>${renderNextSteps(data)}</section>
    <section class="panel"><h2>盤點總表</h2>${renderProfiles(data.profiles)}</section>
    <footer>盤點內容供內部分析使用；收錄不代表推薦、認證或品質評分。</footer>`;
  const time = document.getElementById('generated-at');
  time.dateTime = data.generated_at;
  time.textContent = new Date(data.generated_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  document.getElementById('logout').addEventListener('click', () => showLogin());
  document.getElementById('refresh').addEventListener('click', () => load(storedToken()));
  for (const id of ['vendor-search', 'wave-only']) document.getElementById(id).addEventListener('input', () => { page = 0; drawVendors(); });
  document.getElementById('previous').addEventListener('click', () => { page--; drawVendors(); });
  document.getElementById('next').addEventListener('click', () => { page++; drawVendors(); });
  page = 0;
  drawVendors();
}

async function load(token) {
  if (tokenExpiry(token) <= Date.now()) return showLogin(token ? '登入已過期，請重新登入' : '');
  const requestGeneration = ++generation;
  controller?.abort();
  controller = new AbortController();
  dashboard.hidden = true;
  dashboard.replaceChildren();
  data = null;
  login.hidden = true;
  loading.hidden = false;
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => showLogin('登入已過期，請重新登入'), tokenExpiry(token) - Date.now());
  try {
    const response = await fetch('/api/platform-overview/data', { headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: controller.signal });
    if (requestGeneration !== generation) return;
    if (response.status === 401 || response.status === 403) return showLogin('登入已失效，請重新登入');
    if (!response.ok) throw new Error('資料服務暫時無法使用，請重新登入後再試');
    const body = await response.json();
    if (requestGeneration !== generation) return;
    if (!Array.isArray(body.platforms) || !Array.isArray(body.vendors) || !Array.isArray(body.profiles)
      || !Number.isFinite(Date.parse(body.generated_at))) throw new Error('資料格式有誤，請稍後再試');
    if (tokenExpiry(token) <= Date.now()) return showLogin('登入已過期，請重新登入');
    data = body;
    render();
    loading.hidden = true;
    dashboard.hidden = false;
  } catch (err) {
    if (requestGeneration === generation) showLogin(err.message || '連線失敗，請稍後再試');
  }
}

document.getElementById('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  error.textContent = '';
  button.disabled = true;
  try {
    const response = await fetch('/api/platform-overview/login', { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: password.value }) });
    password.value = '';
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '登入失敗，請稍後再試');
    if (tokenExpiry(body.token) <= Date.now()) throw new Error('登入回應無效');
    try { localStorage.setItem(TOKEN_KEY, body.token); } catch { throw new Error('請允許此網站使用本機儲存空間後再登入'); }
    await load(body.token);
  } catch (err) { error.textContent = err.message || '登入服務暫時無法使用'; }
  finally { button.disabled = false; }
});
window.addEventListener('storage', event => {
  if (event.key === TOKEN_KEY && event.newValue !== event.oldValue) showLogin('登入狀態已變更，請重新登入');
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && data && tokenExpiry(storedToken()) <= Date.now()) showLogin('登入已過期，請重新登入');
});
window.addEventListener('pagehide', () => {
  generation++;
  controller?.abort();
  clearTimeout(expiryTimer);
  dashboard.hidden = true;
  dashboard.replaceChildren();
  data = null;
});
window.addEventListener('pageshow', event => { if (event.persisted) load(storedToken()); });
load(storedToken());

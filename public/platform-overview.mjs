import { renderKPIs, renderInvitationTrial, renderTakeaway, renderCoverage, renderAI, renderOverlap, renderVendors, renderNextSteps, renderProfiles, vendorKeys, shortNames, platformLabels, renderVersionWarning, renderDataNotes, warnMissingSurveyPlatforms, formatDataTime } from './platform-overview-render.mjs';

const TOKEN_KEY = 'sf_platform_overview_token';
// Public endpoint only. Password and signing/service-role secrets stay in Supabase.
const EDGE_BASE = 'https://apdbvjruevjprslhhvlx.supabase.co/functions/v1/dash-data';
const login = document.getElementById('login');
const dashboard = document.getElementById('dashboard');
const loading = document.getElementById('loading');
const error = document.getElementById('login-error');
const password = document.getElementById('password');
const button = document.getElementById('login-button');
let data = null, page = 0, expiryTimer, controller, generation = 0;
let view = 'all', pair = null, sortKey = 'invite_tier', sortDir = 1;

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
    view, pair, sortKey, sortDir, page });
  page = result.page;
  document.getElementById('vendor-table').innerHTML = result.html;
  document.getElementById('vendor-count').textContent = `顯示 ${result.total.toLocaleString('zh-TW')}／${data.vendors.length.toLocaleString('zh-TW')} 家`;
  document.getElementById('page-info').textContent = `第 ${page + 1}／${result.pages} 頁`;
  document.getElementById('previous').disabled = page === 0;
  document.getElementById('next').disabled = page + 1 >= result.pages;
}

function drawSelection() {
  for (const name of ['all', 'cross', 'first', 'second', 'third']) document.getElementById(`view-${name}`).setAttribute('aria-pressed', String(view === name));
  const chip = document.getElementById('pair-chip');
  chip.hidden = !pair;
  const labels = platformLabels(data);
  chip.textContent = pair ? `只看：${pair[0] === pair[1] ? labels.get(pair[0]) || shortNames[pair[0]] : `${shortNames[pair[0]]} × ${shortNames[pair[1]]}`}　×` : '';
  document.getElementById('overlap-table').innerHTML = renderOverlap(data, pair);
  drawVendors();
}

function selectPair(a, b) {
  if (!vendorKeys.includes(a) || !vendorKeys.includes(b)) return;
  const selected = pair && ((pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a));
  pair = selected ? null : [a, b];
  if (!selected) view = 'all';
  page = 0;
  drawSelection();
}

function render() {
  warnMissingSurveyPlatforms(data.platforms);
  dashboard.innerHTML = `<header class="vp-head"><h1>政府數位工具平台盤點：AI 方案與廠商重疊</h1><p class="vp-take">${renderTakeaway(data.vendors)}</p><div class="header-tools"><p>資料時間 <time id="generated-at"></time>（Asia/Taipei）；資料為即時讀取，後續查證可能使數字變動。</p><button id="refresh" class="secondary">重新整理</button><button id="logout" class="secondary">登出</button></div></header>
    ${renderVersionWarning(data.vendors)}
    <section aria-label="摘要 KPI" class="vp-kpis">${renderKPIs(data.vendors)}</section>
    <aside class="vp-note" aria-label="缺統編說明">${renderCoverage(data.platforms)}</aside>
    <section class="vp-card"><h2>各平台 AI 方案佔比</h2><p class="vp-sub">在架方案（正常＋疑似下架）中確定為 AI 的比例；邀請名單依既有波次分類。標「已複核」的平台已逐筆檢查名稱與描述，藍色為確定是 AI，淺色延伸為待確認的上限；其他平台沿用匯入時的原始標記，尚未複核。跨平台比較 AI 佔比時請留意定義差異。</p><div class="vp-bars">${renderAI(data.platforms)}</div></section>
    <section class="vp-card"><h2>平台兩兩重疊</h2><p class="vp-sub">格內為同時上架兩個平台的廠商數；對角線為該平台廠商總數。點一格，下方名單只列出這些廠商。</p><div id="overlap-table" class="vp-heat"></div></section>
    ${renderInvitationTrial(data.vendors)}
    <section class="vp-card"><h2>廠商點陣</h2><p class="vp-sub">每列一家廠商，有上架的平台打點；預設依波次排序，點欄位標題可切換排序。滑鼠移至波次標籤可查看歸類原因。</p><div class="vp-ctl"><div class="vp-seg" role="group" aria-label="範圍"><button id="view-all" type="button" aria-pressed="true">全部</button><button id="view-cross" type="button" aria-pressed="false">跨平台</button><button id="view-first" type="button" aria-pressed="false">第一波</button><button id="view-second" type="button" aria-pressed="false">第二波</button><button id="view-third" type="button" aria-pressed="false">第三波</button></div><button id="pair-chip" class="vp-chip" type="button" aria-label="清除平台重疊篩選" hidden></button><input id="vendor-search" class="vp-search" type="search" placeholder="搜尋公司名稱、統編或縣市" aria-label="搜尋廠商"><span id="vendor-count" class="vp-count" aria-live="polite"></span></div><div id="vendor-table"></div><div class="pagination"><span id="page-info" class="muted"></span><button id="previous" class="secondary">上一頁</button><button id="next" class="secondary">下一頁</button></div></section>
    <section class="vp-card"><h2>建議的下一步</h2><p class="vp-sub">早期盤點的後續工作，第 1、2 步可並行。</p>${renderNextSteps()}</section>
    <section class="vp-card"><h2>盤點總表</h2><p class="vp-sub">依平台與構面整理主管機關、上架方式、業者資格、方案與補助資訊；各格以查證日期為準。</p><a class="vp-link" href="https://claude.ai/artifact/VyzCPr7qBhPu9FLaC5S3eW" target="_blank" rel="noopener noreferrer">開啟完整簡報（10/21 版快照）</a><div class="vp-tables">${renderProfiles(data.profiles)}</div></section>
    ${renderDataNotes()}
    <footer>盤點內容供內部分析使用；收錄不代表推薦、認證或品質評分。</footer>`;
  const time = document.getElementById('generated-at');
  time.dateTime = data.generated_at;
  time.textContent = formatDataTime(data.generated_at);
  document.getElementById('logout').addEventListener('click', () => showLogin());
  document.getElementById('refresh').addEventListener('click', () => load(storedToken()));
  document.getElementById('vendor-search').addEventListener('input', () => { page = 0; drawVendors(); });
  for (const name of ['all', 'cross', 'first', 'second', 'third']) document.getElementById(`view-${name}`).addEventListener('click', () => {
    view = name; pair = null; page = 0; drawSelection();
  });
  document.getElementById('pair-chip').addEventListener('click', () => { pair = null; page = 0; drawSelection(); });
  document.getElementById('overlap-table').addEventListener('click', event => {
    const cell = event.target.closest('button[data-pair-a]');
    if (cell && !cell.disabled) selectPair(cell.dataset.pairA, cell.dataset.pairB);
  });
  document.getElementById('vendor-table').addEventListener('click', event => {
    const column = event.target.closest('button[data-sort]');
    if (!column) return;
    const key = column.dataset.sort;
    if (!['name', 'invite_tier', 'n_platforms', 'n_ai', ...vendorKeys].includes(key)) return;
    sortDir = sortKey === key ? -sortDir : ['name', 'invite_tier'].includes(key) ? 1 : -1;
    sortKey = key; page = 0; drawVendors();
  });
  document.getElementById('previous').addEventListener('click', () => { page--; drawVendors(); });
  document.getElementById('next').addEventListener('click', () => { page++; drawVendors(); });
  page = 0;
  view = 'all'; pair = null; sortKey = 'invite_tier'; sortDir = 1;
  drawSelection();
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
    const response = await fetch(`${EDGE_BASE}/data`, { headers: { Authorization: `Bearer ${token}` },
      credentials: 'omit', cache: 'no-store', signal: controller.signal });
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
    const response = await fetch(`${EDGE_BASE}/login`, { method: 'POST', credentials: 'omit', cache: 'no-store',
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

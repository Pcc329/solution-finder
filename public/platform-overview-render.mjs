export const vendorKeys = ['sme_ai', 'moea_cloud', 'startup_select', 'smebiz', 'gov_software', 'agri', 'ntpc'];
export const shortNames = { sme_ai: 'SME AI', moea_cloud: '工業館', startup_select: '新創嚴選', smebiz: '商服專區', gov_software: '軟體採購', agri: '農業', ntpc: '新北' };
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const count = value => number(value) == null ? '未提供' : Number(value).toLocaleString('zh-TW');
const percent = value => `${Math.round(value * 100)}%`;
const isReviewed = row => ['逐筆複核', '已複核'].includes(row.ai_label_method);
const normalFields = ['n_platforms_normal', 'n_solutions_normal', 'n_ai_solutions_normal'];
const hasNormalCounts = row => normalFields.every(key => number(row[key]) != null && number(row[key]) >= 0);
export const hasNormalData = vendors => vendors.every(hasNormalCounts);
export const isFirstWave = row => hasNormalCounts(row) && Number(row.n_platforms_normal) >= 2 && Number(row.n_ai_solutions_normal) >= 5;
export const isCandidate = row => hasNormalCounts(row) && Number(row.n_platforms) >= 2 && Number(row.n_ai_solutions) >= 5 && !isFirstWave(row);

// 補助平台盤點清單；平台更名時須同步更新，並以 platform_name 完全比對。
export const SURVEY_PLATFORMS = ['雲市集工業館', 'SME AI平台', '商業服務業專區'];

export function warnMissingSurveyPlatforms(platforms) {
  const names = new Set(platforms.map(row => row.platform_name));
  const missing = SURVEY_PLATFORMS.filter(name => !names.has(name));
  if (missing.length) console.warn('補助平台盤點名稱未出現在本次資料：', missing.join('、'));
}

export function renderPlatformName(name, label = name) {
  if (name == null || String(name).trim() === '') {
    return escapeHTML(label != null && String(label).trim() !== '' ? label : '未提供');
  }
  const surveyed = SURVEY_PLATFORMS.includes(name);
  return `<span class="vp-platform-label"><span class="vp-platform-name">${escapeHTML(label)}</span><span class="vp-source ${surveyed ? 'survey' : 'database'}"${surveyed ? '' : ' title="本 SF 資料庫另行收錄的政府來源，不在補助平台盤點範圍內"'}>${surveyed ? '補助平台盤點' : '本SF資料庫'}</span></span>`;
}

export function renderVersionWarning(vendors) {
  return hasNormalData(vendors) ? '' : '<p class="vp-note" role="status">資料版本不符，首波名單暫無法計算，請重新整理或聯絡管理者</p>';
}

export function formatDataTime(value) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function safeLink(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function summarize(vendors) {
  const total = vendors.length;
  const cross = vendors.filter(v => Number(v.n_platforms) >= 2).length;
  const classificationAvailable = hasNormalData(vendors);
  return { total, cross, crossShare: total ? percent(cross / total) : '—',
    wave: classificationAvailable ? vendors.filter(isFirstWave).length : null,
    candidate: classificationAvailable ? vendors.filter(isCandidate).length : null,
    ai: vendors.filter(v => Number(v.n_ai_solutions) > 0).length };
}

export function aiShare(row) {
  const total = number(row.solutions), ai = number(row.ai_solutions), pending = number(row.ai_pending);
  if (total == null || total <= 0 || ai == null) return { label: '未提供', lower: 0, upper: 0 };
  const lower = ai / total;
  const reviewed = isReviewed(row);
  const upper = reviewed && pending != null ? (ai + pending) / total : lower;
  return { lower, upper, label: upper > lower ? `${percent(lower)}–${percent(upper)}` : percent(lower) };
}

export function platformLabels(data) {
  return new Map([...data.profiles, ...data.platforms].map(row => [row.platform_key, row.platform_name]));
}

export function renderKPIs(vendors) {
  const s = summarize(vendors);
  return [['可辨識統編的廠商（平台去重）', s.total], ['跨 2 個以上平台', s.cross],
    ['首波：跨平台且 AI 方案 ≥ 5（只計正常方案）', s.wave], ['候補：計入疑似下架才達門檻（待查證）', s.candidate], ['至少有 1 個 AI 方案', s.ai]]
    .map(([label, value]) => `<article class="vp-card vp-kpi"><span class="num">${value == null ? '—' : count(value)}</span><span class="lbl">${label}</span></article>`).join('');
}

export function renderTakeaway(vendors) {
  const s = summarize(vendors);
  const prefix = `可辨識統編的廠商共 <b>${count(s.total)}</b> 家，其中 <b>${count(s.cross)}</b> 家（<b>${s.crossShare}</b>，為下限）同時上架 2 個以上平台。`;
  return prefix + (s.wave == null ? '只計正常方案的首波與候補名單暫無法計算。'
    : `只計正常方案，<b>${count(s.wave)}</b> 家同時具 5 個以上 AI 方案，可列為 AI 雲平台首波招商名單；另有 <b>${count(s.candidate)}</b> 家需計入疑似下架方案才達門檻，列為候補，建議先確認產品現況。`);
}

export function renderCoverage(platforms) {
  if (!platforms.length) return '<p class="muted">尚無平台統計資料。</p>';
  const gaps = platforms.filter(row => Number(row.no_id_solutions) > 0);
  return gaps.length ? `<p>依統一編號比對：${gaps.map(row => `${escapeHTML(row.platform_name)} ${count(row.no_id_solutions)} 筆`).join('、')}方案缺統編，未計入家數，因此跨平台比例是下限。</p>` : '';
}

export function renderAI(platforms) {
  if (!platforms.length) return '<p class="muted">尚無平台統計資料。</p>';
  return [...platforms].sort((a, b) => aiShare(b).lower - aiShare(a).lower || Number(b.ai_solutions) - Number(a.ai_solutions)).map(row => {
    const share = aiShare(row);
    const reviewed = isReviewed(row);
    const pending = Number(row.ai_pending) > 0;
    return `<div class="vp-bar-row">${renderPlatformName(row.platform_name)}
      <div class="vp-bar-track" role="img" aria-label="${escapeHTML(row.platform_name)} AI 方案佔比 ${share.label}"><span class="vp-bar-fill pending" style="width:${Math.max(0, Math.min(100, share.upper * 100))}%"></span><span class="vp-bar-fill confirmed" style="width:${Math.max(0, Math.min(100, share.lower * 100))}%"></span></div>
      <div class="vp-bar-val"><span class="vp-bar-figures"><b>${share.label}</b>　${count(row.ai_solutions)}／${count(row.solutions)} 筆</span><small class="vp-bar-status">${reviewed ? `<span class="vp-tag${pending ? ' pending-tag' : ''}">${pending ? `已複核，${count(row.ai_pending)} 筆待確認` : '已複核'}</span>` : escapeHTML(row.ai_label_method || '尚未複核')}</small></div></div>`;
  }).join('');
}

export function renderOverlap(data, pair = null) {
  const labels = platformLabels(data);
  const keys = vendorKeys;
  const label = key => labels.get(key) || shortNames[key];
  const matrix = keys.map(a => keys.map(b => data.vendors.filter(v => v[a] === true && v[b] === true).length));
  const max = Math.max(1, ...matrix.flatMap((row, i) => row.filter((_, j) => i !== j)));
  return `<div class="table-scroll"><table class="heatmap"><caption class="sr-only">平台兩兩重疊廠商數；對角線為該平台具統編廠商數。</caption><thead><tr><th scope="col">平台</th>${keys.map(key => `<th scope="col" title="${escapeHTML(label(key))}">${renderPlatformName(labels.get(key), shortNames[key])}</th>`).join('')}</tr></thead>
    <tbody>${keys.map((key, i) => `<tr><th scope="row">${renderPlatformName(labels.get(key), label(key))}</th>${matrix[i].map((n, j) => {
      const selected = pair && ((pair[0] === key && pair[1] === keys[j]) || (pair[1] === key && pair[0] === keys[j]));
      const title = i === j ? `${label(key)}：${count(n)} 家` : `${label(key)} 與 ${label(keys[j])}：${count(n)} 家`;
      return `<td><button type="button" class="vp-hc${i === j ? ' diag' : ''}${selected ? ' on' : ''}" data-pair-a="${key}" data-pair-b="${keys[j]}" aria-pressed="${Boolean(selected)}" aria-label="${escapeHTML(title)}" title="${escapeHTML(title)}"${n ? '' : ' disabled'}><i class="bg"${i !== j && n ? ` style="background:var(--chart-0);opacity:${.12 + .7 * n / max}"` : ''}></i><span>${n ? count(n) : '·'}</span></button></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function selectVendors(vendors, { search = '', view = 'all', waveOnly = false, pair = null, sortKey = 'n_platforms', sortDir = -1 } = {}) {
  if ((waveOnly || view === 'first' || view === 'candidate') && !hasNormalData(vendors)) return [];
  const query = search.trim().toLocaleLowerCase();
  const value = row => sortKey === 'name' ? String(row.company_name || '（未提供名稱）')
    : vendorKeys.includes(sortKey) ? (row[sortKey] === true ? 1 : 0)
      : Number(row[sortKey === 'n_ai' ? 'n_ai_solutions' : 'n_platforms']) || 0;
  const direction = sortDir === 1 ? 1 : -1;
  return vendors.filter(v => (!(waveOnly || view === 'first') || isFirstWave(v))
    && (view !== 'cross' || Number(v.n_platforms) >= 2)
    && (view !== 'candidate' || isCandidate(v))
    && (!pair || pair.every(key => vendorKeys.includes(key) && v[key] === true))
    && (!query || `${v.company_id} ${v.company_name} ${v.city || ''}`.toLocaleLowerCase().includes(query)))
    .sort((a, b) => {
      const x = value(a), y = value(b);
      const difference = typeof x === 'string' ? x.localeCompare(y, 'zh-Hant') : x - y;
      return difference * direction || Number(b.n_ai_solutions) - Number(a.n_ai_solutions)
        || String(a.company_name || '').localeCompare(String(b.company_name || ''), 'zh-Hant')
        || String(a.company_id).localeCompare(String(b.company_id));
    });
}

export function renderVendors(data, options = {}) {
  const { page = 0, pageSize = 50, sortKey = 'n_platforms', sortDir = -1 } = options;
  const labels = platformLabels(data);
  const keys = vendorKeys;
  const vendors = selectVendors(data.vendors, options);
  const maxAi = Math.max(1, ...data.vendors.map(v => Number(v.n_ai_solutions) || 0));
  const pages = Math.max(1, Math.ceil(vendors.length / pageSize));
  const current = Math.max(0, Math.min(page, pages - 1));
  const rows = vendors.slice(current * pageSize, (current + 1) * pageSize);
  const classificationAvailable = hasNormalData(data.vendors);
  const badge = row => !classificationAvailable ? '' : isFirstWave(row) ? '<span class="vp-tag">首波</span>'
    : isCandidate(row) ? '<span class="vp-tag candidate-tag" title="計入疑似下架方案才達首波門檻，產品現況待確認">候補</span>' : '';
  const unavailable = !classificationAvailable && (options.waveOnly || ['first', 'candidate'].includes(options.view));
  const emptyMessage = unavailable ? '資料版本不符，暫無法顯示此名單。' : '沒有符合條件的廠商，請放寬篩選或清除搜尋。';
  const columns = [['name', '公司'], ...keys.map(key => [key, shortNames[key]]), ['n_platforms', '平台數'], ['n_ai', 'AI 方案數']];
  return { page: current, pages, total: vendors.length, html: `<div class="table-scroll vp-mx"><table class="vendors"><caption class="sr-only">廠商平台分布</caption><thead><tr>${columns.map(([key, label]) => {
    const order = key === sortKey ? (sortDir === 1 ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" aria-sort="${order}"><button type="button" data-sort="${key}" title="${escapeHTML(labels.get(key) || label)}">${vendorKeys.includes(key) ? renderPlatformName(labels.get(key), label) : label}${order === 'ascending' ? ' ↑' : order === 'descending' ? ' ↓' : ''}</button></th>`;
  }).join('')}</tr></thead><tbody>${rows.length ? rows.map(v =>
    `<tr><th scope="row">${escapeHTML(v.company_name || '（未提供名稱）')}${badge(v)}<small>${escapeHTML(v.company_id)}${v.city ? `　${escapeHTML(v.city)}` : ''}</small></th>${keys.map((key, i) => `<td>${v[key] === true ? `<span class="dot dot-${i}" role="img" aria-label="有收錄">●</span>` : '<span class="dot-off" role="img" aria-label="未收錄">·</span>'}</td>`).join('')}<td class="vp-np">${count(v.n_platforms)}</td><td><div class="vp-ai"><span class="bar${Number(v.n_ai_solutions) >= 5 ? ' hi' : ''}" style="width:${Math.max(0, Math.min(70, Number(v.n_ai_solutions) / maxAi * 70))}%"></span><span>${count(v.n_ai_solutions)}／${count(v.n_solutions)}</span></div></td></tr>`).join('') : `<tr><td colspan="${keys.length + 3}" class="empty">${emptyMessage}</td></tr>`}</tbody></table></div>` };
}

export function renderDataNotes() {
  return `<section class="vp-card vp-data-notes"><h2>資料說明</h2>
    <p>政府軟體採購網：本庫僅收錄部分方案，非該平台全部方案。</p>
    <p>新北產業AI化輔導計畫：本庫收錄筆數與官方公告家數尚有落差，查證中。</p>
    <p>平台範圍：補助平台盤點範圍共 4 個平台（臺灣雲市集、雲市集工業館、SME AI平台、商業服務業專區），其中臺灣雲市集已停止服務，未納入統計；本 SF 資料庫另收錄 4 個政府來源（新創嚴選網、政府軟體採購網、農業雲市集-數位館、新北產業AI化輔導計畫）。資策會產業調查與案例反推補建非平台上架來源，未納入統計。</p>
    <p class="muted">AI 判定方式、缺統編與資料時間，見各圖表說明。</p></section>`;
}

export function renderNextSteps() {
  return `<div class="vp-steps"><div class="vp-step"><span class="no">01</span><h3>補齊資料</h3><p>重新匯入商服專區、補收農業雲市集 AI 館、補齊缺統編方案，並確認臺灣雲市集現況。</p></div>
    <div class="vp-step"><span class="no">02</span><h3>確認範圍</h3><p>地方政府計畫、新創採購、法人 AI 模型清單是否納入盤點。</p></div>
    <div class="vp-step"><span class="no">03</span><h3>提出定位建議</h3><p>委託背景到位後，提出 AI 雲平台與既有平台的分工及資格互認建議；SME AI 平台的綠色通關是現成先例。</p></div></div>`;
}

export function renderProfiles(profiles) {
  const sorted = [...profiles].sort((a, b) => Number(a.platform_order) - Number(b.platform_order) || Number(a.dimension_order) - Number(b.dimension_order));
  const platforms = [...new Map(sorted.map(row => [row.platform_key, row])).values()];
  if (!platforms.length) return '<p class="muted">盤點總表尚無資料。</p>';
  const dimensions = [...new Map([...sorted].sort((a, b) => Number(a.dimension_order) - Number(b.dimension_order)).map(row => [row.dimension, row.dimension_order])).keys()];
  const cells = new Map(sorted.map(row => [`${row.platform_key}\u0000${row.dimension}`, row]));
  let html = '';
  for (let offset = 0; offset < platforms.length; offset += 4) {
    const group = platforms.slice(offset, offset + 4);
    html += `<div class="table-scroll profile-group"><table class="profiles"><caption>平台盤點總表 · ${offset + 1}–${offset + group.length}</caption><thead><tr><th scope="col">構面</th>${group.map(p => {
      const link = safeLink(p.platform_url);
      return `<th scope="col">${renderPlatformName(p.platform_name)}${p.platform_url ? `<small>${link ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">${escapeHTML(p.platform_url)}</a>` : escapeHTML(p.platform_url)}</small>` : ''}</th>`;
    }).join('')}</tr></thead><tbody>${dimensions.map(dimension => `<tr><th scope="row">${escapeHTML(dimension)}</th>${group.map(p => {
      const cell = cells.get(`${p.platform_key}\u0000${dimension}`);
      if (!cell) return '<td class="muted">未提供</td>';
      return `<td>${cell.differs_from_reference === true ? '<span class="differs" aria-label="與參考盤點表不同">◆ </span>' : ''}<span${cell.value === '待查證' ? ' class="unverified"' : ''}>${escapeHTML(cell.value ?? '未提供')}</span>${cell.note ? `<small>${escapeHTML(cell.note)}</small>` : ''}${cell.verified_at ? `<small class="verified">查證 ${escapeHTML(cell.verified_at)}</small>` : ''}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return html + '<p class="muted footnote">◆ 表示與參考盤點表不同；各格查證日期取自 verified_at。</p>';
}

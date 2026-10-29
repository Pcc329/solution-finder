export const vendorKeys = ['sme_ai', 'moea_cloud', 'startup_select', 'smebiz', 'gov_software', 'agri', 'ntpc'];
export const shortNames = { sme_ai: 'SME AI', moea_cloud: '工業館', startup_select: '新創嚴選', smebiz: '商服專區', gov_software: '軟體採購', agri: '農業', ntpc: '新北' };
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const count = value => number(value) == null ? '未提供' : Number(value).toLocaleString('zh-TW');
const percent = value => `${Math.round(value * 100)}%`;
const isReviewed = row => ['逐筆複核', '已複核'].includes(row.ai_label_method);
export const inviteTiers = ['第一波', '第二波', '第三波', '公開受理'];
const inviteViews = { first: '第一波', second: '第二波', third: '第三波' };
export const hasInviteData = vendors => vendors.every(row => inviteTiers.includes(row.invite_tier));
const tierRank = row => inviteTiers.includes(row.invite_tier) ? inviteTiers.indexOf(row.invite_tier) : inviteTiers.length;

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
  return hasInviteData(vendors) ? '' : '<p class="vp-note" role="status">資料版本不符，三波邀請名單暫無法計算，請重新整理或聯絡管理者</p>';
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
  const classificationAvailable = hasInviteData(vendors);
  return { total, cross, crossShare: total ? percent(cross / total) : '—',
    waves: classificationAvailable ? inviteTiers.slice(0, 3).map((_, index) => vendors.filter(v => tierRank(v) <= index).length) : null,
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
    ['第一波', s.waves?.[0]], ['第二波（累計）', s.waves?.[1]], ['第三波（累計）', s.waves?.[2]], ['至少有 1 個 AI 方案', s.ai]]
    .map(([label, value]) => `<article class="vp-card vp-kpi"><span class="num">${value == null ? '—' : count(value)}</span><span class="lbl">${label}</span></article>`).join('');
}

export function renderTakeaway(vendors) {
  const s = summarize(vendors);
  const prefix = `可辨識統編的廠商共 <b>${count(s.total)}</b> 家，其中 <b>${count(s.cross)}</b> 家（<b>${s.crossShare}</b>，為下限）同時上架 2 個以上平台。`;
  return prefix + (s.waves == null ? '三波邀請名單暫無法計算。'
    : `依邀請波次，第一波 <b>${count(s.waves[0])}</b> 家、第二波累計 <b>${count(s.waves[1])}</b> 家、第三波累計 <b>${count(s.waves[2])}</b> 家；各廠商的歸類原因可在下方波次標籤查看。`);
}

export function invitationTrial(vendors) {
  const cross = vendors.filter(v => Number(v.n_platforms) >= 2);
  if (cross.some(v => number(v.n_ai_solutions) == null || !Number.isInteger(Number(v.n_ai_solutions)) || Number(v.n_ai_solutions) < 0)) return null;
  let cumulative = 0;
  return [5, 4, 3, 2, 1, 0].map(ai => {
    const group = cross.filter(v => Math.min(Number(v.n_ai_solutions), 5) === ai);
    cumulative += group.length;
    return { ai, total: group.length, two: group.filter(v => Number(v.n_platforms) === 2).length,
      threePlus: group.filter(v => Number(v.n_platforms) >= 3).length, cumulative };
  });
}

export function renderInvitationTrial(vendors) {
  const rows = invitationTrial(vendors);
  const { waves } = summarize(vendors);
  return `<section class="vp-card"><h2>三波邀請試算</h2><p class="vp-sub">僅列跨 2 平台以上廠商，依在架 AI 方案數（正常＋疑似下架）分組，由上往下累加。此表用於比較方案數門檻；下方三波階梯與名單依既有邀請波次呈現。</p>
    ${rows ? `<div class="table-scroll"><table class="vp-trial"><caption class="sr-only">跨平台廠商 AI 方案數與門檻累計</caption><thead><tr>${['AI 方案數', '家數', '跨 2 平台', '跨 3 平台以上', '門檻設在此時的名單家數'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${row.ai === 5 ? '5 個以上' : row.ai}</th><td>${count(row.total)}</td><td>${count(row.two)}</td><td>${count(row.threePlus)}</td><td>${count(row.cumulative)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="vp-note" role="status">AI 方案數資料不完整，暫無法顯示門檻試算。</p>'}
    <ol class="vp-wave-steps" aria-label="三波邀請累計">${inviteTiers.slice(0, 3).map((tier, index) => `<li><span>${tier}${index ? '累計' : ''}</span><b>${waves == null ? '—' : count(waves[index])}</b><span>家</span></li>`).join('')}</ol></section>`;
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

export function selectVendors(vendors, { search = '', view = 'all', pair = null, sortKey = 'invite_tier', sortDir = 1 } = {}) {
  if (inviteViews[view] && !hasInviteData(vendors)) return [];
  const query = search.trim().toLocaleLowerCase();
  const value = row => sortKey === 'invite_tier' ? tierRank(row) : sortKey === 'name' ? String(row.company_name || '（未提供名稱）')
    : vendorKeys.includes(sortKey) ? (row[sortKey] === true ? 1 : 0)
      : Number(row[sortKey === 'n_ai' ? 'n_ai_solutions' : 'n_platforms']) || 0;
  const direction = sortDir === 1 ? 1 : -1;
  return vendors.filter(v => (!inviteViews[view] || v.invite_tier === inviteViews[view])
    && (view !== 'cross' || Number(v.n_platforms) >= 2)
    && (!pair || pair.every(key => vendorKeys.includes(key) && v[key] === true))
    && (!query || `${v.company_id} ${v.company_name} ${v.city || ''}`.toLocaleLowerCase().includes(query)))
    .sort((a, b) => {
      const x = value(a), y = value(b);
      const difference = typeof x === 'string' ? x.localeCompare(y, 'zh-Hant') : x - y;
      return difference * direction || Number(b.n_platforms) - Number(a.n_platforms) || Number(b.n_ai_solutions) - Number(a.n_ai_solutions)
        || String(a.company_name || '').localeCompare(String(b.company_name || ''), 'zh-Hant')
        || String(a.company_id).localeCompare(String(b.company_id));
    });
}

export function renderVendors(data, options = {}) {
  const { page = 0, pageSize = 50, sortKey = 'invite_tier', sortDir = 1 } = options;
  const labels = platformLabels(data);
  const keys = vendorKeys;
  const vendors = selectVendors(data.vendors, options);
  const maxAi = Math.max(1, ...data.vendors.map(v => Number(v.n_ai_solutions) || 0));
  const pages = Math.max(1, Math.ceil(vendors.length / pageSize));
  const current = Math.max(0, Math.min(page, pages - 1));
  const rows = vendors.slice(current * pageSize, (current + 1) * pageSize);
  const classificationAvailable = hasInviteData(data.vendors);
  const badge = row => !inviteTiers.includes(row.invite_tier) ? '<span class="muted">未提供</span>'
    : `<span class="vp-tag vp-wave-tag wave-${tierRank(row)}" tabindex="0" title="${escapeHTML(row.invite_reason || '未提供歸類原因')}">${escapeHTML(row.invite_tier)}</span>`;
  const unavailable = !classificationAvailable && Boolean(inviteViews[options.view]);
  const emptyMessage = unavailable ? '資料版本不符，暫無法顯示此名單。' : '沒有符合條件的廠商，請放寬篩選或清除搜尋。';
  const columns = [['name', '公司'], ['invite_tier', '波次'], ...keys.map(key => [key, shortNames[key]]), ['n_platforms', '平台數'], ['n_ai', 'AI 方案數']];
  return { page: current, pages, total: vendors.length, html: `<div class="table-scroll vp-mx"><table class="vendors"><caption class="sr-only">廠商平台分布</caption><thead><tr>${columns.map(([key, label]) => {
    const order = key === sortKey ? (sortDir === 1 ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" aria-sort="${order}"><button type="button" data-sort="${key}" title="${escapeHTML(labels.get(key) || label)}">${vendorKeys.includes(key) ? renderPlatformName(labels.get(key), label) : label}${order === 'ascending' ? ' ↑' : order === 'descending' ? ' ↓' : ''}</button></th>`;
  }).join('')}</tr></thead><tbody>${rows.length ? rows.map(v =>
    `<tr><th scope="row">${escapeHTML(v.company_name || '（未提供名稱）')}<small>${escapeHTML(v.company_id)}${v.city ? `　${escapeHTML(v.city)}` : ''}</small></th><td>${badge(v)}</td>${keys.map((key, i) => `<td>${v[key] === true ? `<span class="dot dot-${i}" role="img" aria-label="有收錄">●</span>` : '<span class="dot-off" role="img" aria-label="未收錄">·</span>'}</td>`).join('')}<td class="vp-np">${count(v.n_platforms)}</td><td><div class="vp-ai"><span class="bar" style="width:${Math.max(0, Math.min(70, Number(v.n_ai_solutions) / maxAi * 70))}%"></span><span>${count(v.n_ai_solutions)}／${count(v.n_solutions)}</span></div></td></tr>`).join('') : `<tr><td colspan="${keys.length + 4}" class="empty">${emptyMessage}</td></tr>`}</tbody></table></div>` };
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

export const vendorKeys = ['sme_ai', 'moea_cloud', 'startup_select', 'smebiz', 'gov_software', 'agri', 'ntpc'];
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const count = value => number(value) == null ? '未提供' : Number(value).toLocaleString('zh-TW');
const percent = value => `${(value * 100).toFixed(1)}%`;
export const isFirstWave = row => Number(row.n_platforms) >= 2 && Number(row.n_ai_solutions) >= 5;

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
  return { total, cross, crossShare: total ? percent(cross / total) : '—',
    wave: vendors.filter(isFirstWave).length, ai: vendors.filter(v => Number(v.n_ai_solutions) > 0).length };
}

export function aiShare(row) {
  const total = number(row.solutions), ai = number(row.ai_solutions), pending = number(row.ai_pending);
  if (total == null || total <= 0 || ai == null) return { label: '未提供', lower: 0, upper: 0 };
  const lower = ai / total;
  const reviewed = /複核/.test(row.ai_label_method || '');
  const upper = reviewed && pending != null ? (ai + pending) / total : lower;
  return { lower, upper, label: upper > lower ? `${percent(lower)}–${percent(upper)}` : percent(lower) };
}

export function platformLabels(data) {
  return new Map([...data.profiles, ...data.platforms].map(row => [row.platform_key, row.platform_name]));
}

export function renderKPIs(vendors) {
  const s = summarize(vendors);
  return [['具統編廠商', count(s.total), '以統編去重'], ['跨平台廠商', count(s.cross), `佔廠商 ${s.crossShare}`],
    ['首波名單', count(s.wave), '跨平台且 AI 方案至少 5 件'], ['有 AI 方案廠商', count(s.ai), '至少一件已標記 AI 方案']]
    .map(([label, value, hint]) => `<article class="kpi"><p>${label}</p><strong>${value}</strong><small>${hint}</small></article>`).join('');
}

export function renderCoverage(platforms) {
  if (!platforms.length) return '<p class="muted">尚無平台統計資料。</p>';
  return `<p>廠商統計、重疊熱圖與點陣僅納入具統編的資料；缺統編方案仍計入各平台方案數，不能視為零家廠商。</p><div class="coverage">${platforms.map(row =>
    `<span>${escapeHTML(row.platform_name)} <b>${count(row.no_id_solutions)}</b> 件缺統編</span>`).join('')}</div>`;
}

export function renderAI(platforms) {
  if (!platforms.length) return '<p class="muted">尚無平台統計資料。</p>';
  return platforms.map(row => {
    const share = aiShare(row);
    return `<div class="ai-row"><div><b>${escapeHTML(row.platform_name)}</b><small>${escapeHTML(row.ai_label_method || '標記方法未提供')}</small></div>
      <div class="bar" role="img" aria-label="${escapeHTML(row.platform_name)} AI 方案佔比 ${share.label}"><span style="width:${Math.max(0, Math.min(100, share.upper * 100))}%" class="pending"></span><span style="width:${Math.max(0, Math.min(100, share.lower * 100))}%"></span></div>
      <div class="share"><b>${share.label}</b><small>AI ${count(row.ai_solutions)}／方案 ${count(row.solutions)} · 待確認 ${count(row.ai_pending)}</small></div></div>`;
  }).join('');
}

export function renderOverlap(data) {
  const labels = platformLabels(data);
  const keys = vendorKeys.filter(key => labels.has(key));
  if (!keys.length) return '<p class="muted">尚無可比較的平台。</p>';
  const matrix = keys.map(a => keys.map(b => data.vendors.filter(v => v[a] === true && v[b] === true).length));
  const max = Math.max(1, ...matrix.flat());
  return `<div class="table-scroll"><table class="heatmap"><caption>平台兩兩重疊廠商數；對角線為該平台具統編廠商數。</caption><thead><tr><th scope="col">平台</th>${keys.map(key => `<th scope="col">${escapeHTML(labels.get(key))}</th>`).join('')}</tr></thead>
    <tbody>${keys.map((key, i) => `<tr><th scope="row">${escapeHTML(labels.get(key))}</th>${matrix[i].map(n => `<td style="background:color-mix(in srgb, var(--accent) ${Math.round(n / max * 65)}%, var(--panel))">${count(n)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function renderVendors(data, { search = '', waveOnly = false, page = 0, pageSize = 50 } = {}) {
  const labels = platformLabels(data);
  const keys = vendorKeys.filter(key => labels.has(key));
  const query = search.trim().toLocaleLowerCase();
  const vendors = data.vendors.filter(v => (!waveOnly || isFirstWave(v)) && (!query ||
    `${v.company_id} ${v.company_name} ${v.city || ''}`.toLocaleLowerCase().includes(query)))
    .sort((a, b) => Number(b.n_platforms) - Number(a.n_platforms) || Number(b.n_ai_solutions) - Number(a.n_ai_solutions)
      || String(a.company_id).localeCompare(String(b.company_id)));
  const pages = Math.max(1, Math.ceil(vendors.length / pageSize));
  const current = Math.max(0, Math.min(page, pages - 1));
  const rows = vendors.slice(current * pageSize, (current + 1) * pageSize);
  return { page: current, pages, total: vendors.length, html: `<div class="table-scroll"><table class="vendors"><caption>廠商平台分布（依平台數、AI 方案數排序）</caption><thead><tr><th scope="col">廠商／統編</th>${keys.map(key => `<th scope="col">${escapeHTML(labels.get(key))}</th>`).join('')}<th scope="col">平台數</th><th scope="col">AI／方案</th></tr></thead><tbody>${rows.length ? rows.map(v =>
    `<tr><th scope="row">${escapeHTML(v.company_name)}<small>${escapeHTML(v.company_id)}${v.city ? ` · ${escapeHTML(v.city)}` : ''}</small></th>${keys.map((key, i) => `<td>${v[key] === true ? `<span class="dot dot-${i}" role="img" aria-label="有收錄">●</span>` : '<span class="muted" aria-label="未收錄">—</span>'}</td>`).join('')}<td>${count(v.n_platforms)}</td><td>${count(v.n_ai_solutions)}／${count(v.n_solutions)}</td></tr>`).join('') : `<tr><td colspan="${keys.length + 3}" class="empty">沒有符合條件的廠商。</td></tr>`}</tbody></table></div>` };
}

export function renderNextSteps(data) {
  const s = summarize(data.vendors);
  return `<ol class="next-steps"><li><b>先看首波名單</b><p>依「至少 2 個平台、至少 5 件 AI 方案」篩出 ${count(s.wave)} 家，進一步確認產品現況與聯繫窗口。</p></li>
    <li><b>補齊統編與 AI 複核</b><p>依上方缺口回查來源平台，完成廠商對應與待確認方案判讀。</p></li>
    <li><b>核對盤點總表</b><p>優先查證「待查證」與 ◆ 標記的構面，更新資料來源及查證日期。</p></li></ol>`;
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
      return `<th scope="col">${escapeHTML(p.platform_name)}${p.platform_url ? `<small>${link ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">${escapeHTML(p.platform_url)}</a>` : escapeHTML(p.platform_url)}</small>` : ''}</th>`;
    }).join('')}</tr></thead><tbody>${dimensions.map(dimension => `<tr><th scope="row">${escapeHTML(dimension)}</th>${group.map(p => {
      const cell = cells.get(`${p.platform_key}\u0000${dimension}`);
      if (!cell) return '<td class="muted">未提供</td>';
      return `<td>${cell.differs_from_reference === true ? '<span class="differs" aria-label="與參考盤點表不同">◆ </span>' : ''}<span${cell.value === '待查證' ? ' class="unverified"' : ''}>${escapeHTML(cell.value ?? '未提供')}</span>${cell.note ? `<small>${escapeHTML(cell.note)}</small>` : ''}${cell.verified_at ? `<small class="verified">查證 ${escapeHTML(cell.verified_at)}</small>` : ''}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return html + '<p class="muted footnote">◆ 表示與參考盤點表不同；各格查證日期取自 verified_at。</p>';
}

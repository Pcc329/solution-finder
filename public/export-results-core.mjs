// Pure export transformations. Never mutate the homepage search rows.
export function statusLabel(rs) {
  if (rs == null || rs === '') return '';
  const text = String(rs);
  return text.startsWith('疑似') ? '疑似下架' : text;
}

export function normName(name) {
  return String(name ?? '').normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
}

const numberText = value => Number(value).toLocaleString('zh-TW');
const cidOf = row => String(row.cid ?? '').trim();

export function mergeProducts(rows) {
  const groups = [], byCompany = new Map();
  for (const row of rows) {
    const cid = cidOf(row);
    const name = normName(row.s);
    if (!cid || !name) { groups.push([row]); continue; }
    if (!byCompany.has(cid)) byCompany.set(cid, new Map());
    const names = byCompany.get(cid);
    if (!names.has(name)) {
      const group = [];
      names.set(name, group);
      groups.push(group);
    }
    names.get(name).push(row);
  }
  return groups.map(group => {
    const first = group[0], statuses = new Map();
    for (const row of group) {
      const label = statusLabel(row.rs);
      statuses.set(label, (statuses.get(label) || 0) + 1);
    }
    const prices = group.map(row => row.pr)
      .filter(value => value !== '' && value != null)
      .map(Number).filter(Number.isFinite);
    let low = Infinity, high = -Infinity;
    for (const price of prices) { low = Math.min(low, price); high = Math.max(high, price); }
    const platforms = [...new Set(group.flatMap(row => Array.isArray(row.p) ? row.p : [row.p])
      .filter(value => value != null && value !== ''))];
    return {
      ...first,
      p: platforms.join('、'),
      pcount: group.length,
      status: statuses.size === 1 ? statuses.keys().next().value
        : [...statuses].map(([label, count]) => `${label} ${count}`).join('／'),
      pr: !prices.length ? '' : low === high ? numberText(low) : `${numberText(low)}～${numberText(high)}`,
      sid: group.map(row => row.sid || '').join('、'),
      ds: group.reduce((longest, row) => String(row.ds ?? '').length > longest.length
        ? String(row.ds ?? '') : longest, ''),
    };
  });
}

export function sameCompanyCount(rows) {
  const counts = new Map();
  for (const row of rows) {
    const cid = cidOf(row);
    if (cid) counts.set(cid, (counts.get(cid) || 0) + 1);
  }
  return rows.map(row => ({ ...row, same: cidOf(row) ? counts.get(cidOf(row)) : '' }));
}

export function buildCSV(rows, cols, metaLines = []) {
  const quote = value => {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/u.test(text)) text = "'" + text;
    return /[",\r\n#]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '\uFEFF' + [
    ...metaLines.map(line => quote('# ' + line)),
    cols.map(col => quote(col.label)).join(','),
    ...rows.map(row => cols.map(col => quote(row[col.key])).join(',')),
  ].join('\r\n');
}

export function describeQuery(filters = {}, sortBy = 'relevance') {
  const parts = [], list = (key, label) => {
    const values = filters[key];
    if (Array.isArray(values) && values.length) parts.push(`${label}：${values.join('、')}`);
  };
  if (filters.keyword) parts.push(`關鍵字「${filters.keyword}」`);
  list('region', '區域');
  for (const [key, label] of [['isAI', 'AI 方案'], ['isStartup', '新創'], ['isGov', '官方認證供應商']]) {
    if (filters[key] === true) parts.push(label);
    else if (filters[key] === false) parts.push(`${label}：否`);
  }
  if (filters.pricingModel) parts.push(String(filters.pricingModel));
  list('category', '類別');
  if (filters.maxPrice != null && filters.maxPrice !== '') parts.push(`價格：≤${numberText(filters.maxPrice)} 元`);
  list('program', '來源');
  list('industry_vertical', '領域');
  if (filters.industryKeyword) parts.push(`產業：${filters.industryKeyword}`);
  const sorts = {
    relevance: '相關性', price_asc: '價格低→高', price_desc: '價格高→低',
    company_az: '公司名 A-Z', name_az: '方案名 A-Z',
  };
  return `查詢條件：${parts.join('；') || '全部'}；排序：${sorts[sortBy] || sortBy}`;
}

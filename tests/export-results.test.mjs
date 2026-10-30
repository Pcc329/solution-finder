import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { statusLabel, normName, mergeProducts, sameCompanyCount, buildCSV, describeQuery } from '../public/export-results-core.mjs';
import { COLUMNS, getExportRows, exportLimitMessage, previewSummary, fileName, queryMeta, checkCanvas, PDFPageError,
  buildPDF, buildDOCX, syncTriggerButtons } from '../public/export-results-panel.mjs';

// All data is synthetic; reuse only the existing display helper, never live data.
const names = {};
vm.runInNewContext(readFileSync(new URL('../public/solution-name.js', import.meta.url), 'utf8'), names);
globalThis.displaySolutionName = names.displaySolutionName;
const sample = (extra = {}) => ({
  s: 'Synthetic A', c: 'Synthetic Company', cid: 'C-A', p: 'Synthetic Platform A',
  rs: '正常', pr: 1000, sid: 'S-A', ds: 'Synthetic summary', city: 'Synthetic City', ai: true, ...extra,
});
for (const [input, expected] of [[null, ''], [undefined, ''], ['', ''], ['正常', '正常'],
  ['疑似已下架', '疑似下架'], ['疑似待查', '疑似下架'], ['其他狀態', '其他狀態']]) {
  test(`statusLabel ${String(input)}`, () => assert.equal(statusLabel(input), expected));
}
test('NFKC, whitespace and case normalize equally; different names remain different', () => {
  assert.equal(normName(' ＡＢＣ　１２３\t\n'), normName('abc 123'));
  assert.notEqual(normName('Synthetic A'), normName('Synthetic B'));
  assert.equal(normName(null), '');
});
test('same company and normalized name merge; platforms retain first appearance', () => {
  const rows = [sample(), sample({ s: 'Ｓｙｎｔｈｅｔｉｃ Ａ', p: 'Synthetic Platform B', sid: 'S-B', ds: 'A longer synthetic summary' }),
    sample({ p: 'Synthetic Platform A', sid: 'S-C' })];
  const before = structuredClone(rows), merged = mergeProducts(rows);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].p, 'Synthetic Platform A、Synthetic Platform B');
  assert.equal(merged[0].pcount, 3);
  assert.equal(merged[0].sid, 'S-A、S-B、S-C');
  assert.equal(merged[0].ds, 'A longer synthetic summary');
  assert.equal(merged[0].c, rows[0].c);
  assert.deepEqual(rows, before);
});
test('different company or different product name never merge', () => {
  assert.equal(mergeProducts([sample(), sample({ s: 'Synthetic B' }), sample({ cid: 'C-B' })]).length, 3);
});
test('missing or whitespace company identifiers never merge', () => {
  for (const cid of ['', null, undefined, ' \t']) assert.equal(mergeProducts([sample({ cid }), sample({ cid })]).length, 2);
});
test('empty normalized names never merge, even with the same company', () => {
  for (const s of ['', null, undefined, ' \t\n', '　']) {
    const merged = mergeProducts([sample({ s, sid: 'S-A' }), sample({ s, sid: 'S-B' })]);
    assert.equal(merged.length, 2);
    assert.deepEqual(merged.map(row => row.sid), ['S-A', 'S-B']);
  }
});
test('merged statuses count each normalized label in first-appearance order', () => {
  const result = mergeProducts([sample(), sample(), sample({ rs: '疑似待查' })])[0];
  assert.equal(result.status, '正常 2／疑似下架 1');
  assert.equal(mergeProducts([sample({ rs: '' }), sample({ rs: '' })])[0].status, '');
});
test('prices: range, equal, zero, partial and entirely empty', () => {
  const merged = prices => mergeProducts(prices.map(pr => sample({ pr })))[0].pr;
  assert.equal(merged([1000, 3000]), '1,000～3,000');
  assert.equal(merged([1000, 1000]), '1,000');
  assert.equal(merged([0, null]), '0');
  assert.equal(merged([1000, '']), '1,000');
  assert.equal(merged([null, undefined, '']), '');
});
test('same-company count follows output rows, leaving missing cid blank without mutation', () => {
  const rows = mergeProducts([sample(), sample({ s: 'Synthetic B' }), sample({ cid: '' })]);
  assert.deepEqual(sameCompanyCount(rows).map(row => row.same), [2, 2, '']);
  assert.ok(rows.every(row => !Object.hasOwn(row, 'same')));
});
test('CSV BOM, CRLF, escaping and query metadata order', () => {
  const csv = buildCSV([{ s: 'a,b', c: 'say "yes"', ds: 'a\nb', p: '#source' }],
    [{ key: 's', label: '方案名稱' }, { key: 'c', label: '公司名稱' }, { key: 'ds', label: '簡述' }, { key: 'p', label: '來源' }],
    ['查詢條件：全部']);
  assert.equal(csv, '\uFEFF"# 查詢條件：全部"\r\n方案名稱,公司名稱,簡述,來源\r\n"a,b","say ""yes""","a\nb","#source"');
});
for (const value of ['=SUM(A1)', '+886', '@x', '-1', '\tformula', '\rformula']) {
  test(`CSV protects leading formula marker ${JSON.stringify(value)}`, () => {
    const safe = "'" + value;
    const encoded = /[",\r\n#]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    assert.equal(buildCSV([{ x: value }], [{ key: 'x', label: '欄位' }]), '\uFEFF欄位\r\n' + encoded);
  });
}
test('CSV sanitizes before escaping and also protects headers', () => {
  assert.equal(buildCSV([{ x: '=SUM("A",B)' }], [{ key: 'x', label: '@header' }]),
    '\uFEFF\'@header\r\n"\'=SUM(""A"",B)"');
  assert.equal(buildCSV([{ x: 'ordinary - value' }], [{ key: 'x', label: '欄位' }]),
    '\uFEFF欄位\r\nordinary - value');
});
test('query explanation covers every filter and existing homepage sort labels', () => {
  assert.equal(describeQuery({
    keyword: 'Synthetic', region: ['北部', '南部'], isAI: true, isStartup: true, isGov: true,
    pricingModel: '提供試用', category: ['協作辦公'], maxPrice: 2000, program: ['Synthetic Platform'],
    industry_vertical: ['Synthetic Vertical'], industryKeyword: 'Synthetic Industry',
  }, 'company_az'), '查詢條件：關鍵字「Synthetic」；區域：北部、南部；AI 方案；新創；官方認證供應商；提供試用；類別：協作辦公；價格：≤2,000 元；來源：Synthetic Platform；領域：Synthetic Vertical；產業：Synthetic Industry；排序：公司名 A-Z');
  assert.equal(describeQuery(), '查詢條件：全部；排序：相關性');
  assert.match(describeQuery({ isAI: false, maxPrice: 0 }, 'price_asc'), /AI 方案：否；價格：≤0 元；排序：價格低→高$/);
});
test('output whitelist uses the existing missing-name helper and excludes private fields', () => {
  const rows = getExportRows([sample({ s: '?', email: 'synthetic@example.invalid', desc: 'private', so: 5, d: ['A', 'B'] })]);
  assert.deepEqual(Object.keys(rows[0]), COLUMNS.map(col => col.key));
  assert.equal(rows[0].s, '（名稱未提供）');
  assert.equal(rows[0].ai, '是');
  assert.equal(rows[0].d, 'A、B');
  assert.deepEqual(COLUMNS.filter(col => col.brief).map(col => col.key), ['s', 'c', 'status', 'pcount', 'same', 'city', 'p']);
});
test('normal-only filtering happens before merging; unavailable statuses stay blank', () => {
  const data = [sample(), sample({ rs: '疑似待查', sid: 'S-B' }), sample({ rs: '', sid: 'S-C' })];
  assert.equal(getExportRows(data, { merge: false }).length, 3);
  assert.equal(getExportRows(data).length, 1);
  assert.equal(getExportRows(data, { onlyNormal: true })[0].pcount, 1);
  assert.equal(getExportRows([sample({ rs: '' })])[0].status, '');
  assert.equal(getExportRows([sample({ rs: '' })], { onlyNormal: true }).length, 0);
});
test('output columns preserve selected order in CSV', () => {
  const row = getExportRows([sample()])[0], cols = [COLUMNS[1], COLUMNS[0]];
  assert.equal(buildCSV([row], cols).split('\r\n')[0], '\uFEFF公司名稱,方案名稱');
});
test('PDF and Word allow 500 output rows, reject 501; CSV stays unlimited', () => {
  for (const format of ['pdf', 'docx']) {
    assert.equal(exportLimitMessage(format, 500), '');
    assert.equal(exportLimitMessage(format, 501), 'PDF／Word 最多 500 項，目前 501 項。請改用 CSV，或縮小查詢範圍');
  }
  assert.equal(exportLimitMessage('csv', 10000), '');
});
test('filename sanitizes forbidden characters and has an empty-keyword fallback', () => {
  const now = new Date(2026, 9, 30, 9, 5);
  assert.equal(fileName('a/b:c*?"<>|\r', 'csv', now), 'SF查詢結果_abc_20261030.csv');
  assert.equal(fileName(' / ', 'docx', now), 'SF查詢結果_全部_20261030.docx');
});
test('metadata has ROC time and correct merged/unmerged counts', () => {
  const now = new Date(2026, 9, 30, 9, 5);
  assert.equal(queryMeta({}, 'relevance', 2, 3, true, false, now)[1],
    '輸出時間：115/10/30 09:05　產品：2 項（由 3 筆上架紀錄合併）（上架狀態見「上架狀態」欄）');
  assert.match(queryMeta({}, 'name_az', 3, 3, false, true, now)[1], /筆數：3 筆（僅正常上架）$/);
});
test('preview summary uses records when unmerged and omits the merged suffix', () => {
  assert.equal(previewSummary(8, 8, false), '另有 2 筆將一併輸出');
  assert.equal(previewSummary(2, 2, false), '另有 0 筆將一併輸出');
});
test('preview summary uses products and adds a suffix only for positive merged counts', () => {
  assert.equal(previewSummary(8, 8, true), '另有 2 項將一併輸出');
  assert.equal(previewSummary(8, 12, true), '另有 2 項將一併輸出（已合併 4 筆重複上架紀錄）');
  assert.equal(previewSummary(2, 4, true), '另有 0 項將一併輸出（已合併 2 筆重複上架紀錄）');
});
test('metadata explicitly reports unavailable status in both merged and unmerged exports', () => {
  const now = new Date(2026, 9, 30, 9, 5);
  assert.equal(queryMeta({}, 'relevance', 2, 3, true, false, now, true)[1],
    '輸出時間：115/10/30 09:05　產品：2 項（由 3 筆上架紀錄合併）（上架狀態暫時無法讀取）');
  assert.equal(queryMeta({}, 'relevance', 3, 3, false, false, now, true)[1],
    '輸出時間：115/10/30 09:05　筆數：3 筆（上架狀態暫時無法讀取）');
  assert.ok(queryMeta({}, 'relevance', 2, 2, false, true, now, true)[1].endsWith('（上架狀態暫時無法讀取）'));
});
test('trigger synchronization is idempotent and never invokes React rendering', () => {
  let writes = 0, disabled = true, text = '輸出功能載入中';
  const button = {
    get disabled() { return disabled; }, set disabled(value) { disabled = value; writes++; },
    get textContent() { return text; }, set textContent(value) { text = value; writes++; },
  };
  const root = { querySelectorAll: () => [button] };
  syncTriggerButtons(root);
  assert.equal(writes, 2);
  for (let i = 0; i < 10; i++) syncTriggerButtons(root);
  assert.equal(writes, 2);
});

// These rasterizer/document-library doubles test control flow, not actual CDN rendering.
function canvas({ white = false, short = false, width = 400, height = 200 } = {}) {
  const data = new Uint8ClampedArray(4 * 97 * 10).fill(255);
  if (!white) for (let i = 0; i < data.length; i += 4) data[i] = 0;
  return { width, height,
    toDataURL: () => 'data:image/jpeg;base64,' + 'x'.repeat(short ? 1 : 1200),
    getContext: () => ({ getImageData: () => ({ data }) }),
  };
}
for (const [label, image] of [['zero size', canvas({ width: 0 })], ['short image', canvas({ short: true })],
  ['all white', canvas({ white: true })], ['too large', canvas({ height: 20000 })]]) {
  test(`PDF rejects ${label} with the failing page number`, () => {
    assert.throws(() => checkCanvas(image, 3), error => error instanceof PDFPageError && error.page === 3);
  });
}
test('PDF accepts a valid non-white canvas', () => assert.match(checkCanvas(canvas(), 1), /^data:image\/jpeg/));
async function withPDFEnvironment(render, action) {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  const state = { html: [], images: [], canvases: [], output: 0, pages: 1, removed: false };
  const host = { style: {}, innerHTML: '', setAttribute() {}, remove() { state.removed = true; } };
  class FakePDF {
    internal = { pageSize: { getWidth: () => 842, getHeight: () => 595 } };
    addPage() { state.pages++; }
    addImage(...args) { state.images.push(args); }
    output(type) { assert.equal(type, 'blob'); state.output++; return new Blob(['synthetic PDF']); }
  }
  globalThis.window = { jspdf: { jsPDF: FakePDF }, html2canvas: async node => {
    state.html.push(node.innerHTML);
    const image = render(state.html.length);
    state.canvases.push(image);
    return image;
  } };
  globalThis.document = { fonts: { ready: Promise.resolve() }, body: { append() {} }, createElement: () => host };
  try { await action(state); }
  finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
}
test('500-row PDF rasterizes 25 separate pages with 20 rows, first-page metadata and continuous page numbers', async () => {
  await withPDFEnvironment(() => canvas(), async state => {
    const progress = [];
    await buildPDF(Array.from({ length: 500 }, (_, i) => ({ s: `Synthetic ${i}` })), [COLUMNS[0]], ['Synthetic query'],
      (page, total) => progress.push([page, total]));
    assert.equal(state.pages, 25);
    assert.equal(state.output, 1);
    assert.equal(state.images.length, 25);
    state.html.forEach((html, i) => {
      assert.equal((html.match(/<tr>/g) || []).length, 21);
      assert.equal(html.includes('Synthetic query'), i === 0);
      assert.ok(html.endsWith(`第 ${i + 1}／25 頁</div>`));
    });
    assert.deepEqual(progress, Array.from({ length: 25 }, (_, i) => [i + 1, 25]));
    assert.ok(state.canvases.every(image => image.width === 0 && image.height === 0));
    assert.equal(state.removed, true);
  });
});
test('PDF fails on page 2 without producing a blob or continuing to page 3', async () => {
  await withPDFEnvironment(page => canvas({ white: page === 2 }), async state => {
    await assert.rejects(buildPDF(Array.from({ length: 41 }, () => ({ s: 'Synthetic' })), [COLUMNS[0]], []),
      error => error instanceof PDFPageError && error.page === 2);
    assert.equal(state.html.length, 2);
    assert.equal(state.output, 0);
    assert.equal(state.removed, true);
  });
});
test('PDF scales a tall page proportionally without cropping and cleans up on abort', async () => {
  await withPDFEnvironment(() => canvas({ height: 2000 }), async state => {
    await buildPDF([{ s: 'Synthetic' }], [COLUMNS[0]], []);
    const [, , , , width, height] = state.images[0];
    assert.ok(width <= 794 && height <= 547);
    assert.equal(width / height, 400 / 2000);
  });
  await withPDFEnvironment(() => canvas(), async state => {
    const controller = new AbortController();
    await assert.rejects(buildPDF(Array.from({ length: 21 }, () => ({ s: 'Synthetic' })), [COLUMNS[0]], [],
      page => { if (page === 2) controller.abort(); }, controller.signal), { name: 'AbortError' });
    assert.equal(state.output, 0);
    assert.equal(state.removed, true);
  });
});
test('Word builds A4 landscape, repeating colored headers and Microsoft JhengHei', async () => {
  const previous = globalThis.window;
  class Node { constructor(options) { this.options = options; } }
  let document;
  globalThis.window = { docx: {
    Document: Node, Paragraph: Node, TextRun: Node, Table: Node, TableRow: Node, TableCell: Node,
    WidthType: { PERCENTAGE: 'pct' }, PageOrientation: { LANDSCAPE: 'landscape' }, ShadingType: { CLEAR: 'clear' },
    Packer: { toBlob: async doc => { document = doc; return new Blob(['synthetic Word']); } },
  } };
  try {
    await buildDOCX([{ s: 'Synthetic\nSecond line' }], [COLUMNS[0]], ['Synthetic query']);
    const section = document.options.sections[0];
    assert.deepEqual(section.properties.page.size, { width: 11906, height: 16838, orientation: 'landscape' });
    assert.equal(document.options.styles.default.document.run.font, 'Microsoft JhengHei');
    const header = section.children.at(-1).options.rows[0];
    assert.equal(header.options.tableHeader, true);
    assert.equal(header.options.children[0].options.shading.fill, 'EEF7F3');
    assert.equal(header.options.children[0].options.children[0].options.children[0].options.color, '0D6E52');
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

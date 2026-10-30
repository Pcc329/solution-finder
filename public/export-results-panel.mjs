import { statusLabel, mergeProducts, sameCompanyCount, buildCSV, describeQuery } from './export-results-core.mjs';

export const COLUMNS = Object.freeze([
  ['s', '方案名稱', true], ['c', '公司名稱', true], ['status', '上架狀態', true],
  ['pcount', '上架平台數', true], ['same', '同公司方案數', true], ['city', '縣市', true],
  ['p', '來源平台', true], ['ai', 'AI 方案', false], ['pr', '價格（元）', false],
  ['pt', '計價方式', false], ['d', '適用產業', false], ['ds', '方案簡述', false],
  ['sid', '方案編號', false],
].map(([key, label, brief]) => Object.freeze({ key, label, brief })));

const LIBRARIES = Object.freeze({
  sortable: ['https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js', () => window.Sortable?.create],
  docx: ['https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js', () => window.docx?.Packer],
  canvas: ['https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', () => window.html2canvas],
  pdf: ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => window.jspdf?.jsPDF],
});
const scripts = new Map(), LIMIT = 500, PAGE_ROWS = 20;
const nf = value => Number(value).toLocaleString('zh-TW');
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const asText = value => Array.isArray(value) ? value.join('、') : String(value ?? '');

function componentError() {
  return Object.assign(new Error('輸出元件載入失敗，請檢查網路後再試一次'), { code: 'SF_EXPORT_COMPONENT' });
}
async function loadScript(key) {
  const [url, ready] = LIBRARIES[key];
  if (ready()) return;
  if (!scripts.has(url)) {
    scripts.set(url, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(fail, 30000);
      function fail() {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        script.remove();
        reject(componentError());
      }
      script.src = url;
      script.async = true;
      script.onload = () => {
        if (!ready()) { fail(); return; }
        clearTimeout(timer);
        script.onload = script.onerror = null;
        resolve();
      };
      script.onerror = fail;
      document.head.append(script);
    }));
  }
  try { await scripts.get(url); }
  catch (error) { scripts.delete(url); throw error; }
}
const checkAborted = signal => { if (signal?.aborted) throw new DOMException('已取消輸出', 'AbortError'); };

export function exportLimitMessage(format, count) {
  return format !== 'csv' && count > LIMIT
    ? `PDF／Word 最多 500 項，目前 ${nf(count)} 項。請改用 CSV，或縮小查詢範圍` : '';
}
export function getExportRows(results, { merge = true, onlyNormal = false } = {}) {
  const base = onlyNormal ? results.filter(row => statusLabel(row.rs) === '正常') : results;
  const rows = merge ? mergeProducts(base) : base.map(row => ({
    ...row, p: asText(row.p), status: statusLabel(row.rs), pcount: 1,
    pr: row.pr == null || row.pr === '' ? '' : nf(row.pr),
  }));
  return sameCompanyCount(rows).map(row => ({
    s: globalThis.displaySolutionName(row.s), c: asText(row.c), status: row.status,
    pcount: row.pcount, same: row.same, city: asText(row.city), p: row.p,
    ai: row.ai ? '是' : '否', pr: row.pr, pt: asText(row.pt),
    d: asText(row.d), ds: asText(row.ds), sid: asText(row.sid),
  }));
}
export function fileName(keyword, ext, date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const clean = String(keyword || '全部').replace(/[\\/:*?"<>|\u0000-\u001F\u007F]/g, '').trim()
    .replace(/[. ]+$/g, '').slice(0, 80) || '全部';
  return `SF查詢結果_${clean}_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.${ext}`;
}
export function previewSummary(count, baseCount, merge) {
  const merged = baseCount - count;
  const suffix = merge && merged > 0 ? `（已合併 ${nf(merged)} 筆重複上架紀錄）` : '';
  return `另有 ${nf(Math.max(0, count - 6))} ${merge ? '項' : '筆'}將一併輸出${suffix}`;
}
export function queryMeta(filters, sortBy, count, baseCount, merge, onlyNormal, date = new Date(), statusUnavailable = false) {
  const pad = n => String(n).padStart(2, '0');
  const time = `${String(date.getFullYear() - 1911).padStart(3, '0')}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const statusNote = statusUnavailable ? '（上架狀態暫時無法讀取）'
    : onlyNormal ? '（僅正常上架）' : '（上架狀態見「上架狀態」欄）';
  return [
    describeQuery(filters, sortBy),
    `輸出時間：${time}　${merge ? `產品：${nf(count)} 項（由 ${nf(baseCount)} 筆上架紀錄合併）` : `筆數：${nf(count)} 筆`}${statusNote}`,
    merge ? '資料來源：產業資料庫（各政府計畫平台公開上架名單）；同公司、同名的產品已合併為一列，來源平台以頓號列出'
      : '資料來源：產業資料庫（各政府計畫平台公開上架名單）；同一產品上架多個平台時，各平台分別計為一筆',
  ];
}

export async function buildDOCX(rows, cols, meta, signal) {
  await loadScript('docx');
  checkAborted(signal);
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, PageOrientation, ShadingType } = window.docx;
  const font = 'Microsoft JhengHei';
  const paragraph = (text, options = {}) => new Paragraph({
    children: String(text ?? '').split(/\r\n|\r|\n/).map((line, index) => new TextRun({
      text: line, font, size: options.size || 18, bold: !!options.bold,
      color: options.color || '1F2933', ...(index ? { break: 1 } : {}),
    })),
  });
  const cell = (text, header = false) => new TableCell({
    width: { size: 100 / cols.length, type: WidthType.PERCENTAGE },
    ...(header ? { shading: { fill: 'EEF7F3', type: ShadingType.CLEAR } } : {}),
    children: [paragraph(text, { bold: header, color: header ? '0D6E52' : '1F2933' })],
  });
  const children = [];
  if (meta.length) {
    children.push(paragraph('產業資料庫 查詢結果', { size: 28, bold: true }));
    children.push(...meta.map(line => paragraph(line, { color: '4B5563' })), paragraph(''));
  }
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: cols.map(col => cell(col.label, true)) }),
      ...rows.map(row => new TableRow({ children: cols.map(col => cell(row[col.key])) })),
    ],
  }));
  const blob = await Packer.toBlob(new Document({
    styles: { default: { document: { run: { font, size: 18 } } } },
    sections: [{
      properties: { page: {
        size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
        margin: { top: 720, bottom: 720, left: 720, right: 720 },
      } },
      children,
    }],
  }));
  checkAborted(signal);
  return blob;
}
export class PDFPageError extends Error {
  constructor(page, reason) { super(reason); this.name = 'PDFPageError'; this.page = page; }
}
export function checkCanvas(canvas, page) {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) throw new PDFPageError(page, '畫布寬高無效');
  if (canvas.width > 16384 || canvas.height > 16384 || canvas.width * canvas.height > 16000000) {
    throw new PDFPageError(page, '頁面超過可繪製範圍');
  }
  let image, pixels;
  try {
    image = canvas.toDataURL('image/jpeg', 0.92);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('context');
    pixels = context.getImageData(0, 0, canvas.width, Math.min(canvas.height, 400)).data;
  } catch { throw new PDFPageError(page, '無法讀取圖片'); }
  if (!image || !image.startsWith('data:image/jpeg') || image.length < 1000) {
    throw new PDFPageError(page, '圖片資料無效');
  }
  let ink = 0;
  for (let i = 0; i < pixels.length; i += 4 * 97) {
    if (pixels[i + 3] > 0 && (pixels[i] < 235 || pixels[i + 1] < 235 || pixels[i + 2] < 235)) ink++;
    if (ink > 5) break;
  }
  if (ink <= 5) throw new PDFPageError(page, '內容空白');
  return image;
}
export async function buildPDF(rows, cols, meta, onProgress, signal) {
  await Promise.all([loadScript('canvas'), loadScript('pdf')]);
  checkAborted(signal);
  if (document.fonts?.ready) await document.fonts.ready;
  checkAborted(signal);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1120px;padding:18px;box-sizing:border-box;background:#fff;color:#1f2933;font:13px "Microsoft JhengHei",sans-serif;overflow-wrap:anywhere;';
  document.body.append(host);
  const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight(), margin = 24;
  const total = Math.max(1, Math.ceil(rows.length / PAGE_ROWS));
  try {
    for (let i = 0; i < total; i++) {
      checkAborted(signal);
      onProgress?.(i + 1, total);
      let canvas;
      try {
        const chunk = rows.slice(i * PAGE_ROWS, (i + 1) * PAGE_ROWS);
        host.innerHTML = (i === 0 && meta.length ? `<div style="border-left:3px solid #1D9E75;padding-left:10px;margin-bottom:14px;color:#4b5563"><strong style="display:block;font-size:16px;color:#1f2933">產業資料庫 查詢結果</strong>${meta.map(escapeHTML).join('<br>')}</div>` : '')
          + `<table style="border-collapse:collapse;width:100%;table-layout:fixed"><thead><tr>${cols.map(col => `<th style="padding:7px;border:1px solid #dce8e2;text-align:left;color:#0D6E52;background:#EEF7F3">${escapeHTML(col.label)}</th>`).join('')}</tr></thead><tbody>${chunk.map(row => `<tr>${cols.map(col => `<td style="padding:7px;border:1px solid #e3e8e6;vertical-align:top;white-space:pre-wrap">${escapeHTML(row[col.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
          + `<div style="margin-top:10px;color:#6b7280;text-align:right;font-size:11px">第 ${i + 1}／${total} 頁</div>`;
        // Yield so the progress message paints before each individual page is rasterized.
        await new Promise(resolve => setTimeout(resolve, 0));
        checkAborted(signal);
        canvas = await window.html2canvas(host, { scale: 2, backgroundColor: '#ffffff', logging: false });
        checkAborted(signal);
        const image = checkCanvas(canvas, i + 1);
        const ratio = Math.min((width - 2 * margin) / canvas.width, (height - 2 * margin) / canvas.height);
        if (i) pdf.addPage();
        pdf.addImage(image, 'JPEG', margin, margin, canvas.width * ratio, canvas.height * ratio);
      } catch (error) {
        if (error.name === 'AbortError' || error instanceof PDFPageError) throw error;
        throw new PDFPageError(i + 1, '畫面轉圖失敗');
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        host.innerHTML = '';
      }
    }
    checkAborted(signal);
    return pdf.output('blob');
  } finally { host.remove(); }
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    // Allow browsers to consume the URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

const CSS = `
#sf-export-dialog{width:min(1280px,calc(100vw - 32px));max-width:none;max-height:92vh;padding:0;border:1px solid #dce5df;border-radius:16px;color:#1f2933;background:#f7faf8;box-shadow:0 20px 70px #0003;font:14px/1.6 "Microsoft JhengHei",sans-serif}
#sf-export-dialog::backdrop{background:#11251dcc}
#sf-export-dialog *{box-sizing:border-box}
#sf-export-dialog button,#sf-export-dialog input{font:inherit}
#sf-export-dialog button{cursor:pointer;padding:5px 10px;border:1px solid #cbd9d0;border-radius:6px;background:white;color:#24513d}
#sf-export-dialog button:disabled{opacity:.5;cursor:not-allowed}
#sf-export-dialog :focus-visible{outline:3px solid #1d9e75;outline-offset:2px}
#sf-export-dialog header{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid #dce5df;background:white}
#sf-export-dialog h2{margin:0;font-size:19px;font-weight:700}
#sf-export-dialog .sf-layout{display:grid;grid-template-columns:300px minmax(0,1fr)}
#sf-export-dialog .sf-controls{min-width:0;margin:0;padding:20px;border:0;border-right:1px solid #dce5df}
#sf-export-dialog legend{font-weight:700;margin-bottom:6px}
#sf-export-dialog .sf-group{border:0;margin:0 0 20px;padding:0;min-width:0}
#sf-export-dialog label{display:block;cursor:pointer;margin:7px 0}
#sf-export-dialog small{display:block;margin-left:24px;font-size:12px;color:#66766d;line-height:1.5}
#sf-export-dialog input{accent-color:#0d6e52;margin-right:7px}
#sf-export-dialog .sf-presets{display:flex;gap:8px;margin-bottom:10px}
#sf-export-dialog ul{list-style:none;margin:0;padding:0}
#sf-export-dialog li{display:flex;align-items:center;gap:5px;margin:5px 0;padding:3px 5px;background:white;border:1px solid #e0e8e2;border-radius:7px}
#sf-export-dialog li label{flex:1;margin:0}
#sf-export-dialog .sf-handle{cursor:grab;padding:4px;color:#7b9084;touch-action:none}
#sf-export-dialog .sf-preview{min-width:0;padding:20px}
#sf-export-dialog .sf-preview-title{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;margin-bottom:12px}
#sf-export-dialog .sf-preview-title span{font-size:12px;color:#66766d}
#sf-export-dialog .sf-sheet{background:white;padding:16px;border:1px solid #dce5df;border-radius:8px}
#sf-export-dialog .sf-meta{border-left:3px solid #1d9e75;padding-left:10px;margin-bottom:14px;font-size:12px;color:#56635c;white-space:pre-wrap;overflow-wrap:anywhere}
#sf-export-dialog .sf-scroll{overflow-x:auto}
#sf-export-dialog table{border-collapse:collapse;width:100%;font-size:12px}
#sf-export-dialog th,#sf-export-dialog td{min-width:110px;max-width:300px;padding:9px;border:1px solid #e3e8e6;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
#sf-export-dialog th{color:#0d6e52;background:#eef7f3;cursor:grab;touch-action:none}
#sf-export-dialog .sf-more{margin-top:12px;color:#66766d;font-size:12px}
#sf-export-dialog footer{padding:16px 22px;border-top:1px solid #dce5df;background:white;display:flex;align-items:center;justify-content:space-between;gap:16px}
#sf-export-dialog .sf-message{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;color:#52665a}
#sf-export-dialog .sf-message.sf-error{color:#b42318}
#sf-export-dialog .sf-download{background:#0d6e52;color:white;white-space:nowrap;border-color:#0d6e52}
#sf-export-dialog .sf-unavailable{color:#9b5400;font-size:12px}
@media(max-width:820px){#sf-export-dialog .sf-layout{grid-template-columns:1fr}#sf-export-dialog .sf-controls{border-right:0;border-bottom:1px solid #dce5df}#sf-export-dialog footer{align-items:flex-start;flex-direction:column}}
`;
let closeActive = null;

function open({ results = [], filters = {}, sortBy = 'relevance' }) {
  closeActive?.();
  const trigger = document.activeElement, snapshot = results.map(row => ({ ...row }));
  const query = structuredClone(filters);
  const dialog = document.createElement('dialog');
  dialog.id = 'sf-export-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'sf-export-title');
  dialog.innerHTML = `
    <header><h2 id="sf-export-title">輸出查詢結果</h2><button type="button" data-close aria-label="關閉輸出面板">✕</button></header>
    <div class="sf-layout">
      <fieldset class="sf-controls">
        <fieldset class="sf-group"><legend>檔案類型</legend>
          <label><input type="radio" name="sf-format" value="csv" checked>CSV<small>適合用 Excel 再加工，含 BOM。筆數不限。</small></label>
          <label><input type="radio" name="sf-format" value="pdf">PDF<small>A4 橫式。PDF 為畫面轉圖，文字無法選取。最多 500 項。</small></label>
          <label><input type="radio" name="sf-format" value="docx">Word<small>A4 橫式，可在 Word 編輯。最多 500 項。</small></label>
        </fieldset>
        <fieldset class="sf-group"><legend>欄位與順序</legend>
          <div class="sf-presets"><button type="button" data-preset="brief">精簡</button><button type="button" data-preset="all">全部</button></div>
          <ul data-columns aria-label="輸出欄位順序"></ul>
        </fieldset>
        <fieldset class="sf-group"><legend>內容選項</legend>
          <label><input type="checkbox" data-option="merge" checked>合併同一產品<small>同公司、同名的上架紀錄合併為一列。</small></label>
          <label><input type="checkbox" data-option="meta" checked>附上查詢說明</label>
          <label><input type="checkbox" data-option="normal">只輸出正常上架</label>
          <p class="sf-unavailable" data-unavailable hidden>上架狀態暫時無法讀取</p>
        </fieldset>
      </fieldset>
      <section class="sf-preview" aria-label="輸出預覽"><div class="sf-preview-title"><b>預覽</b><span>可直接拖曳表頭調整欄位順序</span></div><div class="sf-sheet" data-sheet></div></section>
    </div>
    <footer><p class="sf-message" data-message role="status" aria-live="polite"></p><button type="button" class="sf-download" data-download>下載 CSV</button></footer>`;
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  const state = {
    format: 'csv', merge: true, meta: true, normal: false, busy: false,
    columns: COLUMNS.map(col => ({ ...col, on: col.brief })),
  };
  const controller = new AbortController();
  const statusUnavailable = snapshot.length > 0 && snapshot.every(row => statusLabel(row.rs) === '');
  find('[data-option="normal"]').disabled = statusUnavailable;
  find('[data-unavailable]').hidden = !statusUnavailable;
  let listSortable, headSortable, closed = false;
  const destroySortables = () => {
    listSortable?.destroy(); headSortable?.destroy();
    listSortable = headSortable = null;
  };
  function close() {
    if (closed) return;
    closed = true;
    controller.abort();
    destroySortables();
    dialog.close();
    dialog.remove();
    if (closeActive === close) closeActive = null;
    if (trigger?.isConnected) trigger.focus();
  }
  closeActive = close;
  const message = (text, error = false) => {
    find('[data-message]').textContent = text;
    find('[data-message]').classList.toggle('sf-error', error);
  };
  const selected = () => state.columns.filter(col => col.on);
  const rowsNow = () => getExportRows(snapshot, { merge: state.merge, onlyNormal: state.normal });
  const baseCount = () => state.normal ? snapshot.filter(row => statusLabel(row.rs) === '正常').length : snapshot.length;
  function render() {
    if (closed) return;
    destroySortables();
    find('.sf-controls').disabled = state.busy;
    find('[data-columns]').innerHTML = state.columns.map((col, i) => `
      <li data-key="${col.key}"><span class="sf-handle" aria-hidden="true">⠿</span>
        <label><input type="checkbox" data-toggle="${col.key}" ${col.on ? 'checked' : ''}>${col.label}</label>
        <button type="button" data-move="${col.key}" data-direction="-1" aria-label="${col.label}往前" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-move="${col.key}" data-direction="1" aria-label="${col.label}往後" ${i === state.columns.length - 1 ? 'disabled' : ''}>↓</button></li>`).join('');
    const cols = selected(), rows = rowsNow(), over = exportLimitMessage(state.format, rows.length);
    const meta = state.meta ? queryMeta(query, sortBy, rows.length, baseCount(), state.merge, state.normal, undefined, statusUnavailable) : [];
    find('[data-sheet]').innerHTML = (meta.length ? `<div class="sf-meta">${meta.map(line => escapeHTML((state.format === 'csv' ? '# ' : '') + line)).join('<br>')}</div>` : '')
      + (!cols.length ? '<p>請至少勾選一個欄位。</p>' : `<div class="sf-scroll"><table><thead><tr data-head>${cols.map(col => `<th data-key="${col.key}">⠿ ${col.label}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 6).map(row => `<tr>${cols.map(col => `<td>${escapeHTML(row[col.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="sf-more">${escapeHTML(previewSummary(rows.length, baseCount(), state.merge))}</p>`);
    const button = find('[data-download]');
    button.disabled = state.busy || !cols.length || !rows.length || !!over;
    button.textContent = state.busy ? '產生檔案中…' : `下載 ${state.format === 'docx' ? 'Word' : state.format.toUpperCase()}`;
    if (!state.busy) message(over, !!over);
    if (window.Sortable?.create && !state.busy) {
      listSortable = window.Sortable.create(find('[data-columns]'), {
        handle: '.sf-handle', animation: 150, onEnd() {
          const byKey = new Map(state.columns.map(col => [col.key, col]));
          state.columns = [...find('[data-columns]').children].map(node => byKey.get(node.dataset.key));
          render();
        },
      });
      if (cols.length) headSortable = window.Sortable.create(find('[data-head]'), {
        animation: 150, direction: 'horizontal', onEnd() {
          const keys = [...find('[data-head]').children].map(node => node.dataset.key);
          const byKey = new Map(state.columns.map(col => [col.key, col]));
          let index = 0;
          state.columns = state.columns.map(col => col.on ? byKey.get(keys[index++]) : col);
          render();
        },
      });
    }
  }
  find('[data-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    }
    if (state.busy) return;
    const move = event.target.closest('[data-move]'), preset = event.target.closest('[data-preset]');
    if (move) {
      const index = state.columns.findIndex(col => col.key === move.dataset.move);
      const next = index + Number(move.dataset.direction);
      if (next < 0 || next >= state.columns.length) return;
      [state.columns[index], state.columns[next]] = [state.columns[next], state.columns[index]];
      render();
      const candidates = [...dialog.querySelectorAll(`[data-move="${move.dataset.move}"]`)];
      (candidates.find(button => button.dataset.direction === move.dataset.direction && !button.disabled)
        || candidates.find(button => !button.disabled))?.focus();
    }
    if (preset) {
      state.columns.forEach(col => { col.on = preset.dataset.preset === 'all' || col.brief; });
      render();
    }
  });
  dialog.addEventListener('change', event => {
    if (state.busy) return;
    const input = event.target;
    if (input.dataset.toggle) state.columns.find(col => col.key === input.dataset.toggle).on = input.checked;
    else if (input.name === 'sf-format') state.format = input.value;
    else if (input.dataset.option) {
      const key = input.dataset.option;
      state[key] = input.checked;
      if (key === 'normal' && statusUnavailable) { state.normal = false; input.checked = false; }
    }
    render();
  });
  find('[data-download]').addEventListener('click', async () => {
    if (state.busy || closed) return;
    const rows = rowsNow(), cols = selected(), over = exportLimitMessage(state.format, rows.length);
    if (over) { message(over, true); return; }
    if (!rows.length || !cols.length) return;
    const meta = state.meta ? queryMeta(query, sortBy, rows.length, baseCount(), state.merge, state.normal, undefined, statusUnavailable) : [];
    state.busy = true;
    render();
    message('產生檔案中…');
    let resultMessage = '', failed = false;
    try {
      const blob = state.format === 'csv'
        ? new Blob([buildCSV(rows, cols, meta)], { type: 'text/csv;charset=utf-8' })
        : state.format === 'docx' ? await buildDOCX(rows, cols, meta, controller.signal)
          : await buildPDF(rows, cols, meta, (page, total) => {
            if (!closed) message(`產生 PDF 中（第 ${page}／${total} 頁）…`);
          }, controller.signal);
      checkAborted(controller.signal);
      download(blob, fileName(query.keyword, state.format));
      resultMessage = `已下載 ${state.format === 'docx' ? 'Word' : state.format.toUpperCase()}（${nf(rows.length)} 項）`;
    } catch (error) {
      if (error.name === 'AbortError') return;
      failed = true;
      resultMessage = error.code === 'SF_EXPORT_COMPONENT' ? error.message
        : error instanceof PDFPageError ? `PDF 產生失敗（第 ${error.page} 頁：${error.message}），已停止，未下載檔案。請改用 Word 或 CSV。`
          : '無法產生檔案，請改用其他格式。';
    } finally {
      state.busy = false;
      if (!closed) { render(); message(resultMessage, failed); }
    }
  });
  render();
  dialog.showModal();
  find('[data-close]').focus();
  // Loading a drag library is optional: arrow buttons work even when its CDN fails.
  loadScript('sortable').then(() => { if (!closed) render(); })
    .catch(error => { if (!closed) message(error.message, true); });
}

export function syncTriggerButtons(root = document) {
  root.querySelectorAll('[data-sf-export-trigger]').forEach(button => {
    if (button.disabled) button.disabled = false;
    if (button.textContent !== '輸出查詢結果') button.textContent = '輸出查詢結果';
  });
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  window.SFExport = Object.freeze({ open });
  syncTriggerButtons();
  // Observe only inserted elements containing the entry button. Text changes from
  // synchronization do not qualify, and no React state setter is called.
  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1
      && (node.matches('[data-sf-export-trigger]') || node.querySelector('[data-sf-export-trigger]'))))) {
      syncTriggerButtons();
    }
  });
  observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
}

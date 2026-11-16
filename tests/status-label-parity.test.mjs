import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { statusLabel as exportStatusLabel } from '../public/export-results-core.mjs';

// PR #309's 12 recorded statuses include 正常.
const recordedStatuses = [
  '正常',
  '疑似已下架_平台停止服務未逐筆驗證',
  '疑似已下架_雲市集工業館平台方案未持續上架未逐筆驗證',
  '疑似已下架_SME AI平台方案未持續上架未逐筆驗證',
  '疑似已下架_農業雲市集數位館方案未持續上架未逐筆驗證',
  '已下架_平台停止服務',
  '已下架_資料異常',
  '已下架_公司歇業佐證',
  '已下架_商品頁失效已逐筆驗證',
  '已下架_新創嚴選網官網完整清單連續三次未出現',
  '已下架_個別方案下架已人工查證',
  '已下架_重複資料',
];

test('index.html and export-results-core.mjs return the same status labels', async t => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const declaration = html.match(/^([ \t]*)function\s+statusLabel\s*\([^)]*\)\s*\{[\s\S]*?^\1\}[ \t]*$/m);
  assert.ok(declaration, '找不到 index.html 的 statusLabel');
  const indexStatusLabel = vm.runInNewContext(`(${declaration[0]})`, {});

  for (const input of [null, '', ...recordedStatuses, '已下架', '其他狀態']) {
    await t.test(JSON.stringify(input), () => {
      assert.strictEqual(indexStatusLabel(input), exportStatusLabel(input));
    });
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = {};
vm.runInNewContext(readFileSync(new URL('../public/example-combos.js', import.meta.url), 'utf8'), context);
vm.runInNewContext(readFileSync(new URL('../public/home-demo.js', import.meta.url), 'utf8'), context);
const { pickDemoCombo, summarizeSources } = context.HomeDemo;
const plain = value => JSON.parse(JSON.stringify(value));
const regions = ['北北基', '桃竹苗', '中彰投', '雲嘉南', '高屏', '全台灣'];
const categories = ['生產物流', '行銷推廣'];
const rows = (count, r, cat, rs = '正常') => Array.from({ length: count }, (_, i) => ({
  id: `SOL-${String(i + 1).padStart(4, '0')}`, s: `方案${i + 1}`, p: '來源甲', r, cat, rs,
}));
const eligible = items => context.ExampleCombos.getEligibleExampleCombos(items, regions, categories);

test('prefers 中部 × 生產物流 by filterRegion even when another region has more normal rows', () => {
  const items = [...rows(10, '中部', '生產物流'), ...rows(20, '北部', '行銷推廣')];
  const demo = pickDemoCombo(items, eligible(items));
  assert.equal(demo.region, '中部');
  assert.equal(demo.filterRegion, '中部');
  assert.equal(demo.category, '生產物流');
});

test('falls back to the largest regional combo before a larger nationwide combo', () => {
  const items = [...rows(9, '中部', '生產物流'), ...rows(15, '北部', '行銷推廣'), ...rows(12, '南部', '生產物流')];
  const demo = pickDemoCombo(items, eligible(items));
  assert.equal(demo.filterRegion, '北部');
  assert.equal(demo.category, '行銷推廣');
  assert.equal(demo.resultCount, 15);
});

test('falls back to the largest nationwide combo and returns null without any eligible combo', () => {
  const items = [...rows(6, '中部', '生產物流'), ...rows(7, '北部', '生產物流'),
    ...rows(5, '南部', '行銷推廣'), ...rows(5, '東部', '行銷推廣')];
  const demo = pickDemoCombo(items, eligible(items));
  assert.equal(demo.region, '全台灣');
  assert.equal(demo.filterRegion, null);
  assert.equal(demo.category, '生產物流');
  assert.equal(demo.resultCount, 13);
  assert.equal(pickDemoCombo([], []), null);
  assert.equal(pickDemoCombo(rows(9, '中部', '生產物流'), []), null);
});

test('counts every matching status for results while eligibility counts only normal rows', () => {
  const items = [...rows(10, '中部', '生產物流'), ...rows(2, '中部', '生產物流、行銷推廣', '來源平台停止服務'),
    ...rows(1, '中部', '生產物流', null), ...rows(1, '北部', '生產物流'),
    ...rows(1, '中部', ''), ...rows(1, '中部', '行銷推廣')];
  assert.equal(eligible(items).find(combo => combo.filterRegion === '中部').count, 10);
  assert.equal(pickDemoCombo(items, eligible(items)).resultCount, 13);
  const belowThreshold = [...rows(9, '中部', '生產物流'), ...rows(20, '中部', '生產物流', '來源未列出・待確認')];
  assert.equal(pickDemoCombo(belowThreshold, eligible(belowThreshold)), null);
});

test('takes the first two normal rows by ascending id and reports the first row source', () => {
  const items = rows(10, '中部', '生產物流').reverse();
  items.find(item => item.id === 'SOL-0001').p = '第一個來源';
  items.unshift({ id: 'SOL-0000', s: '不可當範例', p: '其他來源', r: '中部', cat: '生產物流', rs: '來源平台停止服務' });
  const demo = pickDemoCombo(items, eligible(items));
  assert.deepEqual(plain(demo.examples), ['方案1', '方案2']);
  assert.equal(demo.source, '第一個來源');
  assert.equal(items[0].id, 'SOL-0000');
});

test('omits missing names from the first two rows, including when both are missing', () => {
  const items = rows(10, '中部', '生產物流');
  items[0].s = null;
  assert.deepEqual(plain(pickDemoCombo(items, eligible(items)).examples), ['方案2']);
  items[1].s = ' ';
  assert.deepEqual(plain(pickDemoCombo(items, eligible(items)).examples), []);
});

test('summarizes sources by count descending then name, limits to seven, and ignores empty sources', () => {
  const names = ['來源辛', '來源庚', '來源己', '來源戊', '來源丁', '來源丙', '來源乙', '來源甲'];
  const items = names.flatMap(name => [{ p: name }, { p: name }]);
  items.push({ p: '最多來源' }, { p: '最多來源' }, { p: '最多來源' }, { p: null }, { p: '' }, { p: ' ' }, {});
  const expected = names.slice().sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  const summary = summarizeSources(items);
  assert.equal(summary.sourceCount, 9);
  assert.deepEqual(plain(summary.top), [{ name: '最多來源', count: 3 }, ...expected.slice(0, 6).map(name => ({ name, count: 2 }))]);
  assert.equal(summarizeSources(items, 2).top.length, 2);
  assert.equal(summarizeSources(items, 0).top.length, 0);
  assert.deepEqual(plain(summarizeSources([{ p: null }, {}])), { sourceCount: 0, top: [] });
});

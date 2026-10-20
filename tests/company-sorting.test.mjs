import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = path => readFileSync(new URL(path, new URL('../', import.meta.url)), 'utf8');
const companySource = read('public/index.html').split('const renderCompany = () => {')[1].split('// ===== DETAIL PAGE =====')[0];
// Execute the real pre-render grouping code and visible-row expression without a JSX dependency.
const grouping = companySource.slice(0, companySource.indexOf('        return ('));
const visibleExpression = companySource.match(/const visible = ([\s\S]*?);/)[1];
function arrange(solutions, summary = {}) {
  const context = vm.createContext({ companyResult: { company: {}, solutions, summary } });
  vm.runInContext(read('public/solution-name.js'), context);
  return vm.runInContext(`(() => {${grouping}
    return { orderedGroups, platformCount, listedTotal, allDelisted,
      visibleRows: (rows, showDelisted) => (${visibleExpression}) };
  })()`, context);
}
const ids = rows => Array.from(rows, row => row.id);
const sources = result => Array.from(result.orderedGroups, ([source]) => source);
const row = (id, status, name = id, program_type = '來源甲') => Object.freeze({ id, status, name, program_type });

const mixed = Object.freeze([
  row('a-d-m', 'delisted', null), row('b-d', 'delisted', 'B', '來源乙'),
  row('a-s-m', 'suspected', null), row('a-n-m', 'normal', '缺'),
  row('b-n-1', 'normal', 'Z', '來源乙'), row('a-s-z', 'suspected', 'Z'),
  row('a-n-z', 'normal', 'Z'), row('a-d-z', 'delisted', 'Z'),
  row('b-n-2', 'normal', 'A', '來源乙'), row('a-n-a', 'normal', 'A'),
  row('a-s-a', 'suspected', 'A'), row('b-n-3', 'normal', '缺', '來源乙'),
  row('a-d-a', 'delisted', 'A'), row('a-n-m2', 'normal', ''),
  row('a-s-m2', 'suspected', '-'), row('a-d-m2', 'delisted', '待補'),
  row('b-n-4', 'normal', 'C', '來源乙'), row('b-n-5', 'normal', 'D', '來源乙'),
]);

test('two mixed sources: normal count outranks total count; rows sort by status then missing name, stably', () => {
  const before = JSON.stringify(mixed);
  const result = arrange(mixed);
  assert.deepEqual(sources(result), ['來源乙', '來源甲']);
  const bySource = new Map(result.orderedGroups);
  assert.deepEqual(ids(result.visibleRows(bySource.get('來源甲'), true)), [
    'a-n-z', 'a-n-a', 'a-n-m', 'a-n-m2',
    'a-s-z', 'a-s-a', 'a-s-m', 'a-s-m2',
    'a-d-z', 'a-d-a', 'a-d-m', 'a-d-m2',
  ]);
  assert.deepEqual(ids(result.visibleRows(bySource.get('來源乙'), true)), [
    'b-n-1', 'b-n-2', 'b-n-4', 'b-n-5', 'b-n-3', 'b-d',
  ]);
  assert.equal(JSON.stringify(mixed), before, 'sorting must not mutate API rows or the input array');
});

test('equal normal counts use suspected count descending, ignoring delisted counts', () => {
  const result = arrange([
    row('a-n', 'normal'), row('a-d1', 'delisted'), row('a-d2', 'delisted'),
    row('b-n', 'normal', 'B', '來源乙'), row('b-s', 'suspected', 'B', '來源乙'),
  ]);
  assert.deepEqual(sources(result), ['來源乙', '來源甲']);
});

test('equal normal and suspected counts keep first-seen source order, not alphabetical order', () => {
  const result = arrange([
    row('z-n', 'normal', 'Z', 'Z來源'), row('a-n', 'normal', 'A', 'A來源'),
    row('z-s', 'suspected', 'Z', 'Z來源'), row('a-s', 'suspected', 'A', 'A來源'),
    row('a-d', 'delisted', 'A', 'A來源'),
  ]);
  assert.deepEqual(sources(result), ['Z來源', 'A來源']);
});

test('suspected-only and delisted-only sources follow sources with normal solutions', () => {
  const result = arrange([
    row('stopped', 'suspected', '停止服務', '停止平台'),
    row('off', 'delisted', '下架', '下架平台'),
    row('live', 'normal', '正常', '正常平台'),
  ]);
  assert.deepEqual(sources(result), ['正常平台', '停止平台', '下架平台']);
});

test('sorting preserves statistics and filtered group counts when delisted rows are toggled', () => {
  const summary = Object.freeze({ total: 18, normal: 9, suspected: 4, delisted: 5 });
  const result = arrange(mixed, summary);
  assert.equal(result.listedTotal, 13);
  assert.equal(result.platformCount, 2);
  assert.equal(result.allDelisted, false);
  for (const [source, rows] of result.orderedGroups) {
    const shown = result.visibleRows(rows, true);
    const hidden = result.visibleRows(rows, false);
    assert.equal(shown.length, source === '來源甲' ? 12 : 6);
    assert.equal(hidden.length, source === '來源甲' ? 8 : 5);
    assert.ok(hidden.every(row => row.status !== 'delisted'));
    assert.deepEqual(ids(hidden), ids(shown.filter(row => row.status !== 'delisted')));
  }
  assert.match(read('public/index.html'), /\[showDelisted, setShowDelisted\] = useState\(false\)/);
  assert.match(companySource, /\{visible\.length\} 筆/);
  assert.match(companySource, /\["正常", summary\.normal \|\| 0\]/);
  assert.match(companySource, /\["未逐筆確認", summary\.suspected \|\| 0\]/);
});

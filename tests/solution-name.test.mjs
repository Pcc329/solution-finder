import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('public/solution-name.js'), context);
const { isMissingSolutionName, displaySolutionName } = context;

for (const name of [null, undefined, '', '  ', '缺', ' 缺 ', '缺漏', '待補', '無', '-', '—', 'N/A', 'NA', 'null', '?', '？']) {
  test(`missing name ${JSON.stringify(name)} uses the unified label`, () => {
    assert.equal(isMissingSolutionName(name), true);
    assert.equal(displaySolutionName(name), '（名稱未提供）');
  });
}
for (const name of ['律果簽', 'HackMD', 'AI', ' AI ', '缺工管理', 'NA 平台', 'Null Analytics']) {
  test(`provided name ${JSON.stringify(name)} is preserved exactly`, () => {
    assert.equal(isMissingSolutionName(name), false);
    assert.equal(displaySolutionName(name), name);
  });
}

test('name A-Z keeps missing names last, stable, without sorting by the fallback label', () => {
  const source = read('public/index.html');
  const comparator = source.match(/results\.sort\((\(a, b\) => Number\(isMissingSolutionName\(a\.s\)\)[\s\S]+?)\);/)[1];
  const sortNames = vm.runInContext(`(${comparator})`, context);
  const rows = [null, 'HackMD', '缺', 'AI', undefined, '  ', '律果簽'].map((s, id) => ({ s, id }));
  const sorted = [...rows].sort(sortNames);
  assert.deepEqual(sorted.slice(-4).map(row => row.id), [0, 2, 4, 5]);
  assert.deepEqual(sorted.slice(0, 3).map(row => row.s), ['AI', 'HackMD', '律果簽'].sort((a, b) => a.localeCompare(b, 'zh-Hant')));
  assert.equal(rows[2].s, '缺');
});

test('all pages rendering solution names load the same helper and stylesheet', () => {
  for (const page of ['index', 'compare', 'dashboard', 'diagnosis', 'manufacturing']) {
    const source = read(`public/${page}.html`);
    assert.match(source, /<script src="\/solution-name\.js"><\/script>/);
    assert.match(source, /<link rel="stylesheet" href="\/solution-name\.css">/);
    assert.match(source, /displaySolutionName\(/);
    assert.match(source, /sf-name-missing/);
    assert.doesNotMatch(source, /未命名方案/);
  }
  assert.match(read('public/solution-name.css'), /color: #6b7280 !important/);
  assert.match(read('public/solution-name.css'), /font-weight: 400 !important/);
  assert.match(read('public/index.html'), /<script type="text\/babel">/);
});

test('same-score groups put missing names last without changing relevance priority', () => {
  const source = read('public/index.html');
  const comparator = source.match(/\.sort\((\(a, b\) => \{\s+const scoreA[\s\S]+?)\)\s+\.map/)[1];
  const sort = vm.runInContext(`(${comparator})`, context);
  const rows = [
    { item: { s: '缺' }, index: 0, relevanceScore: 100, industryScore: 0, industryKeywordScore: 0 },
    { item: { s: 'AI' }, index: 1, relevanceScore: 100, industryScore: 0, industryKeywordScore: 0 },
    { item: { s: null }, index: 2, relevanceScore: 200, industryScore: 0, industryKeywordScore: 0 },
  ];
  assert.deepEqual([...rows].sort(sort).map(row => row.index), [2, 1, 0]);
});

test('price and company groups put missing names last without reordering the groups', () => {
  const source = read('public/index.html');
  const rows = [{ s: '缺', pr: 100, c: 'A' }, { s: 'AI', pr: 100, c: 'A' }, { s: null, pr: 200, c: 'B' }];
  for (const [mode, expected] of [['price_asc', ['AI', '缺', null]], ['price_desc', [null, 'AI', '缺']], ['company_az', ['AI', '缺', null]]]) {
    const section = source.split(`sortBy === "${mode}"`)[1].split('} else')[0];
    const comparator = section.match(/results\.sort\(([\s\S]+?)\);/)[1];
    const sort = vm.runInContext(`(${comparator})`, context);
    assert.deepEqual([...rows].sort(sort).map(row => row.s), expected, mode);
  }
});

test('openROIModal normalizes stored names and preserves the missing style flag', () => {
  const source = read('public/index.html');
  const definition = source.match(/const openROIModal = (\(item\) => \{[\s\S]*?\n      \});/)[1];
  let modal;
  const roiContext = vm.createContext({ setROIModal: value => { modal = value; } });
  vm.runInContext(read('public/solution-name.js'), roiContext);
  const open = vm.runInContext(`(${definition})`, roiContext);
  for (const name of [null, undefined, '', '  ', '缺', ' 缺 ', '缺漏', '待補', '無', '-', '—', 'N/A', 'NA', 'null', '?', '？', '律果簽', 'HackMD', 'AI', ' AI ']) {
    for (const item of [{ s: name, name: 'must not override s', mo: 120 }, { name, monthlyPrice: 120 }]) {
      open(item);
      assert.equal(modal.name, displaySolutionName(name));
      assert.equal(modal.nameMissing, isMissingSolutionName(name));
      assert.equal(modal.mo, 120);
    }
  }
  const classExpression = source.match(/<p className=\{(`text-xs text-slate-500 mt-1 [^\n]+?`)\}/)[1];
  open({ s: null });
  roiContext.item = modal;
  assert.match(vm.runInContext(classExpression, roiContext), /sf-name-missing/);
  open({ s: 'HackMD' });
  roiContext.item = modal;
  assert.doesNotMatch(vm.runInContext(classExpression, roiContext), /sf-name-missing/);
});

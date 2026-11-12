import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('public/industry-vertical.js'), context);
const { matchesIndustryVertical } = context;

for (const [vertical, item] of [
  ['旅宿觀光', { s: '飯店管理系統' }],
  ['製造業', { d: '製造業' }],
  ['醫療照護', { feat: '電子病歷' }],
  ['建築營造', { cat: '工地管理' }],
  ['文化創意', { slogan: '數位展演平台' }],
]) {
  test(`${vertical} matches solution text with an empty iv`, () => {
    assert.equal(matchesIndustryVertical({ ...item, iv: '' }, vertical), true);
  });
}

test('English acronyms require uppercase and word boundaries', () => {
  assert.equal(matchesIndustryVertical({ desc: '導入 MES 系統' }, '製造業'), true);
  assert.equal(matchesIndustryVertical({ tags: ['平台', 'PLC'] }, '製造業'), true);
  assert.equal(matchesIndustryVertical({ desc: '採用BIM模型' }, '建築營造'), true);
  assert.equal(matchesIndustryVertical({ desc: 'messages and robot' }, '製造業'), false);
  assert.equal(matchesIndustryVertical({ desc: 'mes, OT, XPLC and MES2' }, '製造業'), false);
});

test('missing fields are safe and unknown verticals do not exclude solutions', () => {
  const item = { d: null, desc: undefined, feat: null, tags: [null, undefined] };
  assert.equal(matchesIndustryVertical(item, '製造業'), false);
  assert.equal(matchesIndustryVertical(item, '未來新增領域'), true);
  assert.equal(matchesIndustryVertical(item, 'constructor'), true);
});

test('the page keeps either selected vertical and still applies its other filters', () => {
  const page = read('public/index.html');
  assert.match(page, /<script src="\/industry-vertical\.js"><\/script>/);
  const predicate = page.match(/let results = allData\.filter\((item => \{[\s\S]+?\n        \})\);/)[1];
  const filters = {
    region: ['北北基'], category: [], program: [], industry_vertical: ['製造業', '醫療照護'],
    isAI: null, isStartup: null, isGov: null, pricingModel: null, maxPrice: null, keyword: null,
  };
  context.filters = filters;
  const matchesFilters = vm.runInContext(predicate, context);
  const rows = [
    { id: 1, d: '製造業', iv: '', r: '北北基' },
    { id: 2, d: '醫院', iv: '', r: '北北基' },
    { id: 3, d: '旅宿', iv: '', r: '北北基' },
    { id: 4, d: '製造業', iv: '', r: '中彰投' },
  ];
  assert.deepEqual(rows.filter(matchesFilters).map(item => item.id), [1, 2]);
  filters.industry_vertical = [];
  assert.deepEqual(rows.filter(matchesFilters).map(item => item.id), [1, 2, 3]);
});

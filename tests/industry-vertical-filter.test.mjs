import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('public/industry-vertical.js'), context);
const { matchesIndustryVertical, industryVerticalTargetScore } = context;

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

test('target industry earns one boost using the shared vocabulary and word boundaries', () => {
  assert.equal(industryVerticalTargetScore({ d: '製造業' }, ['製造業']), 50);
  assert.equal(industryVerticalTargetScore({ d: '', desc: '適用製造業' }, ['製造業']), 0);
  assert.equal(industryVerticalTargetScore({ d: ['零售', '製造業'] }, ['製造業']), 50);
  assert.equal(industryVerticalTargetScore({ d: '製造業、醫療' }, ['製造業', '醫療照護']), 50);
  assert.equal(industryVerticalTargetScore({ d: '製造業' }, []), 0);
  assert.equal(industryVerticalTargetScore({ d: null }, ['製造業']), 0);
  assert.equal(industryVerticalTargetScore({ d: '製造業' }, ['constructor']), 0);
  assert.equal(industryVerticalTargetScore({ d: '導入 MES 系統' }, ['製造業']), 50);
  assert.equal(industryVerticalTargetScore({ d: 'messages, mes, XPLC, MES2' }, ['製造業']), 0);
});

test('a vertical alone triggers relevance sorting without changing results or price ordering', () => {
  const page = read('public/index.html');
  const memo = page.match(/const filteredResults = useMemo\((\(\) => \{[\s\S]*?\n      \}), \[filters/)[1];
  vm.runInContext(read('public/solution-name.js'), context);
  const filters = {
    region: [], category: [], program: [], industry_vertical: ['製造業'],
    isAI: null, isStartup: null, isGov: null, pricingModel: null, maxPrice: null, keyword: null,
  };
  Object.assign(context, {
    filters,
    query: '',
    detectIndustryKey: () => '製造',
    getIndustryScore: () => 12,
    allData: [
      { id: 1, s: '描述符合', desc: '工廠', pr: 100 },
      { id: 2, s: '未命中', d: '零售', pr: 200 },
      { id: 3, s: '欄位符合', d: '製造業', pr: 300 },
    ],
  });
  const run = vm.runInContext(memo, context);
  for (const [sortBy, expected] of [['relevance', [3, 1]], ['price_asc', [1, 3]], ['price_desc', [3, 1]]]) {
    context.sortBy = sortBy;
    assert.deepEqual(Array.from(run(), item => item.id), expected);
  }
  filters.industry_vertical = [];
  context.sortBy = 'relevance';
  assert.deepEqual(Array.from(run(), item => item.id), [1, 2, 3]);
});

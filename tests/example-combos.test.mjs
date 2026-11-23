import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = {};
vm.runInNewContext(readFileSync(new URL('../public/example-combos.js', import.meta.url), 'utf8'), context);
const { getEligibleExampleCombos, selectDistinctExampleCombos } = context.ExampleCombos;

function rows(count, r, cat, rs = '正常') {
  return Array.from({ length: count }, () => ({ r, cat, rs }));
}

test('requires ten normal matching rows and maps example regions to search regions', () => {
  const items = [
    ...rows(10, '北部', '生產物流、行銷推廣'),
    ...rows(9, '中部', '生產物流'),
    ...rows(10, '南部', '生產物流'),
  ];
  const combos = getEligibleExampleCombos(
    items,
    ['北北基', '桃竹苗', '中彰投', '雲嘉南', '高屏'],
    ['生產物流'],
    { keepRegionLabels: true },
  );
  assert.deepEqual(Array.from(combos, ({ region, filterRegion, count }) => [region, filterRegion, count]), [
    ['北北基', '北部', 10],
    ['桃竹苗', '北部', 10],
    ['雲嘉南', '南部', 10],
    ['高屏', '南部', 10],
  ]);
});

test('counts normal solutions across all regions for 全台灣', () => {
  const items = [...rows(4, '北部', '行銷推廣'), ...rows(4, '南部', '行銷推廣'), ...rows(2, '', '行銷推廣')];
  const combos = getEligibleExampleCombos(items, ['北北基', '全台灣'], ['行銷推廣']);
  assert.equal(combos.length, 1);
  assert.equal(combos[0].region, '全台灣');
  assert.equal(combos[0].filterRegion, null);
  assert.equal(combos[0].count, 10);
});

test('excludes suspected, delisted, and missing statuses from the threshold', () => {
  const items = [
    ...rows(9, '北部', '生產物流'),
    ...rows(10, '北部', '生產物流', '疑似已下架'),
    ...rows(10, '北部', '生產物流', '已下架_平台停止服務'),
    ...rows(10, '北部', '生產物流', ''),
  ];
  assert.equal(getEligibleExampleCombos(items, ['北北基', '全台灣'], ['生產物流']).length, 0);
});

test('selects at most three examples and never repeats a category', () => {
  const combos = [
    { region: '北北基', category: '生產物流' },
    { region: '桃竹苗', category: '生產物流' },
    { region: '全台灣', category: '行銷推廣' },
    { region: '高屏', category: '協作辦公' },
    { region: '全台灣', category: '資安合規' },
  ];
  assert.deepEqual(Array.from(selectDistinctExampleCombos(combos)), [combos[0], combos[2], combos[3]]);
  assert.deepEqual(Array.from(selectDistinctExampleCombos(combos.slice(0, 3))), [combos[0], combos[2]]);
  assert.equal(selectDistinctExampleCombos([]).length, 0);
});

function renderHomeDemo(exampleCombos) {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('      const homeDemo =');
  const source = html.slice(start, html.indexOf('      const openHomeCompany', start));
  const demoContext = {};
  vm.runInNewContext(readFileSync(new URL('../public/home-demo.js', import.meta.url), 'utf8'), demoContext);
  return vm.runInNewContext(source + '({ question: demoQuestion, homeDemo })', {
    demoCombo: demoContext.HomeDemo.pickDemoCombo([], exampleCombos),
  });
}

const demoCombos = [
  { region: '北北基', filterRegion: '北部', category: '生產物流', count: 12 },
  { region: '全台灣', filterRegion: null, category: '行銷推廣', count: 20 },
];

test('homepage conversation never advertises a company scale', () => {
  const { question } = renderHomeDemo(demoCombos);
  assert.equal(question, '北部有哪些生產物流相關方案？');
  assert.doesNotMatch(question, /人以下|人企業|不限規模|\d+~\d+/);
});

test('homepage conversation uses the actual filter region in its question and search parameters', () => {
  const { question, homeDemo } = renderHomeDemo(demoCombos);
  assert.equal(question, `${homeDemo.filterRegion}有哪些${homeDemo.category}相關方案？`);
  assert.equal(renderHomeDemo(demoCombos.slice(1)).question, '全台灣有哪些行銷推廣相關方案？');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /handleQuickSearch\(\{ text: demoQuestion, filterRegion: homeDemo\.filterRegion, category: homeDemo\.category \}\)/);
  assert.match(html, /homeDemo\.filterRegion !== null && <span[^>]*>區域：\{homeDemo\.region\}/);
});

test('eligible chip candidates deduplicate the same filter region and category', () => {
  const combos = getEligibleExampleCombos(
    rows(10, '北部', '生產物流'),
    ['北北基', '桃竹苗'],
    ['生產物流'],
  );
  assert.deepEqual(Array.from(combos, ({ filterRegion, category, count }) => [filterRegion, category, count]), [
    ['北部', '生產物流', 10],
  ]);
});

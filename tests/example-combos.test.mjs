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
    ...rows(9, '中部', ['生產物流']),
    ...rows(10, '南部', ['生產物流']),
  ];
  const combos = getEligibleExampleCombos(items, ['北北基', '桃竹苗', '中彰投', '雲嘉南', '高屏'], ['生產物流']);
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

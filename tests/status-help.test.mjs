import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = {};
vm.runInNewContext(readFileSync(new URL('../public/status-help.js', import.meta.url), 'utf8'), context);
const { delistedReason, sourceStatusHelp } = context;

const reasons = [
  ['已下架_平台停止服務', '平台關閉，已逐筆確認',
    '臺灣雲市集已全站停止服務。此方案有商品頁網址，已於 2026-08-20 逐筆查證確認不在架。同平台其他沒有網址的方案無法逐筆查證，標示為「來源平台停止服務」。'],
  ['已下架_資料異常', '資料內容不足',
    '此筆資料為制式文案，缺少價格、網址、適用產業等實質內容；原始平台已關閉、無法補齊，2026-09-10 經人工複查後不予顯示。'],
  ['已下架_公司歇業佐證', '公司已解散或廢止',
    '依經濟部商工登記資料（2026-08-25 查證），公司已解散、廢止或清算完結。因合併而解散的公司不列入，因為業務可能由存續公司承接。'],
  ['已下架_商品頁失效已逐筆驗證', '商品頁已失效',
    '逐筆開啟來源平台上的商品頁，確認已失效（例如導回首頁）。'],
  ['已下架_新創嚴選網官網完整清單連續三次未出現', '官網清單查核三次皆未出現',
    '新創嚴選網官網的完整方案清單，於 2026-09-21、09-30、10-15 三次查核，此方案皆未出現；並已比對名稱，排除改名的可能，因此判定已下架。'],
  ['已下架_個別方案下架已人工查證', '經人工查證已下架',
    '經人工查證，來源平台上的此方案已下架。'],
  ['已下架_重複資料', '與其他紀錄重複',
    '此筆與資料庫中另一筆紀錄重複，已保留另一筆；方案本身不一定已停止提供。'],
];

for (const [status, short, detail] of reasons) {
  test(`delistedReason: ${status}`, () => {
    assert.deepEqual({ ...delistedReason(status) }, { short, detail });
  });
}

for (const status of ['已下架_測試', '已下架']) {
  test(`delistedReason uses the generic explanation for ${status}`, () => {
    assert.deepEqual({ ...delistedReason(status) }, {
      short: '',
      detail: '此方案已判定下架，判定依據請參考資料說明頁。',
    });
  });
}

for (const status of ['正常', '疑似已下架_平台停止服務未逐筆驗證', null, '']) {
  test(`delistedReason returns null for ${JSON.stringify(status)}`, () => {
    assert.equal(delistedReason(status), null);
  });
}

test('sourceStatusHelp names the platform when available', () => {
  assert.equal(sourceStatusHelp('來源未列出・待確認', '雲市集工業館'),
    '來源平台（雲市集工業館）仍在運作，但此方案已未再出現在平台上，尚未逐筆確認是否仍提供。');
});

test('sourceStatusHelp omits the parentheses when the platform name is missing', () => {
  for (const name of ['', null, undefined, ' ']) {
    assert.equal(sourceStatusHelp('來源未列出・待確認', name),
      '來源平台仍在運作，但此方案已未再出現在平台上，尚未逐筆確認是否仍提供。');
  }
});

test('sourceStatusHelp describes a discontinued platform', () => {
  assert.equal(sourceStatusHelp('來源平台停止服務', '臺灣雲市集'),
    '來源平台已停止服務，此方案是否仍由廠商提供尚未逐筆確認。');
});

test('sourceStatusHelp returns null for labels without help', () => {
  assert.equal(sourceStatusHelp('正常', '雲市集工業館'), null);
  assert.equal(sourceStatusHelp('', '雲市集工業館'), null);
  assert.equal(sourceStatusHelp('已下架', '雲市集工業館'), null);
});

(() => {
  const delistedReasons = new Map([
    ['已下架_平台停止服務', {
      short: '平台關閉，已逐筆確認',
      detail: '臺灣雲市集已全站停止服務。此方案有商品頁網址，已於 2026-08-20 逐筆查證確認不在架。同平台其他沒有網址的方案無法逐筆查證，標示為「來源平台停止服務」。',
    }],
    ['已下架_資料異常', {
      short: '資料內容不足',
      detail: '此筆資料為制式文案，缺少價格、網址、適用產業等實質內容；原始平台已關閉、無法補齊，2026-09-10 經人工複查後不予顯示。',
    }],
    ['已下架_公司歇業佐證', {
      short: '公司已解散或廢止',
      detail: '依經濟部商工登記資料（2026-08-25 查證），公司已解散、廢止或清算完結。因合併而解散的公司不列入，因為業務可能由存續公司承接。',
    }],
    ['已下架_商品頁失效已逐筆驗證', {
      short: '商品頁已失效',
      detail: '逐筆開啟來源平台上的商品頁，確認已失效（例如導回首頁）。',
    }],
    ['已下架_新創嚴選網官網完整清單連續三次未出現', {
      short: '官網清單查核三次皆未出現',
      detail: '新創嚴選網官網的完整方案清單，於 2026-09-21、09-30、10-15 三次查核，此方案皆未出現；並已比對名稱，排除改名的可能，因此判定已下架。',
    }],
    ['已下架_個別方案下架已人工查證', {
      short: '經人工查證已下架',
      detail: '經人工查證，來源平台上的此方案已下架。',
    }],
    ['已下架_重複資料', {
      short: '與其他紀錄重複',
      detail: '此筆與資料庫中另一筆紀錄重複，已保留另一筆；方案本身不一定已停止提供。',
    }],
  ]);

  function delistedReason(recordStatus) {
    const status = String(recordStatus ?? '');
    if (!status.startsWith('已下架')) return null;
    return delistedReasons.get(status) ?? {
      short: '',
      detail: '此方案已判定下架，判定依據請參考資料說明頁。',
    };
  }

  function sourceStatusHelp(label, sourceName) {
    if (label === '來源未列出・待確認') {
      const name = String(sourceName ?? '').trim();
      const platform = name ? `來源平台（${name}）` : '來源平台';
      return `${platform}仍在運作，但此方案已未再出現在平台上，尚未逐筆確認是否仍提供。`;
    }
    if (label === '來源平台停止服務') {
      return '來源平台已停止服務，此方案是否仍由廠商提供尚未逐筆確認。';
    }
    return null;
  }

  globalThis.delistedReason = delistedReason;
  globalThis.sourceStatusHelp = sourceStatusHelp;
})();

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const links = [
  ['/', '首頁搜尋'],
  ['/sources.html', '資料來源'],
  ['/dashboard.html', '知識庫'],
  ['/manufacturing.html', '方案探索'],
];
const pages = [
  ['index', false],
  ['sources', true],
  ['dashboard', true],
  ['manufacturing', true],
  ['compare', false],
  ['strategy-guide', false],
  ['diagnosis', false],
];

for (const [page, isDestination] of pages) {
  test(page + ' renders the shared disclosure navigation', () => {
    const html = readFileSync(new URL('../public/' + page + '.html', import.meta.url), 'utf8');
    const nav = html.match(/<nav id="global-nav">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav);
    const buttonMarkup = nav.match(/<button\b((?:\{[^{}]*\}|[^>{])*)>([\s\S]*?)<\/button>/);
    const button = buttonMarkup?.[1];
    assert.ok(button);
    assert.match(button, /\baria-label="選單"/);
    assert.doesNotMatch(buttonMarkup[0], /更多功能/);
    assert.match(buttonMarkup[2], /<svg\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>/);
    assert.match(buttonMarkup[2], /<span (?:class|className)="global-nav-avatar" data-sf-account-avatar><\/span>/);
    assert.match(button, /\btype="button"/);
    assert.match(button, /\baria-expanded=(?:"false"|\{open\})/);
    assert.match(button, /\baria-controls="global-nav-menu"/);

    const menu = nav.match(/<div id="global-nav-menu"[^>]*\bhidden(?:=\{!open\})?>([\s\S]*?<div (?:class|className)="global-nav-account-actions" data-sf-account-actions><\/div>)\s*<\/div>/);
    assert.ok(menu, 'links must be inside a disclosure panel that starts hidden');
    assert.match(menu[1], /^\s*<div (?:class|className)="global-nav-account" data-sf-account-identity><\/div>/);
    assert.match(menu[1], /<p (?:class|className)="global-nav-section">功能<\/p>/);
    assert.match(menu[1], /<div (?:class|className)="global-nav-account-actions" data-sf-account-actions><\/div>$/);
    assert.doesNotMatch(nav.replace(menu[0], ''), /global-nav-link/);
    assert.doesNotMatch(nav, /global-nav-link active/);

    const anchors = Array.from(menu[1].matchAll(/<a\b([^>]+)>([^<]+)<\/a>/g));
    assert.deepEqual(anchors.map(([, attrs, text]) => [attrs.match(/href="([^"]+)"/)[1], text]), links);
    for (const [, attrs] of anchors) {
      const isCurrent = isDestination && attrs.includes('href="/' + page + '.html"');
      assert.equal(attrs.includes('aria-current="page"'), isCurrent);
    }
    assert.equal(/<script src="\/global-nav\.js"><\/script>/.test(html), page !== 'index');
  });
}

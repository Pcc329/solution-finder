import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const links = [
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
    const button = nav.match(/<button\b((?:\{[^{}]*\}|[^>{])*)>\s*更多功能\s*<\/button>/)?.[1];
    assert.ok(button);
    assert.match(button, /\btype="button"/);
    assert.match(button, /\baria-expanded=(?:"false"|\{open\})/);
    assert.match(button, /\baria-controls="global-nav-menu"/);

    const menu = nav.match(/<div id="global-nav-menu"[^>]*\bhidden(?:=\{!open\})?>([\s\S]*?)<\/div>/);
    assert.ok(menu, 'links must be inside a disclosure panel that starts hidden');
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

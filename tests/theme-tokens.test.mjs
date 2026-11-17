import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readPublic = file => readFileSync(new URL('../public/' + file, import.meta.url), 'utf8');
const pages = ['index', 'sources', 'dashboard', 'manufacturing', 'compare', 'strategy-guide', 'diagnosis', 'feedback'];

test('Tiffany theme defines all approved tokens', () => {
  const declarations = Array.from(readPublic('theme.css').matchAll(/(--sf-[\w-]+):\s*(#[\da-f]{6});/gi));
  assert.deepEqual(Object.fromEntries(declarations.map(([, token, color]) => [token, color])), {
    '--sf-accent-50': '#E1F7F6',
    '--sf-accent-100': '#C4EFED',
    '--sf-accent-200': '#9BE3E0',
    '--sf-accent-400': '#3CCBC6',
    '--sf-accent-500': '#0ABAB5',
    '--sf-accent-600': '#08A39F',
    '--sf-accent-700': '#087F7B',
    '--sf-accent-800': '#085F5C',
    '--sf-on-accent': '#0B2B2A',
    '--sf-hero-bg': '#0B3B3A',
    '--sf-hero-kicker': '#6FDCD8',
    '--sf-hero-lead': '#D5E4E4',
    '--sf-hero-chip-border': '#2A7B78',
    '--sf-hero-chip-text': '#BFEDEB',
  });
});

for (const page of pages) {
  test(page + ' loads the theme before local CSS and uses approved text colors', () => {
    const html = readPublic(page + '.html');
    const linkIndex = html.indexOf('<link rel="stylesheet" href="/theme.css">');
    assert.ok(linkIndex >= 0 && linkIndex < html.indexOf('<style>'));
    const classStrings = html.matchAll(/"([^"\r\n]+)"|'([^'\r\n]+)'/g);
    for (const [, doubleQuoted, singleQuoted] of classStrings) {
      const tokens = (doubleQuoted ?? singleQuoted).split(/\s+/);
      if (tokens.some(token => /(?:^|:)bg-brand-(?:500|600)$/.test(token))) {
        assert.ok(!tokens.some(token => /(?:^|:)text-white$/.test(token)), tokens.join(' '));
      }
      if (tokens.includes('bg-brand-50')) {
        assert.ok(!tokens.includes('text-brand-700'), tokens.join(' '));
      }
      if (tokens.includes('hover:bg-brand-50') && tokens.includes('text-brand-700')) {
        assert.ok(tokens.includes('hover:text-brand-800'), tokens.join(' '));
      }
    }
  });
}

test('normal solution status keeps its PR #310 colors', () => {
  assert.match(readPublic('index.html'), /const statusStyle = solution\.status === "delisted" \? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800";/);
});

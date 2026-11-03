import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../public/sources.html', import.meta.url), 'utf8');
const sourceCards = [...html.matchAll(/<[a-z][^>]*\sdata-source-card(?=[\s>])[^>]*>/gi)]
  .map(([tag]) => tag.match(/\sdata-program-types="([^"]+)"/)?.[1]);

test('source cards define exactly ten distinct program types', () => {
  assert.equal(sourceCards.length, 10);
  assert.ok(sourceCards.every(Boolean), 'each source card must specify its program type');
  assert.equal(new Set(sourceCards).size, sourceCards.length);
});

test('agri digital and AI halls each have a source card', () => {
  assert.ok(sourceCards.includes('農業雲市集-數位館'));
  assert.ok(sourceCards.includes('農業雲市集-AI館'));
});

test('subtitle and structure source counts match the number of source cards', () => {
  const subtitle = html.match(/<p\b[^>]*class="subtitle"[^>]*>([\s\S]*?)<\/p>/)?.[1];
  assert.ok(subtitle, 'page must have a subtitle');
  const count = subtitle.match(/收錄 (\d+) 大方案來源/);
  assert.ok(count, 'subtitle must state the source count in Arabic numerals');
  assert.equal(Number(count[1]), sourceCards.length);

  const structureCount = html.match(/source\s*:\s*\{[^}]*\bt\s*:\s*"來源平台"\s*,\s*s\s*:\s*"目前 (\d+) 個"/);
  assert.ok(structureCount, 'structure source node must state its source count');
  assert.equal(Number(structureCount[1]), sourceCards.length);
});

test('unclassified note refers to ten source groups', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, script]) => script).join('\n');
  assert.match(scripts, /unclassifiedNote\.textContent\s*=\s*[^;]*十大方案來源。/);
  assert.doesNotMatch(html, /九大方案來源/);
});

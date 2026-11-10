import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../public/sources.html', import.meta.url), 'utf8');
const sourceCards = [...html.matchAll(/<[a-z][^>]*\sdata-source-card(?=[\s>])[^>]*>/gi)]
  .map(([tag]) => tag.match(/\sdata-program-types="([^"]+)"/)?.[1]);

test('source cards define exactly eleven distinct program types', () => {
  assert.equal(sourceCards.length, 11);
  assert.ok(sourceCards.every(Boolean), 'each source card must specify its program type');
  assert.equal(new Set(sourceCards).size, sourceCards.length);
});

test('agri digital and AI halls each have a source card', () => {
  assert.ok(sourceCards.includes('農業雲市集-數位館'));
  assert.ok(sourceCards.includes('農業雲市集-AI館'));
});

test('rainforest has its own source card with the manual verification disclosure', () => {
  const card = html.match(/<article class="card detail-card">(?:(?!<\/article>)[\s\S])*?<h3>智慧雨林擴散案（廠商官網）<\/h3>[\s\S]*?<\/article>/)?.[0];
  assert.ok(card);
  assert.match(card, /data-program-types="智慧雨林擴散案（廠商官網）"/);
  assert.match(card, /方案內容為廠商自述，未經平台審核/);
});

test('subtitle and structure source counts match the number of source cards', () => {
  const subtitle = html.match(/<p\b[^>]*class="subtitle"[^>]*>([\s\S]*?)<\/p>/)?.[1];
  assert.ok(subtitle, 'page must have a subtitle');
  const count = subtitle.match(/收錄 (\d+) 大方案來源/);
  assert.ok(count, 'subtitle must state the source count in Arabic numerals');
  assert.equal(Number(count[1]), sourceCards.length);

  const structureCount = html.match(/source\s*:\s*\{[^}]*\bt\s*:\s*"方案來源"\s*,\s*s\s*:\s*"目前 (\d+) 個"/);
  assert.ok(structureCount, 'structure source node must state its source count');
  assert.equal(Number(structureCount[1]), sourceCards.length);
});

test('unclassified note refers to the listed sources', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, script]) => script).join('\n');
  assert.match(scripts, /unclassifiedNote\.textContent\s*=\s*[^;]*未列入上述方案來源。/);
  assert.doesNotMatch(html, /九大方案來源/);
});

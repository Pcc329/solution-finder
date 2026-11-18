import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('public copy uses the current database brand', () => {
  const publicDir = new URL('../public/', import.meta.url);
  const obsoleteCopy = /SF 未收錄|本SF資料庫|SF查詢結果|資服業產業資料庫/;
  const files = readdirSync(publicDir, { recursive: true }).filter(path => /\\.(?:html|js|mjs|svg)$/i.test(path));
  for (const path of files) {
    const source = readFileSync(new URL(path.replaceAll('\\\\', '/'), publicDir), 'utf8');
    assert.doesNotMatch(source, obsoleteCopy, path);
  }
});

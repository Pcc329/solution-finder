const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

const html = readFileSync(path.join(__dirname, '../public/index.html'), 'utf8').replace(/\r\n/g, '\n');
const fetchAllSource = html.match(/(async function fetchAll\(\) \{[\s\S]*?\n        \})\n        fetchAll\(\);/)[1];
const countExpression = html.split('\n').find(line => line.includes('收錄 <span'))
  .match(/\{([^{}]+allData\.length\.toLocaleString\(\))\}/)[1];

function harness(fetcher) {
  const state = { allData: [], loading: true, error: null };
  const requests = [];
  const context = vm.createContext({
    ...state,
    fetch: async url => { requests.push(url); return fetcher(url); },
    setAllData: value => { context.allData = value; },
    setLoading: value => { context.loading = value; },
    setError: value => { context.error = value; },
  });
  vm.runInContext(fetchAllSource, context);
  return {
    context,
    requests,
    load: () => vm.runInContext('fetchAll()', context),
    count: () => vm.runInContext(countExpression, context),
  };
}

test('mock /api/solutions HTTP 500: catch clears loading, count stays unknown', async () => {
  const app = harness(() => ({ ok: false, status: 500 }));
  await app.load();
  assert.deepEqual(app.requests, ['/api/solutions']);
  assert.equal(app.context.loading, false);
  assert.equal(app.context.error, 'API error: 500');
  assert.equal(app.context.allData.length, 0);
  assert.equal(app.count(), '—');
});

test('network rejection also leaves the count unknown', async () => {
  const app = harness(() => { throw new Error('Mock network failure'); });
  await app.load();
  assert.equal(app.context.loading, false);
  assert.equal(app.context.error, 'Mock network failure');
  assert.equal(app.count(), '—');
});

test('pending request is unknown even with existing data', () => {
  const app = harness(() => {});
  assert.equal(app.count(), '—');
  app.context.allData = [{ id: 'existing' }];
  assert.equal(app.count(), '—');
});

test('successful empty response displays a genuine zero', async () => {
  const app = harness(() => ({ ok: true, json: async () => [] }));
  await app.load();
  assert.equal(app.context.loading, false);
  assert.equal(app.context.error, null);
  assert.equal(app.count(), '0');
});

test('successful response displays the formatted length', async () => {
  const app = harness(() => ({ ok: true, json: async () => Array.from({ length: 2268 }, (_, id) => ({ id })) }));
  await app.load();
  assert.equal(app.context.loading, false);
  assert.equal(app.context.error, null);
  assert.equal(app.count(), '2,268');
});

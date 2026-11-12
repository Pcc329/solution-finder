import assert from 'node:assert/strict'
import { test } from 'node:test'
import { callTool, createSfServer, mockDb, priceRange } from './quota-test-helpers.mjs'

const detailCalls = [
  ['search_solutions', {}, 2],
  ['search_companies', {}, 3],
  ['get_solution', { solution_id: 'S1' }, 1],
  ['get_solutions', { solution_ids: ['S1', 'S2', 'missing', 'S1'] }, 2],
]
const otherCalls = [['describe_data', {}, 0], ['data_status', {}, 0], ['whoami', {}, 0], ['count_solutions', {}, 0]]
const quotaError = '今日查詢明細已達上限（300 筆），每日 00:00 重置。如有盤點需求，請洽資料維護者。'
const quotaNextSteps = ['縮小查詢條件', '明日再查', '洽資料維護者']

test('over-limit check blocks all four detail handlers and skips consumption', async () => {
  const db = mockDb({ rpc: { sf_mcp_quota_check: () => ({ data: [{ daily_limit: 300, rows_today: 300, over_limit: true }] }) } })
  for (const [name, args] of detailCalls) {
    db.calls.length = 0
    const { result, data } = await callTool(createSfServer(db), name, args)
    assert.equal(result.isError, true)
    assert.deepEqual(data, { error: quotaError, next_step: quotaNextSteps })
    assert.deepEqual(db.calls.map(call => call.name), ['sf_mcp_touch', 'sf_mcp_quota_check'])
  }
  for (const [name, args] of otherCalls) {
    const { result } = await callTool(createSfServer(db), name, args)
    assert.equal(result.isError, undefined, name)
  }
})

test('quota check 42501 blocks; other errors log and let the handler run', async t => {
  t.mock.method(console, 'error', () => {})
  for (const code of ['42501', '08006']) {
    const db = mockDb({ rpc: { sf_mcp_quota_check: () => ({ error: { code, message: 'private check error' } }) } })
    const { result, data } = await callTool(createSfServer(db), 'search_solutions')
    if (code === '42501') {
      assert.equal(result.isError, true)
      assert.equal(data.error, '此帳號未開通 SF資料庫查詢權限，請洽管理者。')
      assert.deepEqual(db.calls.map(call => call.name), ['sf_mcp_touch', 'sf_mcp_quota_check'])
    } else {
      assert.equal(result.isError, undefined)
      assert.equal(data.returned, 2)
      assert.equal(db.calls.at(-1).name, 'sf_mcp_quota_consume')
    }
    assert.doesNotMatch(result.content[0].text, /private check error/)
  }
  assert.equal(console.error.mock.callCount(), 2)
})

test('all eight successful handlers record exactly one call and their actual row usage', async () => {
  for (const [name, args, rows] of [...detailCalls, ...otherCalls]) {
    const db = mockDb()
    await callTool(createSfServer(db), name, args)
    const consumes = db.calls.filter(call => call.name === 'sf_mcp_quota_consume')
    assert.deepEqual(consumes, [{ name: 'sf_mcp_quota_consume', args: { p_tool: name, p_rows: rows } }])
    assert.deepEqual(db.calls.at(-1), consumes[0])
    const expectedChecks = detailCalls.some(([tool]) => tool === name) || name === 'whoami' ? 1 : 0
    assert.equal(db.calls.filter(call => call.name === 'sf_mcp_quota_check').length, expectedChecks, name)
  }
})

test('handler failures skip consumption and consume failures keep the successful result', async t => {
  t.mock.method(console, 'error', () => {})
  const failedHandler = mockDb({ rpc: { sf_search_solutions: () => ({ error: { message: 'search failed' } }) } })
  assert.equal((await callTool(createSfServer(failedHandler), 'search_solutions')).result.isError, true)
  assert.equal(failedHandler.calls.some(call => call.name === 'sf_mcp_quota_consume'), false)
  const failedConsume = mockDb({ rpc: { sf_mcp_quota_consume: () => { throw new Error('consume failed') } } })
  assert.equal((await callTool(createSfServer(failedConsume), 'search_solutions')).data.returned, 2)
  assert.match(console.error.mock.calls[1].arguments[0], /sf_mcp_quota_consume/)
})

test('offset caps and company page size validate, forward the limit and stop pagination at the boundary', async () => {
  const companies = Array.from({ length: 10 }, (_, i) => ({
    company_key: 'C' + i, companies_total: 200, solutions_total: 1000, solutions_count: 50,
    solutions: Array.from({ length: 5 }, (_, j) => ({ id: `S${i}-${j}`, name: '方案', price: 50000 })),
  }))
  const db = mockDb({ rpc: { sf_search_companies: () => ({ data: companies }) } })
  const server = createSfServer(db)
  const tools = server._registeredTools
  assert.equal(tools.search_solutions.inputSchema.safeParse({ offset: 201 }).success, false)
  assert.equal(tools.search_companies.inputSchema.safeParse({ offset: 101 }).success, false)
  assert.equal(tools.search_companies.inputSchema.safeParse({ limit: 11 }).success, false)
  const note = '已達可翻頁上限，請加條件縮小範圍。'
  for (const [name, edge, limit] of [['search_solutions', 200, 2], ['search_companies', 100, 10]]) {
    const boundary = await callTool(server, name, { offset: edge - limit })
    assert.equal(boundary.data.next_offset, edge)
    assert.equal(boundary.data.notes.includes(note), false)
    const stopped = await callTool(server, name, { offset: edge })
    assert.equal(stopped.data.next_offset, null)
    assert.ok(stopped.data.notes.includes(note))
  }
  assert.equal(db.calls.find(call => call.name === 'sf_search_companies').args.p_limit, 10)
  assert.deepEqual(db.calls.at(-1).args, { p_tool: 'search_companies', p_rows: 50 })
  await callTool(createSfServer(mockDb({ rpc: {
    sf_search_companies: args => {
      assert.equal(args.p_limit, 1)
      return { data: companies.slice(0, 1) }
    },
  } })), 'search_companies', { limit: 1 })
})

test('price ranges cover every boundary, lists omit exact values and details retain them', async () => {
  const cases = [
    [0, '未提供'], [null, '未提供'], ['10000', '未提供'], [NaN, '未提供'],
    [9999, '1萬以下'], [10000, '1～5萬'], [49999, '1～5萬'],
    [50000, '5～10萬'], [99999, '5～10萬'], [100000, '10～30萬'], [299999, '10～30萬'],
    [300000, '30～100萬'], [999999, '30～100萬'], [1000000, '100萬以上'],
  ]
  for (const [price, range] of cases) assert.equal(priceRange(price), range)
  const server = createSfServer(mockDb())
  const list = (await callTool(server, 'search_solutions')).data.results[0]
  assert.equal(list.price_range, '5～10萬')
  assert.equal(list.monthly_price_range, '1萬以下')
  const companies = (await callTool(server, 'search_companies')).data
  const preview = companies.companies[0].solutions[0]
  assert.equal(preview.price_range, '10～30萬')
  assert.equal('monthly_price_range' in preview, false)
  assert.ok(companies.notes.includes('月費級距請以 get_solutions 查詢方案明細'))
  for (const row of [list, preview]) {
    assert.equal('price' in row, false)
    assert.equal('monthly_price' in row, false)
  }
  const batch = (await callTool(server, 'get_solutions', { solution_ids: ['S1'] })).data.results[0]
  const single = (await callTool(server, 'get_solution', { solution_id: 'S1' })).data.solution
  for (const row of [batch, single]) {
    assert.equal(row.price, 50000)
    assert.equal(row.monthly_price, 9999)
  }
})

test('whoami includes usage on success and omits it when quota lookup fails', async t => {
  const normal = await callTool(createSfServer(mockDb()), 'whoami')
  assert.deepEqual(normal.data.quota, { daily_limit: 300, rows_today: 23 })
  assert.equal(normal.data.server_version, '1.4.0')
  t.mock.method(console, 'error', () => {})
  const db = mockDb({ rpc: { sf_mcp_quota_check: () => ({ error: { code: '42501' } }) } })
  const failure = await callTool(createSfServer(db), 'whoami')
  assert.equal(failure.result.isError, undefined)
  assert.equal('quota' in failure.data, false)
  assert.deepEqual(db.calls.at(-1).args, { p_tool: 'whoami', p_rows: 0 })
})

test('per-minute enforcement is on by default and runs before the daily check', async () => {
  const db = mockDb({ rpc: { sf_mcp_touch: () => ({ data: [{ over_limit: true, limit_per_minute: 30 }] }) } })
  const server = createSfServer(db, { now: () => new Date('2026-11-12T00:00:17Z') })
  const { result, data } = await callTool(server, 'search_solutions')
  assert.equal(result.isError, true)
  assert.equal(data.error, '每分鐘最多 30 次查詢，請約 43 秒後再試')
  assert.deepEqual(db.calls.map(call => call.name), ['sf_mcp_touch'])
})

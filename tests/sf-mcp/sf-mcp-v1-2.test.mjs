import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { createMcpHandler } from '@modelcontextprotocol/server'

const root = new URL('../../', import.meta.url)
const source = readFileSync(new URL('supabase/functions/sf-mcp/index.ts', root), 'utf8').replace(/\r\n/g, '\n')
// Load the actual Edge Function with its exact SDK/Zod versions, without OAuth/serve or any network/database.
const testSource = source.split('Deno.serve(')[0]
  .replace(/^import .*\n/gm, (line) => {
    if (line.includes('npm:@modelcontextprotocol/server@2.0.0')) return `import { McpServer } from '${import.meta.resolve('@modelcontextprotocol/server')}'\n`
    if (line.includes('npm:zod@4.6.5')) return `import { z } from '${import.meta.resolve('zod')}'\n`
    return ''
  })
const { createSfServer } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(testSource)).toString('base64')}`)

const solution = (extra = {}) => ({
  solution_id: 'SOL-MOCK-1', solution_name: 'Mock AI 方案', company_id: 'MOCK-C1', company_name: 'Mock 廠商',
  program_type: '測試來源', industry_category: '協作辦公', region: '北部', company_city: '臺北市',
  has_ai: true, is_startup: false, is_gov: true, price: 1000, monthly_price: null, pricing_model: ['訂閱制'],
  slogan: '測試標語', description_short: '測試摘要', record_status: null, score: 100,
  total_matches: 390, suspected_total: 30, city_unknown_count: 12, ...extra,
})
const company = (extra = {}) => ({
  company_key: 'MOCK-C1', company_id: 'MOCK-C1', company_name: 'Mock 廠商', company_city: '臺北市', company_region: '北部',
  first_rank: 1, solutions_count: 9, suspected_count: 2,
  solutions: [{ id: 'SOL-MOCK-1', name: 'Mock AI 方案', source: '測試來源', price: 1000, pricing_model: ['訂閱制'], status: null, score: 100 }],
  companies_total: 152, solutions_total: 390, suspected_total: 30, city_unknown_count: 12, ...extra,
})
function mockDb({ rpc = {}, tables = {}, touch, fromError, throwRpc, throwTouch } = {}) {
  const calls = []
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: { id: 'mock-user', email: 'signed-in-user@example.invalid' } }, error: null }) },
    async rpc(name, args) {
      calls.push({ rpc: name, args })
      if (name === 'sf_mcp_touch') {
        if (throwTouch) throw new Error('private connection string')
        return touch ?? { data: [{ window_calls: 1, limit_per_minute: 30, over_limit: false }], error: null }
      }
      if (throwRpc) throw new Error('SELECT secret FROM private; postgresql://user:password@host/db\nstack')
      const values = {
        sf_search_solutions: [solution()], sf_search_companies: [company()], sf_data_status: [{ total_count: 10, normal_count: 8, suspected_count: 1, delisted_count: 1 }],
        sf_data_coverage: [{ active_solutions: 9, company_region_missing: 1, service_region_missing: 2, price_missing: 3 }], sf_status_reasons: [],
      }
      return { data: rpc[name] ?? values[name], error: null }
    },
    from(table) {
      const call = { table, operations: [] }
      calls.push(call)
      let single = false
      const query = {
        then(resolve, reject) {
          const defaults = { solutions: [solution({ target_industry: ['製造；金融', '零售, 餐飲'] })], companies: [{ company_id: 'MOCK-C1', city: '高雄市', it_code_rank: 1, tax_primary_name: '程式設計' }], awards: [{ company_id: 'MOCK-C1', award_category: '國際級' }], contacts: [{ contact_name: '測試', title: '顧問', office_phone: '02-test' }], company_tax_industry: [], gov_registrations: [] }
          const data = tables[table] ?? defaults[table] ?? []
          return Promise.resolve({ data: single ? data[0] ?? null : data, count: table === 'solutions' ? 10 : 1, error: fromError?.[table] ? { message: 'SQL private error' } : null }).then(resolve, reject)
        },
      }
      for (const method of ['select', 'in', 'eq', 'order', 'limit', 'or', 'maybeSingle']) {
        query[method] = (...args) => { call.operations.push([method, ...args]); if (method === 'maybeSingle') single = true; return query }
      }
      return query
    },
  }
}
async function callTool(db, name, args = {}, options) {
  const server = createSfServer(db, options)
  const tool = server._registeredTools[name]
  const parsed = await server.validateToolInput(tool, args, name)
  const result = await server.executeToolHandler(tool, parsed, {})
  await server.validateToolOutput(tool, result, name)
  if (!result.isError) {
    assert.equal(tool.outputSchema.safeParse(result.structuredContent).success, true)
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
  }
  return { server, tool, result, data: JSON.parse(result.content[0].text) }
}

test('eight real SDK registrations advertise Chinese title and object output schemas', () => {
  const tools = createSfServer(mockDb())._registeredTools
  assert.deepEqual(Object.values(tools).map((t) => t.title), ['資料說明', '搜尋方案', '依廠商搜尋', '方案詳情', '批次方案詳情', '資料現況', '我是誰', '方案筆數'])
  for (const tool of Object.values(tools)) {
    assert.equal(tool.outputSchemaJson.type, 'object')
    assert.equal(tool.annotations.readOnlyHint, true)
    assert.doesNotMatch(tool.description, /300 筆/)
  }
})
test('real SDK HTTP tools/list and tools/call preserve structured/text responses', async () => {
  const db = mockDb()
  const handler = createMcpHandler(() => createSfServer(db))
  const request = async (method, params = {}) => {
    const response = await handler.fetch(new Request('http://localhost/mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }))
    assert.equal(response.status, 200)
    const text = await response.text()
    const payload = text.startsWith('event:') || text.startsWith('data:') ? JSON.parse(text.split('\n').find((line) => line.startsWith('data:')).slice(5)) : JSON.parse(text)
    assert.equal(payload.error, undefined, text)
    return payload.result
  }
  try {
    const list = await request('tools/list')
    assert.equal(list.tools.length, 8)
    assert.equal(list.tools.every((tool) => tool.title && tool.outputSchema.type === 'object'), true)
    const result = await request('tools/call', { name: 'search_companies', arguments: { city: ['臺北市'] } })
    assert.equal(result.isError, undefined)
    assert.deepEqual(result.structuredContent, JSON.parse(result.content[0].text))
    assert.equal(result.structuredContent.companies_total, 152)
  } finally {
    await handler.close()
  }
})
for (const [name, args] of [
  ['describe_data', {}], ['search_solutions', {}], ['search_companies', {}], ['get_solution', { solution_id: 'SOL-MOCK-1' }],
  ['get_solutions', { solution_ids: ['SOL-MOCK-1'] }], ['data_status', {}], ['whoami', {}], ['count_solutions', {}],
]) {
  test(`${name}: success validates against actual outputSchema; touch exactly once before queries`, async () => {
    const db = mockDb()
    const { result } = await callTool(db, name, args)
    assert.notEqual(result.isError, true)
    assert.equal(db.calls[0].rpc, 'sf_mcp_touch')
    assert.equal(db.calls.filter((c) => c.rpc === 'sf_mcp_touch').length, 1)
    if (name === 'whoami') assert.equal(result.structuredContent.email, 'signed-in-user@example.invalid')
    else assert.doesNotMatch(result.content[0].text, /signed-in-user@example/)
    for (const c of db.calls.filter((c) => c.table)) {
      const selection = c.operations.find(([method]) => method === 'select')[1]
      if (selection !== '*') assert.doesNotMatch(selection, /\b(description|email|mobile)\b/)
    }
  })
}
for (const city of [undefined, ['台北市']]) {
  test(`search_solutions: one search RPC with city=${JSON.stringify(city)}, global totals and page-only enrichment`, async () => {
    const db = mockDb()
    const { data } = await callTool(db, 'search_solutions', { city, keyword: 'AI', limit: 1, offset: 2 })
    const searches = db.calls.filter((c) => c.rpc?.startsWith('sf_search'))
    assert.equal(searches.length, 1)
    assert.equal(searches[0].rpc, 'sf_search_solutions')
    assert.deepEqual(searches[0].args.p_cities, city)
    assert.equal(searches[0].args.p_offset, 2)
    assert.equal(data.total_matches, 390)
    assert.deepEqual(data.totals, { matches: 390, normal: 360, suspected_delisted: 30, city_unknown: 12 })
    assert.equal(data.next_offset, 3)
    assert.equal(data.page_summary.normal, 1)
    assert.equal(data.results[0].company_city, '臺北市') // not the enrichment fixture's 高雄市
    assert.equal(data.results[0].industries_count, 4)
    for (const c of db.calls.filter((c) => c.table)) {
      assert.deepEqual(c.operations.find(([m]) => m === 'in')[2], [c.table === 'solutions' ? 'SOL-MOCK-1' : 'MOCK-C1'])
    }
    assert.doesNotMatch(db.calls.find((c) => c.table === 'companies').operations[0][1], /city/)
  })
}
test('search_companies: one RPC, totals beyond former cap, sentinel excluded, per-company counts not five previews', async () => {
  const db = mockDb({ rpc: { sf_search_companies: [company(), company({ company_key: '__no_company__:S2', company_id: null }), company({ company_key: null })] } })
  const { data } = await callTool(db, 'search_companies', { city: ['臺北市'], keyword: 'AI' })
  assert.equal(db.calls.filter((c) => c.rpc === 'sf_search_companies').length, 1)
  assert.equal(db.calls.filter((c) => c.rpc === 'sf_search_solutions').length, 0)
  assert.equal(data.companies_total, 152)
  assert.equal(data.solutions_total, 390)
  assert.equal(data.companies.length, 2)
  assert.equal(data.companies[1].company_id, null)
  assert.equal(data.companies[0].solutions[0].status, '正常')
  assert.equal(data.page_summary.solutions, 18)
  assert.equal(data.summary_line, '臺北市，關鍵字「AI」：152 家廠商、390 筆方案（正常 360、疑似下架 30）；另有 12 筆縣市未填未納入。')
  assert.equal(db.calls.filter((c) => c.table === 'solutions').length, 0)
})
test('company count-only sentinel preserves totals, including empty out-of-range page', async () => {
  const db = mockDb({ rpc: { sf_search_companies: [company({ company_key: null })] } })
  const { data } = await callTool(db, 'search_companies', { offset: 200 })
  assert.deepEqual(data.companies, [])
  assert.equal(data.companies_total, 152)
  assert.equal(data.next_offset, null)
  assert.equal(db.calls.filter((c) => c.table).length, 0)
})
test('normal_only wins, forwarded unchanged; notes retain city, conflict, partial failure and suspect instruction in <=3 entries', async () => {
  const db = mockDb({ fromError: { companies: true, awards: true, solutions: true } })
  const { data } = await callTool(db, 'search_solutions', { city: ['台北市'], normal_only: true, include_delisted: true })
  const args = db.calls.find((c) => c.rpc === 'sf_search_solutions').args
  assert.equal(args.p_normal_only, true)
  assert.equal(args.p_include_delisted, true) // database enforces priority, no alternate filtering
  assert.equal(data.status_scope, '只含正常')
  assert.equal(data.notes.length, 3)
  assert.match(data.notes.join(''), /縣市指公司總部所在地。.*normal_only 優先/)
  assert.match(data.notes.join(''), /無法取得稅籍.*無法取得獲獎.*無法取得產業別/)
  assert.match(data.notes.join(''), /逐筆標「⚠疑似下架」/)
  assert.doesNotMatch(JSON.stringify(data), /SQL private/)
  assert.equal(data.results[0].has_company_award, null)
})
test('include_delisted scope does not mislabel confirmed delisted as normal in summary', async () => {
  const { data } = await callTool(mockDb(), 'search_solutions', { include_delisted: true })
  assert.equal(data.status_scope, '含已下架')
  assert.match(data.summary_line, /非疑似下架 360（含已下架）/)
  assert.match(data.notes_more.join(''), /totals.normal/)
})
test('no next page at final row; omit empty summary context and unknown clause', async () => {
  const db = mockDb({ rpc: { sf_search_solutions: [solution({ total_matches: 1, suspected_total: 0, city_unknown_count: 0 })] } })
  const { data } = await callTool(db, 'search_solutions')
  assert.equal(data.next_offset, null)
  assert.equal(data.next_step, null)
  assert.equal(data.summary_line, '1 筆方案（正常 1、疑似下架 0）。')
})
for (const [args, pattern] of [
  [{ keyword: '入住自動化' }, /改用較短的關鍵字（例如「入住」）/],
  [{ city: ['臺北市'] }, /拿掉縣市篩選，或改用 region/],
  [{ category: ['資安'], program: ['來源'], max_price: 0, is_ai: false, is_gov: true, is_startup: false }, /category、program、max_price、is_ai、is_startup、is_gov/],
  [{ normal_only: true }, /改為包含疑似下架方案再查/],
]) {
  test(`zero result is not error and suggests next step: ${JSON.stringify(args)}`, async () => {
    const { result, data } = await callTool(mockDb({ rpc: { sf_search_solutions: [] } }), 'search_solutions', args)
    assert.notEqual(result.isError, true)
    assert.equal(data.returned, 0)
    assert.match(data.next_step.join(''), pattern)
  })
}
test('zero companies keeps city unknown count and suggests unknown records', async () => {
  const db = mockDb({ rpc: { sf_search_companies: [company({ company_key: null, companies_total: 0, solutions_total: 0, suspected_total: 0 })] } })
  const { data } = await callTool(db, 'search_companies', { city: ['臺北市'] })
  assert.deepEqual(data.next_step, ['拿掉縣市篩選，或改用 region', '另有 12 筆縣市未填，未納入'])
})
test('solution empty RPC page reports counting limitation without extra RPC', async () => {
  const db = mockDb({ rpc: { sf_search_solutions: [] } })
  const { data } = await callTool(db, 'search_solutions', { offset: 500 })
  assert.match(data.notes.join(''), /RPC 未回傳總數/)
  assert.match(data.next_step[0], /offset=0/)
  assert.equal(db.calls.length, 2)
})
test('handler error is sanitized Chinese JSON; actual SDK skips output validation for isError', async (t) => {
  t.mock.method(console, 'error', () => {})
  const { result, data, server, tool } = await callTool(mockDb({ throwRpc: true }), 'search_solutions')
  assert.equal(result.isError, true)
  assert.equal(result.structuredContent, undefined)
  assert.match(data.error, /搜尋方案.*暫時無法完成/)
  assert.doesNotMatch(result.content[0].text, /SELECT|private|postgresql|password|stack/)
  await server.validateToolOutput(tool, result, 'search_solutions')
  await assert.rejects(server.validateToolOutput(tool, { content: result.content }, 'search_solutions'), /no structured content/)
})
test('handler failure logs the actual error only to console, not to the user response', async (t) => {
  t.mock.method(console, 'error', () => {})
  const rawError = 'SELECT secret FROM private; postgresql://user:password@host/db\nstack'
  const { result } = await callTool(mockDb({ throwRpc: true }), 'search_solutions')
  assert.equal(console.error.mock.callCount(), 1)
  assert.deepEqual(console.error.mock.calls[0].arguments, ['[sf-mcp] search_solutions 失敗：', rawError])
  assert.equal(result.isError, true)
  assert.equal(result.structuredContent, undefined)
  assert.doesNotMatch(result.content[0].text, /SELECT|secret|private|postgresql|password|stack/)
})
test('non-Error handler failure is logged using String(err), while response remains sanitized', async (t) => {
  t.mock.method(console, 'error', () => {})
  const db = mockDb()
  db.auth.getUser = async () => { throw 'private authentication failure' }
  const { result } = await callTool(db, 'whoami')
  assert.deepEqual(console.error.mock.calls[0].arguments, ['[sf-mcp] whoami 失敗：', 'private authentication failure'])
  assert.equal(result.isError, true)
  assert.doesNotMatch(result.content[0].text, /private authentication failure/)
})
for (const options of [{ touch: { error: { message: 'private' }, data: null } }, { throwTouch: true }, { touch: { data: [{ over_limit: true, limit_per_minute: 30 }], error: null } }]) {
  test(`touch fail-open / observe-only: ${JSON.stringify(options)}`, async (t) => {
    t.mock.method(console, 'error', () => {})
    t.mock.method(console, 'warn', () => {})
    const { result, data } = await callTool(mockDb(options), 'whoami')
    assert.notEqual(result.isError, true)
    assert.deepEqual(data, { id: 'mock-user', email: 'signed-in-user@example.invalid', server_version: '1.2.0' })
    assert.equal(console.error.mock.callCount() + console.warn.mock.callCount(), 1)
    if (options.touch?.error || options.throwTouch) {
      assert.deepEqual(console.error.mock.calls[0].arguments, ['[sf-mcp] whoami sf_mcp_touch 失敗：', options.throwTouch ? 'private connection string' : 'private'])
      assert.doesNotMatch(result.content[0].text, /private/)
    }
  })
}
test('injected enforce=true blocks before handler, with deterministic retry seconds', async () => {
  const db = mockDb({ touch: { data: [{ over_limit: true, limit_per_minute: 30 }], error: null } })
  const { result, data } = await callTool(db, 'search_solutions', {}, { rateLimitEnforce: true, now: () => new Date('2026-10-14T00:00:17Z') })
  assert.equal(result.isError, true)
  assert.deepEqual(data, { error: '每分鐘最多 30 次查詢，請約 43 秒後再試', next_step: ['稍候再試', '合併查詢條件以減少呼叫次數'] })
  assert.equal(db.calls.length, 1)
})
test('describe topics index/default, all and every section preserve v1.1 except specified edits', async () => {
  const before = execFileSync('git', ['show', 'a91e900893fbb68bb0b574c488f38bf9afbe2b9e:supabase/functions/sf-mcp/index.ts'], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n')
  const guide = before.split('const DATA_GUIDE = `')[1].split('`')[0]
    .replace('- 已下架_…：已確認失效。預設排除，除非 include_delisted=true。', '- 已下架_…：已確認失效。預設排除，除非 include_delisted=true。\n- 回答格式：每筆疑似下架標『⚠疑似下架』，最後一句總說明；被問到才說明原因。推薦類問題請用 normal_only=true。')
    .replace(/^- 伺服器端最多掃描.*\n/m, '')
    .replace('- 引用任何數字時，請附上定義與資料缺口，避免使用者誤解。', '- 引用數字時優先使用 summary_line；定義與缺口用一句帶過，被問到再展開。')
  const { data: all } = await callTool(mockDb(), 'describe_data', { topic: 'all' })
  assert.equal(all.text, guide)
  const { data: index } = await callTool(mockDb(), 'describe_data')
  assert.equal(index.topic, 'index')
  assert.equal(index.text.split('\n\n')[0].split('\n').length, 11)
  assert.match(index.text, /## 一、資料是什麼/)
  assert.match(index.text, /## 二、狀態/)
  assert.doesNotMatch(index.text, /## 三、/)
  const names = ['data', 'status', 'region', 'ranking', 'mapping', 'industry', 'tips', 'tax', 'awards', 'lists', 'other']
  for (const [i, topic] of names.entries()) {
    const { data } = await callTool(mockDb(), 'describe_data', { topic })
    assert.equal(data.text, guide.split(/\n(?=## )/)[i + 1])
  }
})
test('protected five handlers retain original query/body logic including whoami own email', () => {
  const before = execFileSync('git', ['show', 'a91e900893fbb68bb0b574c488f38bf9afbe2b9e:supabase/functions/sf-mcp/index.ts'], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n')
  for (const name of ['get_solution', 'get_solutions', 'data_status', 'whoami', 'count_solutions']) {
    const body = (text) => text.split(`'${name}',\n`)[1].split(/\n\s+async /)[1].split('\n        )')[0].trim()
    assert.equal(body(source), body(before))
  }
})
test('migration hash pinned, skill exact appendix hash, old scanning removed, no business writes/private RPC', () => {
  const sql = readFileSync(new URL('migrations/20261014_sf_mcp_v1_2.sql', root))
  assert.equal(createHash('sha256').update(sql).digest('hex'), '0c06539e6472b1a5160f87e7543d3b0ef06e2bf66528169baf50f106205c7b5f')
  const skill = readFileSync(new URL('docs/sf-mcp-skill/SKILL.md', root))
  assert.equal(createHash('sha256').update(skill).digest('hex'), '5077479ab8513d5316c14bc5acb5cc376b68170d9f3f69ec345a60d2c12e1d8c')
  assert.doesNotMatch(source, /SCAN_CAP|scanPages|filterByCity|groupByCompany|normCity|fetchPage|300 筆|\.rpc\('sf_private|\.(insert|upsert|update|delete)\(/)
  assert.match(source, /RATE_LIMIT_ENFORCE = false/)
  assert.match(source, /withSupabase\(\{ auth: 'user' \}\)/)
})

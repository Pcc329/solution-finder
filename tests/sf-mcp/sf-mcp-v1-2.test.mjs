import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
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
const { createSfServer, isMissingSolutionName: mcpIsMissingSolutionName, displaySolutionName: mcpDisplaySolutionName, solutionNamePlaceholders } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(testSource + '\nexport { isMissingSolutionName, displaySolutionName, solutionNamePlaceholders }')).toString('base64')}`)

test('standalone Edge Function imports only npm/jsr packages, with no local or dynamic imports', () => {
  const imports = [...source.matchAll(/^import\s+(?:[^'"\n]*?from\s+)?['"]([^'"]+)['"]/gm)].map(match => match[1])
  assert.equal(imports.length, 5)
  for (const specifier of imports) assert.match(specifier, /^(npm|jsr):/)
  assert.doesNotMatch(source, /\bimport\s*\(|\bexport\s+[^\n]*\bfrom\s*['"]/)
})

test('browser and inline MCP definitions independently load identical placeholder lists and behavior', () => {
  const browserLists = []
  class CapturedSet extends Set {
    constructor(values) { super(values); browserLists.push([...values]) }
  }
  const browser = vm.createContext({ Set: CapturedSet })
  vm.runInContext(readFileSync(new URL('public/solution-name.js', root), 'utf8'), browser)
  const expected = ['缺', '缺漏', '待補', '無', '-', '—', 'N/A', 'NA', 'null', '?', '？']
  assert.equal(browserLists.length, 1)
  assert.deepEqual(browserLists[0], expected)
  assert.deepEqual([...solutionNamePlaceholders], browserLists[0])
  const values = [null, undefined, '', '  ', '\t\n', ...expected, ...expected.map(value => ` \t${value}\n `),
    '律果簽', 'HackMD', 'AI', ' AI ', '缺工管理', 'NA 平台', 'Null Analytics', 'n/a', 'NULL', 0, false]
  for (const value of values) {
    assert.equal(mcpIsMissingSolutionName(value), browser.isMissingSolutionName(value), `classification: ${JSON.stringify(value)}`)
    assert.equal(mcpDisplaySolutionName(value), browser.displaySolutionName(value), `display: ${JSON.stringify(value)}`)
  }
})

const solution = (extra = {}) => ({
  solution_id: 'SOL-MOCK-1', solution_name: 'Mock AI 方案', company_id: 'MOCK-C1', company_name: 'Mock 廠商',
  program_type: '測試來源', industry_category: '協作辦公', region: '北部', company_city: '臺北市',
  has_ai: true, is_startup: false, is_gov: true, price: 1000, monthly_price: null, pricing_model: ['訂閱制'],
  slogan: '測試標語', description_short: '測試摘要', record_status: null, score: 100,
  total_matches: 390, suspected_total: 30, city_unknown_count: 12, ...extra,
})
const company = (extra = {}) => ({
  company_key: 'MOCK-C1', company_id: 'MOCK-C1', company_name: 'Mock 廠商', company_city: '臺北市', company_region: '北部',
  capital: 100000000, capital_unknown_count: 7, no_company_count: 0, first_rank: 1, solutions_count: 9, suspected_count: 2,
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
      if (name === 'sf_mcp_quota_check' || name === 'sf_mcp_quota_consume') return { data: null, error: null }
      if (throwRpc) throw new Error('SELECT secret FROM private; postgresql://user:password@host/db\nstack')
      const values = {
        sf_capital_coverage: [{ with_capital: 6, total_companies: 10 }], sf_search_solutions: [solution()], sf_search_companies: [company()], sf_data_status: [{ total_count: 10, normal_count: 8, suspected_count: 1, delisted_count: 1 }],
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
  const db = mockDb({ rpc: { sf_search_companies: [company({ company_key: null, companies_total: 90 })] } })
  const { data } = await callTool(db, 'search_companies', { offset: 100 })
  assert.deepEqual(data.companies, [])
  assert.equal(data.companies_total, 90)
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
  const { data } = await callTool(db, 'search_solutions', { offset: 200 })
  assert.match(data.notes.join(''), /RPC 未回傳總數/)
  assert.match(data.next_step[0], /offset=0/)
  assert.deepEqual(db.calls.map(c => c.rpc), ['sf_mcp_touch', 'sf_mcp_quota_check', 'sf_search_solutions', 'sf_mcp_quota_consume'])
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
    const { result, data } = await callTool(mockDb(options), 'whoami', {}, { rateLimitEnforce: false })
    assert.notEqual(result.isError, true)
    assert.deepEqual(data, { id: 'mock-user', email: 'signed-in-user@example.invalid', server_version: '1.4.0' })
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
    .replace('資策會產業調查等。', '資策會產業調查、智慧雨林擴散案（廠商官網）等。\n- 智慧雨林擴散案（廠商官網）：擴散案核定之資服業者中，官網有具名產品且與核定計畫名稱相關者，以人工查核收錄；方案內容為廠商自述，未經平台審核。')
    .replace('正常：在來源平台上架中。', '正常：在來源平台上架中，或由廠商官網公開提供。')
    .replace('- 已下架_…：已確認失效。預設排除，除非 include_delisted=true。', '- 已下架_…：已確認失效。預設排除，除非 include_delisted=true。\n- 回答格式：每筆疑似下架標『⚠疑似下架』，最後一句總說明；被問到才說明原因。推薦類問題請用 normal_only=true。')
    .replace(/^- 伺服器端最多掃描.*\n/m, '')
    .replace('- 引用任何數字時，請附上定義與資料缺口，避免使用者誤解。', '- 引用數字時優先使用 summary_line；定義與缺口用一句帶過，被問到再展開。')
    .replace('- 需要匯出檔案時，請先在對話中整理成表格，再用你自己的工具輸出；本資料庫連接器唯讀，不能產生檔案。', '- 本連接器不提供整批匯出或全庫清單。使用者要求匯出全部或大量資料時，請說明此限制，並建議用條件（來源、類別、縣市、價格）縮小範圍後查詢；確有盤點需求者，請洽資料維護者。少量結果可在對話中整理成表格。')
    .replace('- 碳排放、淨零、ESG → 碳', '- 碳排放、淨零、ESG → 碳\n- 財會、會計、記帳、帳務、財務報表 → 財務（再以「會計」補搜一次，用方案 id 取聯集）')
    .replace('- AI開發、資料分析、IoT、研發 → 研發創新', '- AI開發、資料分析、IoT、研發 → 研發創新\n- 財會、會計、帳務：沒有對應類別（分散在協作辦公、銷售管理、生產物流），請改用 keyword，不要帶 category')
    .replace('少量結果可在對話中整理成表格。', '少量結果可在對話中整理成表格。\n- 搜尋清單只提供價格級距（price_range）；需要精確價格時，對少數候選用 get_solutions。每位使用者每日可取得的方案明細有上限，超過時伺服器會回報，請照實告知使用者，不要嘗試換條件繞過。\n- search_companies 的 limit／offset 以廠商數計算，每頁預設且最多 10 家，每家最多列 5 筆方案。')
    .replace('不是免費。', '不是免費。清單中的「未提供」即此情況。')
  const { data: all } = await callTool(mockDb(), 'describe_data', { topic: 'all' })
  assert.equal(all.text.split('\n\n## 十二、')[0], guide)
  const { data: index } = await callTool(mockDb(), 'describe_data')
  assert.equal(index.topic, 'index')
  assert.equal(index.text.split('\n\n')[0].split('\n').length, 12)
  assert.match(index.text, /## 一、資料是什麼/)
  assert.match(index.text, /## 二、狀態/)
  assert.doesNotMatch(index.text, /## 三、/)
  const names = ['data', 'status', 'region', 'ranking', 'mapping', 'industry', 'tips', 'tax', 'awards', 'lists', 'other']
  for (const [i, topic] of names.entries()) {
    const { data } = await callTool(mockDb(), 'describe_data', { topic })
    assert.equal(data.text.trimEnd(), guide.split(/\n(?=## )/)[i + 1].trimEnd())
  }
})
test('three handlers without capital retain query/body logic', () => {
  const before = execFileSync('git', ['show', 'a91e900893fbb68bb0b574c488f38bf9afbe2b9e:supabase/functions/sf-mcp/index.ts'], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n')
  for (const name of ['data_status', 'whoami', 'count_solutions']) {
    const body = (text) => text.split(`'${name}',\n`)[1].split(/\n\s+async /)[1].split('\n        )')[0].trim()
    const normalize = (text) => text
      .replace(/\n\s+solution_name: displaySolutionName\(s.solution_name\),/g, '')
      .replace(/\n\s+name: displaySolutionName\(s.solution_name\),/g, '')
      .replace(/\n\s+name_missing: isMissingSolutionName\(s.solution_name\),/g, '')
      .replace(/name: displaySolutionName\(r.solution_name\),\n\s+name_missing: isMissingSolutionName\(r.solution_name\),/g, 'name: r.solution_name,')
    const expected = name === 'whoami'
      ? body(before).replace(
        "return asText({ id: data.user?.id, email: data.user?.email, server_version: SERVER_VERSION })",
        "const quota = await readQuota('whoami')\n            return asText({\n              id: data.user?.id, email: data.user?.email, server_version: SERVER_VERSION,\n              ...(quota ? { quota: { daily_limit: quota.daily_limit, rows_today: quota.rows_today } } : {}),\n            })",
      )
      : body(before)
    assert.equal(normalize(body(source)), expected)
  }
})
test('migration hash pinned, skill exact appendix hash, old scanning removed, no business writes/private RPC', () => {
  const sql = readFileSync(new URL('migrations/20261014_sf_mcp_v1_2.sql', root))
  assert.equal(createHash('sha256').update(sql).digest('hex'), '0c06539e6472b1a5160f87e7543d3b0ef06e2bf66528169baf50f106205c7b5f')
  const skill = readFileSync(new URL('docs/sf-mcp-skill/SKILL.md', root))
  assert.equal(createHash('sha256').update(skill).digest('hex'), '5077479ab8513d5316c14bc5acb5cc376b68170d9f3f69ec345a60d2c12e1d8c')
  assert.doesNotMatch(source, /SCAN_CAP|scanPages|filterByCity|groupByCompany|normCity|fetchPage|300 筆|\.rpc\('sf_private|\.(insert|upsert|update|delete)\(/)
  assert.match(source, /RATE_LIMIT_ENFORCE = true/)
  assert.match(source, /withSupabase\(\{ auth: 'user' \}\)/)
})

for (const name of [null, undefined, '', '  ', '缺', ' 缺 ', '缺漏', '待補', '無', '-', '—', 'N/A', 'NA', 'null', '?', '？', '律果簽', 'HackMD', 'AI', ' AI ']) {
  test(`all four name outputs and actual schemas: ${JSON.stringify(name)}`, async () => {
    const missing = !['律果簽', 'HackMD', 'AI', ' AI '].includes(name)
    const expected = missing ? '（名稱未提供）' : name
    const row = solution({ solution_name: name })
    const db = mockDb({ rpc: { sf_search_solutions: [row], sf_search_companies: [company({ solutions: [{ id: row.solution_id, name }] })] }, tables: { solutions: [row] } })
    for (const [tool, args, getRows] of [
      ['search_solutions', {}, data => data.results],
      ['search_companies', {}, data => data.companies[0].solutions],
      ['get_solution', { solution_id: row.solution_id }, data => [data.solution]],
      ['get_solutions', { solution_ids: [row.solution_id] }, data => data.results],
    ]) {
      const { data, tool: registered } = await callTool(db, tool, args)
      const result = getRows(data)[0]
      assert.equal(result.name, expected, tool)
      assert.equal(result.name_missing, missing, tool)
      if (tool === 'get_solution') assert.equal(result.solution_name, expected)
      delete result.name_missing
      assert.equal(registered.outputSchema.safeParse(data).success, false, `${tool} must require name_missing`)
      result.name_missing = 'true'
      assert.equal(registered.outputSchema.safeParse(data).success, false, `${tool} must require a boolean`)
    }
    assert.equal(row.solution_name, name, 'raw fixture is not changed')
  })
}

for (const [tool, args] of [
  ['describe_data', {}], ['search_solutions', {}], ['search_companies', {}],
  ['get_solution', { solution_id: 'SOL-MOCK-1' }], ['get_solutions', { solution_ids: ['SOL-MOCK-1'] }],
  ['data_status', {}], ['whoami', {}], ['count_solutions', {}],
]) {
  test(`${tool}: 42501 denies access before any query or handler and logs server-side`, async t => {
    t.mock.method(console, 'error', () => {})
    const db = mockDb({ touch: { data: null, error: { code: '42501', message: 'private permission detail' } } })
    db.auth.getUser = async () => { assert.fail('unauthorized whoami must not run') }
    const { result, data } = await callTool(db, tool, args)
    assert.equal(result.isError, true)
    assert.equal(result.structuredContent, undefined)
    assert.equal(data.error, '此帳號未開通 SF資料庫查詢權限，請洽管理者。')
    assert.deepEqual(db.calls, [{ rpc: 'sf_mcp_touch', args: undefined }])
    assert.equal(console.error.mock.callCount(), 1)
    assert.match(console.error.mock.calls[0].arguments[0], /sf_mcp_touch 失敗/)
    assert.equal(console.error.mock.calls[0].arguments[1], 'private permission detail')
    assert.doesNotMatch(result.content[0].text, /42501|private|sf_mcp_touch|SQL/)
  })
}

test('summary city text uses official 臺 while RPC parameters and keyword stay unchanged', async () => {
  for (const tool of ['search_solutions', 'search_companies']) {
    const db = mockDb()
    const { data } = await callTool(db, tool, { city: [' 台北市 ', '台中市', '台東縣'], keyword: '台灣' })
    assert.match(data.summary_line, /^臺北市，臺中市，臺東縣，關鍵字「台灣」：/)
    assert.deepEqual(db.calls.find(c => c.rpc === `sf_${tool}`).args.p_cities, [' 台北市 ', '台中市', '台東縣'])
  }
})

test('describe_data index uses the first complete sentence, not a list heading fragment', async () => {
  const { data } = await callTool(mockDb(), 'describe_data')
  const directory = data.text.split('\n\n')[0].split('\n')
  assert.equal(directory.length, 12)
  for (const line of directory) assert.match(line, /[。！？]$/)
  const mapping = directory[4]
  assert.doesNotMatch(mapping, /需求 → keyword：。/)
  assert.match(mapping, /為什麼用詞根：「目標產業」欄位有多套寫法並存（例如「金融保險」與「K金融及保險業」、「批發零售業」與「G批發及零售業」）。$/)
})

test('name display preserves RPC page order, scores, totals and request parameters', async () => {
  const rows = [solution({ solution_name: '缺', score: 150 }), solution({ solution_id: 'SOL-MOCK-2', solution_name: 'AI', score: 100 })]
  const { data } = await callTool(mockDb({ rpc: { sf_search_solutions: rows } }), 'search_solutions', { include_delisted: true })
  assert.deepEqual(data.results.map(r => [r.id, r.score]), rows.map(r => [r.solution_id, r.score]))
  assert.equal(data.total_matches, 390)
})


test('capital schema is limited to search_companies and validates bounds', async () => {
  const tools = createSfServer(mockDb())._registeredTools
  const input = tools.search_companies.inputSchema
  assert.equal(input.safeParse({ min_capital: 0, max_capital: 100, sort: 'capital_desc' }).success, true)
  for (const args of [{ min_capital: -1 }, { max_capital: -1 }, { min_capital: 2, max_capital: 1 }, { min_capital: Infinity }, { min_capital: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(input.safeParse(args).success, false)
  }
  assert.equal(tools.search_solutions.inputSchema.safeParse({ sort: 'capital_desc' }).success, false)
})

test('capital bounds and sorting reach the DB with city, normal_only and pagination', async () => {
  const db = mockDb()
  const { data } = await callTool(db, 'search_companies', { min_capital: 0, max_capital: 100000000, city: ['臺北市'], normal_only: true, sort: 'capital_desc', limit: 1, offset: 2 })
  const args = db.calls.find(c => c.rpc === 'sf_search_companies').args
  assert.equal(args.p_min_capital, 0)
  assert.equal(args.p_max_capital, 100000000)
  assert.equal(args.p_sort, 'capital_desc')
  assert.equal(args.p_normal_only, true)
  assert.equal(args.p_offset, 2)
  assert.deepEqual(args.p_cities, ['臺北市'])
  assert.equal(data.companies_total, 152)
  assert.equal(data.companies[0].capital, 100000000)
  assert.match(data.notes.join(''), /有 7 家公司未填資本額，無法納入此篩選/)
  assert.doesNotMatch(data.notes.join(''), /方案未對應公司/)
  assert.ok(data.notes.filter(note => note !== '月費級距請以 get_solutions 查詢方案明細').length <= 3)
  assert.equal(db.calls.filter(c => c.rpc === 'sf_capital_coverage').length, 1)
})

for (const capital of [null, 0, 100000000]) {
  test(`capital remains ${capital} through search and both detail tools`, async () => {
    const options = { rpc: { sf_search_companies: [company({ capital })] }, tables: { companies: [{ company_id: 'MOCK-C1', capital }] } }
    const search = await callTool(mockDb(options), 'search_companies')
    assert.equal(search.data.companies[0].capital, capital)
    const single = await callTool(mockDb(options), 'get_solution', { solution_id: 'SOL-MOCK-1' })
    assert.equal(single.data.company.capital, capital)
    const batch = await callTool(mockDb(options), 'get_solutions', { solution_ids: ['SOL-MOCK-1'] })
    assert.equal(batch.data.results[0].company.capital, capital)
    for (const { data } of [search, single, batch]) {
      assert.deepEqual(data.capital_disclosure.coverage, { with_capital: 6, total_companies: 10, percentage: 60, denominator: 'companies 全表公司數（不套用方案、下架狀態或本次搜尋條件）' })
      assert.ok(data.capital_disclosure.notes.includes('本結果僅含 SF 資料庫中有上架方案的廠商'))
    }
    for (const { db, tool, args } of [
      { db: mockDb(options), tool: 'get_solution', args: { solution_id: 'SOL-MOCK-1' } },
      { db: mockDb(options), tool: 'get_solutions', args: { solution_ids: ['SOL-MOCK-1'] } },
    ]) {
      await callTool(db, tool, args)
      assert.match(db.calls.find(c => c.table === 'companies').operations[0][1], /\bcapital\b/)
    }
  })
}

test('capital unknown count survives empty pages and counts remain server totals', async () => {
  const db = mockDb({ rpc: { sf_search_companies: [company({
    company_key: null, companies_total: 0, solutions_total: 0, suspected_total: 0, no_company_count: 3,
  })] } })
  const { data } = await callTool(db, 'search_companies', { min_capital: 100000000 })
  assert.deepEqual(data.companies, [])
  assert.equal(data.companies_total, 0)
  assert.ok(data.notes.includes('有 7 家公司未填資本額；另有 3 筆方案未對應公司，均無法納入此篩選。'))
  assert.equal(data.capital_disclosure.coverage.total_companies, 10)
})

test('coverage refreshes for every call, includes zero as known and handles empty denominator', async () => {
  const rows = [{ with_capital: 6, total_companies: 10 }]
  const db = mockDb({ rpc: { sf_capital_coverage: rows } })
  assert.equal((await callTool(db, 'search_companies')).data.capital_disclosure.coverage.percentage, 60)
  rows[0] = { with_capital: 7, total_companies: 10 }
  assert.equal((await callTool(db, 'search_companies')).data.capital_disclosure.coverage.percentage, 70)
  rows[0] = { with_capital: 0, total_companies: 0 }
  assert.equal((await callTool(db, 'search_companies')).data.capital_disclosure.coverage.percentage, null)
  assert.equal(db.calls.filter(c => c.rpc === 'sf_capital_coverage').length, 3)
})

test('missing coverage fails without publishing capital with fabricated disclosure', async () => {
  const { result } = await callTool(mockDb({ rpc: { sf_capital_coverage: [] } }), 'search_companies')
  assert.equal(result.isError, true)
})

test('unaffected search and missing detail results do not fetch or expose capital', async () => {
  for (const [name, args, tables] of [
    ['search_solutions', {}, {}], ['get_solution', { solution_id: 'absent' }, { solutions: [] }],
    ['get_solutions', { solution_ids: ['absent'] }, { solutions: [] }],
  ]) {
    const db = mockDb({ tables })
    const { data } = await callTool(db, name, args)
    assert.equal(data.capital_disclosure, undefined)
    assert.equal(db.calls.some(c => c.rpc === 'sf_capital_coverage'), false)
    const search = db.calls.find(c => c.rpc === 'sf_search_solutions')
    if (search) assert.equal('p_min_capital' in search.args, false)
  }
})

test('describe_data capital topic and index disclose definition and denominator', async () => {
  const { data } = await callTool(mockDb(), 'describe_data', { topic: 'capital' })
  assert.match(data.text, /資本總額與實收資本額/)
  assert.match(data.text, /已知資本額中/)
  assert.match(data.text, /companies 全表/)
  const index = await callTool(mockDb(), 'describe_data')
  assert.match(index.data.text, /十二、資本額/)
})

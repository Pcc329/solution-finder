import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

export const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8')
const testSource = read('supabase/functions/sf-mcp/index.ts').replace(/\r\n/g, '\n').split('Deno.serve(')[0]
  .replace(/^import .*\n/gm, line => {
    if (line.includes('npm:@modelcontextprotocol/server@2.0.0')) return `import { McpServer } from '${import.meta.resolve('@modelcontextprotocol/server')}'\n`
    if (line.includes('npm:zod@4.6.5')) return `import { z } from '${import.meta.resolve('zod')}'\n`
    return ''
  })
const js = stripTypeScriptTypes(testSource + '\nexport { priceRange }')
export const { createSfServer, priceRange } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

export async function callTool(server, name, args = {}) {
  const tool = server._registeredTools[name]
  const parsed = await server.validateToolInput(tool, args, name)
  const result = await server.executeToolHandler(tool, parsed, {})
  await server.validateToolOutput(tool, result, name)
  const data = JSON.parse(result.content[0].text)
  if (!result.isError) assert.deepEqual(result.structuredContent, data)
  return { result, data }
}

export function solution(id, price = 50000, monthlyPrice = 9999) {
  return { solution_id: id, solution_name: id, price, monthly_price: monthlyPrice, total_matches: 1000 }
}

export function mockDb({ rpc = {}, solutions = [solution('S1'), solution('S2')] } = {}) {
  const calls = []
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: { id: 'mock-user' } }, error: null }) },
    async rpc(name, args) {
      calls.push({ name, args })
      if (rpc[name]) return rpc[name](args)
      const data = {
        sf_mcp_touch: [{ over_limit: false }],
        sf_mcp_quota_check: [{ daily_limit: 300, rows_today: 23, over_limit: false }],
        sf_search_solutions: solutions,
        sf_search_companies: [{ company_key: 'C1', companies_total: 200, solutions_total: 900, solutions_count: 25,
          solutions: [{ id: 'S1', name: 'S1', price: 100000 }, { id: 'S2', name: 'S2', price: 0 }, { id: 'S3', name: 'S3', price: 9999 }] }],
        sf_capital_coverage: [{ with_capital: 6, total_companies: 10 }],
        sf_data_status: [], sf_data_coverage: [], sf_status_reasons: [],
      }[name]
      return { data, error: null }
    },
    from(table) {
      calls.push({ name: table })
      let rows = table === 'solutions' ? solutions : []
      let single = false
      const query = {
        select: () => query,
        in: (column, values) => { rows = rows.filter(row => values.includes(row[column])); return query },
        eq: (column, value) => { rows = rows.filter(row => row[column] === value); return query },
        or: () => query,
        maybeSingle: () => { single = true; return query },
        then: (resolve, reject) => Promise.resolve({ data: single ? rows[0] ?? null : rows, count: rows.length, error: null }).then(resolve, reject),
      }
      return query
    },
  }
}

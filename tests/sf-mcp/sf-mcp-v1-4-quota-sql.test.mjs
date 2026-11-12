import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { callTool, createSfServer, mockDb, read, solution } from './quota-test-helpers.mjs'

const migration = read('migrations/20261111_sf_mcp_v1_4_quota.sql')
const first = '00000000-0000-0000-0000-000000000001'
const second = '00000000-0000-0000-0000-000000000002'
const unlisted = '00000000-0000-0000-0000-000000000003'
const today = "(now() at time zone 'Asia/Taipei')::date"

async function fixture(t) {
  const db = new PGlite()
  t.after(() => db.close())
  const query = async (sql, args) => (await db.query(sql, args)).rows
  const uid = id => query("select set_config('request.jwt.claim.sub', $1, false)", [id])
  const oauth = value => query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(value)])
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
    insert into auth.users (id) values ('${first}'), ('${second}'), ('${unlisted}');
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    set timezone to 'UTC';
  `)
  const tables = [
    'solutions', 'companies', 'awards', 'cases', 'gov_registrations', 'industry_codes', 'data_sources',
    'users', 'csp_violations', 'solution_reviews', 'solution_status_log', 'program_promotions',
    'program_sources', 'company_cdm_categories', 'digital_needs',
  ]
  await db.exec(tables.map(table => `create table public.${table} (id integer); alter table public.${table} enable row level security;`).join('\n'))
  await db.exec(`
    create table public.contacts (contact_id integer, company_id integer, contact_name text, title text, office_phone text);
    alter table public.contacts enable row level security;
    create view public.contacts_masked as select contact_id from public.contacts;
    insert into public.solutions values (1), (2);
  `)
  await db.exec(read('migrations/20261001_create_sf_mcp_access.sql'))
  const v12 = read('migrations/20261014_sf_mcp_v1_2.sql')
  await db.exec(v12.slice(v12.indexOf('create table public.sf_mcp_usage'), v12.indexOf('-- ---------- 6.')))
  await query("insert into public.sf_mcp_users (user_id, role) values ($1,'reader'), ($2,'reader')", [first, second])
  await oauth({ client_id: 'offline-mcp-test' })
  return { db, query, uid, oauth }
}

const counts = async query => (await query(`
  select (select count(*)::int from public.solutions) as solutions,
         (select count(*)::int from public.sf_mcp_users) as users
`))[0]

test('quota migration checks grants and defaults, isolates accounts and aggregates by Taipei day and tool', async t => {
  const { db, query, uid, oauth } = await fixture(t)
  const notices = []
  const before = await counts(query)
  await db.exec(migration, { onNotice: notice => notices.push(notice.message) })
  const after = await counts(query)
  assert.deepEqual(after, before)
  assert.deepEqual(notices, ['自檢通過：白名單 2 筆，既有帳號預設 human／300，用量表 RLS 與函式權限正確'])
  t.diagnostic(notices[0])
  t.diagnostic(`資料筆數前後一致（solutions: ${after.solutions}，sf_mcp_users: ${after.users}）`)
  assert.deepEqual(await query('select distinct account_type, daily_limit from public.sf_mcp_users'), [{ account_type: 'human', daily_limit: 300 }])
  await query("update public.sf_mcp_users set account_type = 'agent', daily_limit = 20 where user_id = $1", [second])
  for (const value of [0, 5001]) {
    await assert.rejects(query('update public.sf_mcp_users set daily_limit = $1', [value]), { code: '23514' })
  }
  await query(`
    insert into public.sf_mcp_daily_usage (user_id, usage_date, tool_name, calls, rows_returned)
    values ($1, ${today} - 1, 'search_solutions', 1, 300), ($2, ${today}, 'search_solutions', 1, 20)
  `, [first, second])
  const check = async () => (await query('select * from public.sf_mcp_quota_check()'))[0]
  const consume = (tool, rows) => query('select public.sf_mcp_quota_consume($1, $2)', [tool, rows])

  await db.exec('set role authenticated')
  await uid(first)
  assert.deepEqual(await query('select user_id from public.sf_mcp_users'), [{ user_id: first }])
  await assert.rejects(query('update public.sf_mcp_users set daily_limit = 5000'), { code: '42501' })
  await assert.rejects(query('select * from public.sf_mcp_daily_usage'), { code: '42501' })
  assert.deepEqual(await check(), { rows_today: 0, daily_limit: 300, over_limit: false })
  await consume('search_solutions', 40)
  await consume('search_solutions', 20)
  await consume('search_companies', 15)
  await consume('whoami', 0)
  assert.deepEqual(await check(), { rows_today: 75, daily_limit: 300, over_limit: false })
  for (const [tool, rows] of [[null, 1], ['unknown', 1], ['whoami', -1], ['whoami', 51], ['whoami', null]]) {
    await assert.rejects(consume(tool, rows), { code: '22023' })
  }

  await uid(second)
  assert.deepEqual(await check(), { rows_today: 20, daily_limit: 20, over_limit: true })
  for (const id of [unlisted, '']) {
    await uid(id)
    await assert.rejects(check(), { code: '42501' })
    await assert.rejects(consume('search_solutions', 1), { code: '42501' })
  }
  await uid(first)
  await oauth({})
  await assert.rejects(check(), { code: '42501' })
  await assert.rejects(consume('search_solutions', 1), { code: '42501' })

  await db.exec('set role anon')
  await assert.rejects(check(), { code: '42501' })
  await assert.rejects(consume('search_solutions', 1), { code: '42501' })
  await db.exec('reset role')
  assert.deepEqual(await query(`
    select user_id, usage_date - ${today} as day, tool_name, calls, rows_returned
    from public.sf_mcp_daily_usage order by user_id, usage_date, tool_name
  `), [
    { user_id: first, day: -1, tool_name: 'search_solutions', calls: 1, rows_returned: 300 },
    { user_id: first, day: 0, tool_name: 'search_companies', calls: 1, rows_returned: 15 },
    { user_id: first, day: 0, tool_name: 'search_solutions', calls: 2, rows_returned: 60 },
    { user_id: first, day: 0, tool_name: 'whoami', calls: 1, rows_returned: 0 },
    { user_id: second, day: 0, tool_name: 'search_solutions', calls: 1, rows_returned: 20 },
  ])
})

test('negative migrations fail self-check and roll back all schema changes', async t => {
  const { db, query } = await fixture(t)
  const before = await counts(query)
  for (const [label, from, to, expected] of [
    ['RLS', 'alter table public.sf_mcp_daily_usage enable row level security;', '', /未啟用 RLS/],
    ['SECURITY DEFINER', 'stable security definer', 'stable security invoker', /必須使用 SECURITY DEFINER/],
    ['default table privileges', 'revoke all on public.sf_mcp_daily_usage from public, anon, authenticated;', '', /有 sf_mcp_daily_usage 的直接存取權/],
  ]) {
    await t.test(label, async () => {
      assert.ok(migration.includes(from))
      await assert.rejects(db.exec(migration.replace(from, to)), error => {
        assert.match(error.message, expected)
        t.diagnostic(error.message)
        return true
      })
      await db.exec('rollback')
      assert.deepEqual(await counts(query), before)
      assert.deepEqual(await query(`
        select to_regclass('public.sf_mcp_daily_usage') as usage,
               to_regprocedure('public.sf_mcp_quota_check()') as quota_check,
               to_regprocedure('public.sf_mcp_quota_consume(text,integer)') as quota_consume
      `), [{ usage: null, quota_check: null, quota_consume: null }])
      assert.deepEqual(await query(`
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'sf_mcp_users'
          and column_name in ('account_type', 'daily_limit')
      `), [])
    })
  }
})

test('MCP calls with real local SQL stop at 300 rows and at an account-specific limit of 20', async t => {
  const { db, query, uid } = await fixture(t)
  await db.exec(migration)
  await query('update public.sf_mcp_users set daily_limit = 20 where user_id = $1', [second])
  await db.exec('set role authenticated')
  const databaseRpc = (sql, params) => query(sql, params)
    .then(data => ({ data, error: null }), error => ({ data: null, error }))
  const solutions = Array.from({ length: 1000 }, (_, i) => solution('S' + i))
  const mock = mockDb({ solutions, rpc: {
    sf_mcp_touch: () => databaseRpc('select * from public.sf_mcp_touch()'),
    sf_mcp_quota_check: () => databaseRpc('select * from public.sf_mcp_quota_check()'),
    sf_mcp_quota_consume: args => databaseRpc('select public.sf_mcp_quota_consume($1, $2)', [args.p_tool, args.p_rows]),
    sf_search_solutions: args => ({ data: solutions.slice(args.p_offset, args.p_offset + args.p_limit) }),
  } })
  const server = createSfServer(mock)
  for (const [id, limit, size] of [[first, 300, 50], [second, 20, 10]]) {
    await uid(id)
    for (let rows = 0; rows < limit; rows += size) {
      const { result, data } = await callTool(server, 'search_solutions', { limit: size, offset: rows % 201 })
      assert.equal(result.isError, undefined)
      assert.equal(data.returned, size)
    }
    mock.calls.length = 0
    const blocked = await callTool(server, 'search_solutions', { limit: 1 })
    const message = `今日查詢明細已達上限（${limit} 筆），每日 00:00 重置。如有盤點需求，請洽資料維護者。`
    assert.equal(blocked.result.isError, true)
    assert.deepEqual(blocked.data, { error: message, next_step: ['縮小查詢條件', '明日再查', '洽資料維護者'] })
    assert.deepEqual(mock.calls.map(call => call.name), ['sf_mcp_touch', 'sf_mcp_quota_check'])
    const { data } = await callTool(server, 'whoami')
    assert.deepEqual(data.quota, { daily_limit: limit, rows_today: limit })
    t.diagnostic(`第 ${limit / size + 1} 次查詢（第 ${limit + 1} 筆）被擋。 ${message}`)
  }
  await db.exec('reset role')
  assert.deepEqual(await query(`
    select calls, rows_returned from public.sf_mcp_daily_usage
    where tool_name = 'search_solutions' order by user_id
  `), [{ calls: 6, rows_returned: 300 }, { calls: 2, rows_returned: 20 }])
})

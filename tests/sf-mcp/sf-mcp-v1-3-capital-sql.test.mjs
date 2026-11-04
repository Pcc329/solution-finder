import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

test('capital migration executes in PostgreSQL with legacy parity, DB filtering, sorting and live coverage', async t => {
  const db = new PGlite()
  const query = async sql => (await db.query(sql)).rows
  const search = args => query(`select * from public.sf_search_companies(${args})`)
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema sf_private;
      create table companies (
        company_id text primary key, company_name text, region text, city text,
        is_startup boolean, tech_tags text[], capital bigint
      );
      create table solutions (
        solution_id text primary key, solution_name text, company_id text,
        program_type text, industry_category text, has_ai boolean,
        price integer, monthly_price integer, pricing_model text[], slogan text,
        description text, description_short text, features_list text,
        target_industry text[], record_status text
      );
      create table gov_registrations (company_id text);
      insert into companies (company_id, company_name, capital, city) values
        ('A','AI A',100000000,'臺北市'), ('B','AI B',200000000,'台北市'),
        ('C','AI C',null,'臺北市'), ('D','AI D',0,'臺中市'),
        ('E','AI E',500000000,'臺北市'), ('F','AI F',900000000,'臺北市'),
        ('G','AI G',1000000000,'高雄市'), ('H','AI H',100000000,'臺北市'),
        ('I','AI I',null,'臺北市'), ('J','AI J',100000000,null);
      insert into solutions (solution_id, solution_name, company_id, record_status, price)
      select 'A' || n, 'AI A' || n, 'A', null, 1000 * n from generate_series(1,6) n;
      insert into solutions (solution_id, solution_name, company_id, record_status, price) values
        ('B1','AI B','B','疑似已下架_測試',2000),
        ('C1','AI C','C',null,3000), ('C2','AI C2','C',null,4000),
        ('D1','AI D','D',null,5000), ('E1','AI E','E','已下架_測試',6000),
        ('G1','AI G','G',null,7000), ('H1','AI H','H',null,8000),
        ('J1','AI J','J',null,9000), ('ORPHAN','AI orphan',null,null,10000);
      grant usage on schema sf_private to authenticated;
      grant select on all tables in schema public to authenticated;
    `)
    const old = read('migrations/20261014_sf_mcp_v1_2.sql')
    await db.exec(old.slice(old.indexOf('create function sf_private.sf_ranked('), old.indexOf('-- ---------- 3.')))
    await db.exec(old.slice(old.indexOf('create function public.sf_search_companies('), old.indexOf('-- ---------- 5.')))
    const cases = [
      '', "p_keyword=>'ai', p_cities=>array['台北市'], p_limit=>2",
      "p_sort=>'price_desc', p_limit=>2, p_offset=>1",
      "p_normal_only=>true, p_include_delisted=>true",
      "p_include_delisted=>true", 'p_offset=>5000',
    ]
    const baseline = await Promise.all(cases.map(search))
    await db.exec(read('migrations/20261104_sf_mcp_v1_3_capital.sql'))

    await t.test('six legacy queries preserve every old column, row and order', async () => {
      for (const [i, args] of cases.entries()) {
        const rows = await search(args)
        assert.deepEqual(rows.map(({ capital, capital_unknown_count, ...row }) => row), baseline[i])
      }
    })

    await t.test('bounds filter before counts and pagination; full-table scope differs', async () => {
      const rows = await search('p_min_capital=>100000000, p_limit=>1')
      assert.equal(rows[0].companies_total, 5)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].capital_unknown_count, 2) // C has two solutions but counts once; orphan is one group.
      assert.equal((await query('select count(*) as n from companies where capital >= 100000000'))[0].n, 7)
      const city = await search("p_min_capital=>100000000, p_cities=>array[' 台北市 ']")
      assert.equal(city[0].companies_total, 3)
      assert.equal(city[0].capital_unknown_count, 1)
      assert.equal(city[0].city_unknown_count, 1)
      assert.equal((await search('p_max_capital=>100000000'))[0].companies_total, 4)
      assert.equal((await search('p_min_capital=>100000000, p_max_capital=>100000000'))[0].companies_total, 3)
      assert.equal((await search('p_max_capital=>0'))[0].company_id, 'D')
      assert.equal((await search('p_min_capital=>0'))[0].companies_total, 6)
      assert.equal((await search('p_min_capital=>100000000, p_normal_only=>true'))[0].companies_total, 4)
      assert.equal((await search('p_min_capital=>100000000, p_include_delisted=>true'))[0].companies_total, 6)
    })

    await t.test('sorting is global, stable across pages, NULL last; previews remain capped at five', async () => {
      const rows = await search("p_sort=>'capital_desc'")
      assert.equal(rows[0].company_id, 'G')
      const caps = rows.map(row => row.capital)
      assert.deepEqual(caps, [1000000000, 200000000, 100000000, 100000000, 100000000, 0, null, null])
      assert.equal(rows.find(row => row.company_id === 'A').solutions_count, 6)
      assert.equal(rows.find(row => row.company_id === 'A').solutions.length, 5)
      const page = await search("p_sort=>'capital_desc', p_offset=>1, p_limit=>2")
      assert.deepEqual(page, rows.slice(1, 3))
    })

    await t.test('sentinel preserves totals and unknowns for empty and out-of-range pages', async () => {
      const empty = await search('p_min_capital=>2000000000')
      assert.equal(empty.length, 1)
      assert.equal(empty[0].company_key, null)
      assert.equal(empty[0].companies_total, 0)
      assert.equal(empty[0].capital_unknown_count, 2)
      const page = await search('p_min_capital=>100000000, p_offset=>5000')
      assert.equal(page[0].company_key, null)
      assert.equal(page[0].companies_total, 5)
      assert.equal(page[0].capital_unknown_count, 2)
    })

    await t.test('coverage counts all companies, counts zero, refreshes after isolated test update', async () => {
      assert.deepEqual(await query('select * from sf_capital_coverage()'), [{ with_capital: 8, total_companies: 10 }])
      await db.exec("update companies set capital=1 where company_id='I'")
      assert.deepEqual(await query('select * from sf_capital_coverage()'), [{ with_capital: 9, total_companies: 10 }])
      await db.exec("update companies set capital=null where company_id='I'")
    })

    await t.test('anonymous denied, authenticated read-only invoker allowed, overload removed', async () => {
      const rows = await query(`select p.proname, p.prosecdef, p.provolatile,
        has_function_privilege('anon', p.oid, 'execute') as anon,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated
        from pg_proc p join pg_namespace n on p.pronamespace=n.oid
        where n.nspname='public' and p.proname in ('sf_search_companies','sf_capital_coverage')`)
      assert.equal(rows.length, 2)
      for (const row of rows) {
        assert.equal(row.prosecdef, false)
        assert.equal(row.provolatile, 's')
        assert.equal(row.anon, false)
        assert.equal(row.authenticated, true)
      }
      await db.exec('set role authenticated')
      assert.equal((await search('p_min_capital=>100000000'))[0].companies_total, 5)
      await query('select * from sf_capital_coverage()')
      await db.exec('reset role')
    })

    await t.test('all handoff verification queries are SELECT statements and execute before deployment', async () => {
      const sql = read('_handover/VERIFY_sf-mcp-v1.3-capital_2026-11-04.sql')
      assert.doesNotMatch(sql, /\b(insert|update|delete|create|alter|drop|sf_search_companies|sf_capital_coverage\s*\()\b/i)
      const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)
      assert.equal(statements.length, 8)
      for (const statement of statements) {
        assert.match(statement, /^(SELECT|WITH)\b/)
        await query(statement)
      }
    })
  } finally {
    await db.close()
  }
})

// api/solutions.js — Vercel Serverless Function
// 從 Airtable 抓取 Solutions 資料，join Companies 的 region/is_startup/company_name
const DEFAULT_SOLUTIONS_SOURCE = 'airtable';
const ACTIVE_SOLUTIONS_FILTER = 'NOT(LEFT({record_status}, 3) = "已下架")';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appttP04OnzzC7qxG';

  function logAirtableError(table, status, body) {
    const time = new Date().toISOString();
    console.error(`[Airtable Error] status=${status} endpoint=${req.url} table=${table} time=${time} message=${body}`);
    if (status === 429) {
      console.error(`[Airtable Rate Limit] status=429 endpoint=${req.url} table=${table} time=${time}`);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function fetchAirtableWithRetry(url, headers, table, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetch(url, { headers });
      if (response.ok) return response;

      if (response.status === 429 && attempt < maxRetries) {
        const waitMs = 300 * Math.pow(2, attempt);
        console.error(`[Airtable Rate Limit] retry=${attempt + 1}/${maxRetries} endpoint=${req.url} table=${table} waitMs=${waitMs} time=${new Date().toISOString()}`);
        await sleep(waitMs);
        continue;
      }

      return response;
    }
  }

  async function fetchAll(table, filterByFormula = '') {
    let allRecords = [];
    let offset = null;
    do {
      let url = `https://api.airtable.com/v0/${BASE_ID}/${table}?pageSize=100`;
      if (offset) url += `&offset=${offset}`;
      if (filterByFormula) url += `&filterByFormula=${encodeURIComponent(filterByFormula)}`;
      const response = await fetchAirtableWithRetry(url, { Authorization: `Bearer ${TOKEN}` }, table);
      if (!response.ok) {
        const body = await response.text();
        logAirtableError(table, response.status, body);
        throw new Error(`Airtable error: ${response.status} — ${body}`);
      }
      const data = await response.json();
      allRecords = allRecords.concat(data.records);
      offset = data.offset || null;
    } while (offset);
    return allRecords;
  }

  function getSolutionsSource() {
    const source = String(process.env.DB_SOURCE_SOLUTIONS || DEFAULT_SOLUTIONS_SOURCE).trim().toLowerCase();
    if (source === 'airtable' || source === 'supabase') return source;
    throw new Error('DB_SOURCE_SOLUTIONS must be "airtable" or "supabase"');
  }

  async function fetchAllSupabasePaged(url, anonKey, table, selectCols, orderBy, filters = {}) {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.searchParams.set('select', selectCols);
    // 分頁必須指定穩定排序，否則 PostgREST 不保證跨頁順序，會出現重複 row / 漏抓
    endpoint.searchParams.set('order', orderBy);
    Object.entries(filters).forEach(([key, value]) => endpoint.searchParams.set(key, value));

    const pageSize = 1000;
    const all = [];
    let start = 0;

    while (true) {
      const response = await fetch(endpoint, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Range: `${start}-${start + pageSize - 1}`,
          'Range-Unit': 'items',
        },
      });

      // 當總筆數剛好是 pageSize 的倍數時，前一頁回滿 pageSize 筆會使迴圈續打下一頁，
      // 而該頁起點已超出資料範圍，PostgREST 回 416 Range Not Satisfiable。
      // 這是正常的「已抓完」訊號，不是錯誤，須在 !response.ok 判斷前先攔下並結束分頁。
      if (response.status === 416) break;

      if (!response.ok) {
        const body = await response.text();
        console.error(`[Supabase Error] status=${response.status} table=${table} time=${new Date().toISOString()} message=${body}`);
        throw new Error(`Supabase ${table} error: ${response.status} - ${body}`);
      }

      const page = await response.json();
      const rows = Array.isArray(page) ? page : [];
      all.push(...rows);
      if (rows.length < pageSize) break;
      start += pageSize;
    }

    console.log(`[Supabase] fetched table=${table} count=${all.length}`);
    return all;
  }

  async function fetchOptionalSupabaseColumn(url, anonKey, table, keyColumn, optionalColumn, orderBy, filters = {}) {
    try {
      const rows = await fetchAllSupabasePaged(
        url,
        anonKey,
        table,
        `${keyColumn},${optionalColumn}`,
        orderBy,
        filters
      );
      return new Map(rows.map(row => [String(row[keyColumn] || ''), row[optionalColumn] || '']));
    } catch (error) {
      console.warn(
        `[Supabase Optional Column] table=${table} column=${optionalColumn} time=${new Date().toISOString()} message=${error.message}`
      );
      return new Map();
    }
  }

  try {
    const source = getSolutionsSource();

    if (source === 'supabase') {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY not configured' });
      }

      const solutionFilters = {
        // Exclude every confirmed retired status beginning with 「已下架」;
        // retain legacy NULL and unverified 「疑似已下架」 statuses.
        or: '(record_status.is.null,record_status.not.like.已下架*)',
      };
      const [solRows, coRows, dataSourceBySolutionId] = await Promise.all([
        fetchAllSupabasePaged(
          supabaseUrl, supabaseAnonKey, 'solutions',
          // Stable fields required for the complete solution response.
          'solution_id,airtable_rec_id,company_id,solution_name,description,description_short,' +
          'slogan,has_ai,program_type,industry_category,price,price_tier,service_region,' +
          'target_industry,target_scale,has_award,has_certification,website_url,score_overall,' +
          'monthly_price,monthly_price_tier,subscription_months,features_list',
          'solution_id.asc',
          solutionFilters
        ),
        fetchAllSupabasePaged(
          supabaseUrl, supabaseAnonKey, 'companies',
          'company_id,company_name,region,is_startup,city,tech_tags,industry_vertical',
          'company_id.asc'
        ),
        // Schema-sensitive field: a missing column must not fail the complete API response.
        fetchOptionalSupabaseColumn(
          supabaseUrl,
          supabaseAnonKey,
          'solutions',
          'solution_id',
          'data_source',
          'solution_id.asc',
          solutionFilters
        ),
      ]);

      // Airtable 端 `f['x'] || ''` 空值回空字串；Supabase 空陣列 [] 是 truthy，需對齊
      const emptyToBlank = value => {
        if (Array.isArray(value)) return value.length ? value : '';
        return value || '';
      };

      const normalizeCid = value => {
        if (Array.isArray(value)) return String(value[0] || '').replace(/^\uFEFF/, '').trim();
        return String(value || '').replace(/^\uFEFF/, '').trim();
      };

      const companyByCid = {};
      coRows.forEach(row => {
        const cid = normalizeCid(row.company_id);
        const coData = {
          name: row.company_name || '',
          cid,
          region: row.region || '',
          is_startup: row.is_startup === true,
          city: row.city || '',
          tech_tags: emptyToBlank(row.tech_tags),
          industry_vertical_co: row.industry_vertical || '',
        };
        if (cid) companyByCid[cid] = coData;
      });

      const parseScore = value => {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      };

      const converted = solRows.map(row => {
        const cid = normalizeCid(row.company_id);
        const co = companyByCid[cid] || {};
        const hasAi = row.has_ai === true;

        return {
          // Airtable 版 solution_id 欄位名帶 BOM 讀不到，實際 fallback 到 rec.id
          // 遷移期比照該行為，rec_id 優先，避免 2429 筆 id 全不一致
          id: String(row.airtable_rec_id || row.solution_id || '').replace(/^\uFEFF/, ''),
          s: row.solution_name || '',
          c: co.name || '',
          // cid = 公司統一編號，作為重要查詢/識別欄位。
          // 遷移已完成、以 Supabase 為準，回傳實際統編（Airtable 版因 BOM 恆空的舊 bug 不再比照）。
          // company_id 已於 Supabase 端為乾淨 8 碼統編；無統編來源（農業部等）回空字串。
          cid: cid,
          p: row.program_type || '',
          src: dataSourceBySolutionId.get(String(row.solution_id || '')) || '',
          ai: hasAi,
          d: emptyToBlank(row.target_industry),
          cat: row.industry_category || '',
          iv: '',
          pr: parseFloat(row.price) || null,
          pt: row.price_tier || '',
          mo: parseFloat(row.monthly_price) || null,
          mt: row.monthly_price_tier || '',
          r: co.region || '',
          st: co.is_startup || false,
          city: co.city || '',
          ds: row.description_short || '',
          desc: row.description || '',
          feat: row.features_list || '',
          tags: co.tech_tags || '',
          scale: emptyToBlank(row.target_scale),
          slogan: row.slogan || '',
          sf: null,
          sp: null,
          ss: null,
          si: null,
          so: parseScore(row.score_overall),
        };
      });

      return res.status(200).json(converted);
    }

    const [solRecords, coRecords] = await Promise.all([
      fetchAll('Solutions', ACTIVE_SOLUTIONS_FILTER),
      fetchAll('Companies'),
    ]);

    // 建立兩種 lookup map：
    // 1. by company_id (統編) → 給文字欄位用
    // 2. by record ID → 給 Link 關聯欄位用
    const companyByCid = {};
    const companyByRecId = {};

    coRecords.forEach(rec => {
      const f = rec.fields;
      const cid = String(f['company_id'] || '').replace(/^\uFEFF/, '').trim();
      const coData = {
        name: f['company_name'] || '',
        cid: cid,
        region: f['region'] || '',
        is_startup: f['is_startup'] === true,
        city: f['city'] || '',
        tech_tags: f['tech_tags'] || '',
        industry_vertical_co: f['industry_vertical'] || '',
      };
      if (cid) companyByCid[cid] = coData;
      companyByRecId[rec.id] = coData;
    });

    const parseScore = value => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const converted = solRecords.map(rec => {
      const f = rec.fields;

      // company_id 可能是：
      // 1. Link 關聯欄位 → 陣列 ["recXXXXX"] (record ID)
      // 2. 純文字 → "12345678" (統編)
      let co = {};
      let cidDisplay = '';
      const rawCid = f['company_id'];

      if (Array.isArray(rawCid) && rawCid.length > 0) {
        // Link 關聯欄位：用 record ID 查
        co = companyByRecId[rawCid[0]] || {};
        cidDisplay = co.cid || '';
      } else {
        // 純文字：用統編查
        const cid = String(rawCid || '').replace(/^\uFEFF/, '').trim();
        co = companyByCid[cid] || {};
        cidDisplay = cid;
      }

      const hasAiRaw = f['has_ai'] || '';
      const hasAi = hasAiRaw === '有' || hasAiRaw === 'True' || hasAiRaw === true;

      return {
        id: String(f['solution_id'] || rec.id || '').replace(/^\uFEFF/, ''),
        s: f['solution_name'] || '',
        c: co.name || '',
        cid: cidDisplay,
        p: f['program_type'] || '',
        src: f['data_source'] || '',
        ai: hasAi,
        d: f['target_industry'] || '',
        cat: f['industry_category'] || '',
        iv: f['industry_vertical'] || '',
        pr: parseFloat(f['price']) || null,
        pt: f['price_tier'] || '',
        mo: parseFloat(f['monthly_price']) || null,
        mt: f['monthly_price_tier'] || '',
        r: co.region || '',
        st: co.is_startup || false,
        city: co.city || '',
        ds: f['description_short'] || '',
        desc: f['description'] || '',
        feat: f['features_list'] || '',
        tags: co.tech_tags || '',
        scale: f['target_scale'] || '',
        slogan: f['slogan'] || '',
        sf: parseScore(f['score_function']),
        sp: parseScore(f['score_price']),
        ss: parseScore(f['score_support']),
        si: parseScore(f['score_innovation']),
        so: parseScore(f['score_overall']),
      };
    });

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
}

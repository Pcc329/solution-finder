// api/solutions.js — Vercel Serverless Function
// 從 Supabase 抓取 Solutions 資料，join Companies 的 region/is_startup/company_name
import { requireAuth } from '../_lib/auth.js';
// 「跨N種計畫」只計入可佐證政府計畫參與的資料來源（允許清單，2026-10-13 PPC 決定）。
// 判斷標準：出現在該來源，能否佐證公司通過某政府計畫審核。
// 不計入：SME AI平台、政府軟體採購網（政府平台收錄／採購資格）、資策會產業調查、案例反推補建（非政府／內部）。
// 新增來源預設不計入，需人工判斷後加入本清單。
const PROGRAM_EVIDENCE_SOURCES = new Set([
  '臺灣雲市集',
  '雲市集工業館',
  '新創嚴選網',
  '商業服務業專區',
  '農業雲市集-數位館',
  '新北產業AI化輔導計畫',
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (!requireAuth(req, res)) return;

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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY not configured' });
    }

    const solutionFilters = {
      // Exclude every confirmed retired status beginning with 「已下架」; retain NULL and unverified 「疑似已下架」 statuses.
      or: '(record_status.is.null,record_status.not.like.已下架*)',
    };
    const [
      solRows,
      coRows,
      dataSourceBySolutionId,
      govRegistrationRows,
      cdmCategoryRows,
      caseEvidenceRows,
      awardRows,
    ] = await Promise.all([
      fetchAllSupabasePaged(
        supabaseUrl, supabaseAnonKey, 'solutions',
        // Stable fields required for the complete solution response.
        'solution_id,airtable_rec_id,company_id,solution_name,description,description_short,' +
        'slogan,has_ai,program_type,industry_category,price,price_tier,service_region,' +
        'target_industry,target_scale,has_award,has_certification,website_url,score_overall,' +
        'monthly_price,monthly_price_tier,subscription_months,features_list,pricing_model',
        'solution_id.asc',
        solutionFilters
      ),
      fetchAllSupabasePaged(
        supabaseUrl, supabaseAnonKey, 'companies',
        'company_id,company_name,region,is_startup,city,tech_tags,industry_vertical,logo_url,it_code_rank,tax_primary_name',
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
      fetchAllSupabasePaged(
        supabaseUrl,
        supabaseAnonKey,
        'gov_registrations',
        'company_id',
        'company_id.asc'
      ),
      fetchAllSupabasePaged(
        supabaseUrl,
        supabaseAnonKey,
        'company_cdm_categories',
        'company_id',
        'company_id.asc'
      ),
      fetchAllSupabasePaged(
        supabaseUrl,
        supabaseAnonKey,
        'cases',
        'provider_linked_company_id',
        'provider_linked_company_id.asc',
        { provider_linked_company_id: 'not.is.null' }
      ),
      fetchAllSupabasePaged(
        supabaseUrl,
        supabaseAnonKey,
        'awards',
        'company_id,award_category,award_name,award_year',
        'company_id.asc'
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

    const toCidSet = (rows, fieldName) => new Set(
      rows
        .map(row => normalizeCid(row[fieldName]))
        .filter(Boolean)
    );
    const govRegisteredCids = toCidSet(govRegistrationRows, 'company_id');
    const cdmClassifiedCids = toCidSet(cdmCategoryRows, 'company_id');
    const caseEvidenceCids = toCidSet(caseEvidenceRows, 'provider_linked_company_id');
    const TIER_PRIORITY = { '國際級': 3, '國家級': 2, '產業級': 1 };
    const awardTierByCid = new Map();
    const awardListByCid = new Map();
    const awardYearValue = value => {
      const match = String(value ?? '').match(/\d{4}/);
      return match ? Number(match[0]) : -Infinity;
    };
    awardRows.forEach(row => {
      const cid = normalizeCid(row.company_id);
      if (!cid) return;
      const tier = TIER_PRIORITY[row.award_category] ? row.award_category : null;
      const priority = TIER_PRIORITY[tier] || 0;
      const current = awardTierByCid.get(cid);
      if (!current || priority > current.priority) {
        awardTierByCid.set(cid, { tier, priority });
      }
      if (!awardListByCid.has(cid)) awardListByCid.set(cid, []);
      awardListByCid.get(cid).push({
        name: row.award_name || '未命名獎項',
        year: row.award_year || null,
        category: row.award_category || null,
      });
    });
    awardListByCid.forEach(awards => {
      awards.sort((left, right) => {
        const byYear = awardYearValue(right.year) - awardYearValue(left.year);
        if (byYear) return byYear;
        return (TIER_PRIORITY[right.category] || 0) - (TIER_PRIORITY[left.category] || 0);
      });
    });

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
        logo_url: row.logo_url || '',
        tax_primary_name: row.tax_primary_name || '',
        it_code_rank: row.it_code_rank,
      };
      if (cid) companyByCid[cid] = coData;
    });

    const parseScore = value => {
      if (value === null || value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    // Reuse the already fetched solution rows: no extra Supabase request is needed.
    const programTypesByCid = new Map();
    solRows.forEach(row => {
      const cid = normalizeCid(row.company_id);
      const pt = (row.program_type || '').trim();
      if (!cid || !pt || !PROGRAM_EVIDENCE_SOURCES.has(pt)) return;
      if (!programTypesByCid.has(cid)) programTypesByCid.set(cid, new Set());
      programTypesByCid.get(cid).add(pt);
    });

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
        logo: co.logo_url || '',
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
        tax: co.tax_primary_name || '',
        itr: (co.it_code_rank === null || co.it_code_rank === undefined) ? null : Number(co.it_code_rank),
        st: co.is_startup || false,
        city: co.city || '',
        ds: row.description_short || '',
        desc: row.description || '',
        feat: row.features_list || '',
        pm: Array.isArray(row.pricing_model) ? row.pricing_model : [],
        tags: co.tech_tags || '',
        scale: emptyToBlank(row.target_scale),
        slogan: row.slogan || '',
        sf: null,
        sp: null,
        ss: null,
        si: null,
        gov: govRegisteredCids.has(cid),
        cdm: cdmClassifiedCids.has(cid),
        cs: caseEvidenceCids.has(cid),
        awd: awardTierByCid.has(cid),
        awdTier: awardTierByCid.get(cid)?.tier || null,
        awdList: awardListByCid.get(cid) || [],
        pgc: programTypesByCid.get(cid)?.size || 0,
        pgList: Array.from(programTypesByCid.get(cid) || []),
        so: parseScore(row.score_overall),
      };
    });

    return res.status(200).json(converted);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
}

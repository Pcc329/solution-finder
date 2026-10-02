// SF MCP v1.0.4 — 唯讀。設計文件：SF_MCP設計評估_定案範圍_2026-10-01.md
// 認證：Supabase Auth 為 OAuth 2.1 授權伺服器；每次工具呼叫都以「登入者本人」身分查詢，受 RLS 與白名單約束。
// 注意：這支函式刻意【沒有任何寫入工具】；也不回傳完整描述(description)、email、手機。
// 搜尋邏輯移植自 public/index.html（資料庫函式 sf_search_solutions，28 項對照測試與首頁程式碼結果一致）。
// 依賴套件鎖定確切版本（公開的認證端點，避免依賴自動漂移到剛發布的版本）；升級前須重新測試。
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { pipeline } from 'npm:@supabase/middleware@0.5.0'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1.7.0'
import { z } from 'npm:zod@4.6.5'

const ACTIVE_FILTER = 'record_status.is.null,record_status.not.like.已下架*'

const clip = (v: string | null | undefined, n: number): string => {
  const s = (v ?? '').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}
const asText = (obj: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(obj) }] })

const SERVER_VERSION = '1.0.4'

// target_industry 在資料庫有兩種存法：多個元素的陣列，或單一字串內以「, 」（雲市集）或「；」（主計總處分類）分隔。
// 一律攤平成產業清單，才能算出「這個方案列了幾類產業」。
const flattenIndustries = (arr: unknown): string[] =>
  Array.isArray(arr) ? arr.flatMap((e) => String(e ?? '').split(/；|, /).map((x) => x.trim()).filter(Boolean)) : []

// awards 表：award_category＝層級（國際級／國家級／產業級），award_level＝得獎結果（獲獎、金獎、精品獎…）
const AWARD_TIERS = ['國際級', '國家級', '產業級']
const bestAwardTier = (cats: string[]): string | null =>
  AWARD_TIERS.find((t) => cats.includes(t)) ?? (cats.length ? '其他' : null)

const DATA_GUIDE = `# 產業策略智庫（SF）資料說明與使用原則

## 一、資料是什麼
- 這是彙整台灣中小企業數位轉型相關「方案」的資料庫，來源包含臺灣雲市集、雲市集工業館、SME AI 平台、新創嚴選網、農業雲市集、商業服務業專區、政府軟體採購網、新北產業AI化輔導計畫、資策會產業調查等。
- 收錄不等於推薦、認證或品質評分。方案文字多來自廠商或來源平台自述，未經逐筆查證。引用時請避免當成「已驗證的能力」。
- 實際筆數請用 data_status 查詢，不要憑記憶回答。

## 二、狀態（record_status）
- 正常：在來源平台上架中。
- 疑似已下架_…：名單層級的證據顯示可能已下架，尚未逐筆驗證。search_solutions 預設仍會回傳，請在回答中標註。
- 已下架_…：已確認失效。預設排除，除非 include_delisted=true。

## 三、「地區」有三種意思，回答前必須說明採用哪一種
1. 公司所在地（companies.region：北部／中部／南部／東部／其他）。這是官網首頁「地區」篩選的定義，也是 search_solutions 的 region 參數所用。
2. 方案服務範圍（service_region）：另一套詞彙（北北基、桃竹苗、中彰投、雲嘉南、高屏、宜花東、離島、全台灣、不限區域…），且與「北部／中部」等混用。本工具目前不提供此篩選。
3. 一般口語的「北部」。
- 公司所在地有相當比例未填（用 data_status 的 coverage 查看目前缺口），這些方案不會被地區篩選涵蓋。回答「北部有幾筆」時，務必同時說明定義與未涵蓋的筆數。

## 四、排序與關鍵字（與首頁一致）
- keyword 是單一字串的子字串比對（不分大小寫），比對方案名稱、公司名稱、描述、功能、標語、類別、技術標籤。
- 相關性加權：方案名稱100、公司名稱80、類別70、標語40、描述30、功能20、標籤10；另有產業別加權（query_text 偵測到餐飲/製造/金融/醫療/零售電商/物流/教育/旅遊時，每命中一個產業詞 +12）；industry_keyword 命中 target_industry +50（區分大小寫）。
- 因此 keyword 請只放「一個最關鍵的詞」，其餘條件用篩選參數表達。不要把整句話塞進 keyword。

## 五、把口語需求轉成參數（與首頁的 LLM 解析規則一致）
需求 → keyword：
- 接觸新客戶、開發客戶、業績成長 → 行銷
- 改善客戶體驗、顧客服務、客戶滿意 → 客服
- 數位轉型入門、開始數位化、數位化第一步 → 數位
- 提升辦公室效率、辦公自動化、文件管理 → 辦公
- 吸引人才、招募人才、人才管理 → 人資
- 資訊安全、網路安全、資安防護 → 資安
- 供應鏈管理、進銷存、倉儲物流 → 供應鏈
- 碳排放、淨零、ESG → 碳
詞 → category（9 個值：銷售管理／行銷推廣／生產物流／協作辦公／人力資源／資安合規／研發創新／醫療照護／暫無法分類）：
- 醫療照護、長照、診所、醫院、健康 → 醫療照護
- 資安、資訊安全、網路安全、合規 → 資安合規
- ERP、進銷存、供應鏈、倉儲、物流、生產 → 生產物流
- CRM、銷售、POS、訂單、報價 → 銷售管理
- SEO、廣告、行銷、社群、官網 → 行銷推廣
- HR、人資、招募、排班、薪資 → 人力資源
- 協作、辦公、專案管理、會議、文件 → 協作辦公
- AI開發、資料分析、IoT、研發 → 研發創新
產業名 → industry_keyword（子字串比對，區分大小寫；請用下列「詞根」）：
- 餐飲 → 餐飲；製造 → 製造；零售、電商 → 零售；醫療 → 醫療；物流 → 運輸及倉儲
- 建築、營造 → 營建；金融、銀行、保險 → 金融；教育 → 教育；旅遊、旅宿、住宿 → 旅宿
- 為什麼用詞根：「目標產業」欄位有多套寫法並存（例如「金融保險」與「K金融及保險業」、「批發零售業」與「G批發及零售業」）。官網首頁的對照使用較長的值，只會命中其中一套；詞根可同時涵蓋，命中數可能多一倍以上（金融 52→112、零售 225→363）。因此 MCP 的產業加權會與官網首頁略有差異，這是刻意的。
範例：「金融業想要改善客戶體驗」→ keyword=客服、industry_keyword=金融、query_text=原句。
金額要轉成數字（「5萬」=50000）。若無法精確解析，至少取最關鍵的一個詞當 keyword，不要回傳空條件。

## 六、目標產業（target_industry）怎麼讀
- industry_keyword 只是「加權」，不是篩選：沒命中的方案仍會出現在結果裡。所以「251 筆客服方案」不等於「金融業可用的 251 筆」。
- 許多方案列了很多產業（有的列十幾類）或寫「通用／不限產業」。列出某產業 ≠ 專門針對該產業。搜尋結果的 industries_count 是該方案列了幾類產業，數字越大越通用；industries_sample 是前幾類。要回答「專門針對某產業」時，請看 industries_count，並說明判斷依據。

## 七、搜尋技巧
- keyword 是整段子字串比對：「入住自動化」這種詞組可能 0 筆，請拆成較短的詞（如「入住」）。
- 一次只能放一個 keyword。需求包含多種能力時，分別搜尋，再用方案 id 取交集。
- region 是「廠商總部」所在地，不是客戶所在地。客戶在哪個縣市無法用 region 篩選；請不要用客戶所在地去設定 region，否則會漏掉服務全台的外地廠商。
- 回答「有多少」時，同時給出「已確認在架」與「含疑似已下架」兩個數字；疑似下架的原因與數量可用 data_status 查看。

## 八、稅籍登記主業（2026-10-02 起）
- companies 有三個來自財政部營業（稅籍）登記的欄位：tax_primary_name（第 1 個行業代號名稱）、tax_primary_code（6 碼）、it_code_rank（62/63 資訊服務代號首次出現的順位 1～4；0＝登記中無 62/63；null＝不在名冊，未知）。
- 代號由營業人設立時自行申報、少更新，只能說「稅籍登記主業」，不能說「主力業務」或「品質」。例：思偉達是 AI 客服公司，稅籍第 1 碼卻是電腦設備批發（it_code_rank=2）。
- 目前只標示、不影響排序。回答「這家是不是資服業」時，請引用 tax_primary_name 與 it_code_rank 並說明限制；it_code_rank 為 null 時說「不在名冊、未知」，不要當成 0。
- get_solution 會回傳該公司完整的稅籍代號清單（tax_industries，依申報順序）。

## 九、獲獎肯定（公司層級）
- 官網卡片上的「獲獎肯定」來自 awards 表（公司層級的獲獎紀錄，依 company_id），不是方案欄位 solution.has_award。兩者差很多：有效方案中 has_award=true 僅 49 筆，但公司在 awards 有紀錄的有效方案有 272 筆。
- 搜尋結果的 has_company_award／company_award_count／company_award_best_level（國際級＞國家級＞產業級）與 get_solution 的 company_awards 才對應官網。回答「有沒有獲獎」請引用這些欄位，不要只看 solution.has_award。
- 獲獎是「公司」得的，不代表該方案本身得獎；引用時請寫「該公司曾獲○○」。
- awards 的 award_category 是層級（國家級…），award_level 是得獎結果（獲獎、金獎、精品獎…），不要弄反。

## 十、其他
- 價格欄位為 0 或空白代表「未提供」，不是免費。max_price 篩選會排除未提供價格的方案。
- 本工具只回傳簡短描述；聯絡人僅提供姓名、職稱、公司電話。
- 引用任何數字時，請附上定義與資料缺口，避免使用者誤解。`

Deno.serve(
  pipeline(
    // 1. OAuth 探索（RFC 9728）  2. 驗證使用者權杖，並取得「以該使用者身分」的 Supabase 用戶端
    [withOAuthProtectedResource(), withSupabase({ auth: 'user' })],
    async (req, { supabase }) => {
      // Edge Function 無狀態：每個請求建立新的 server
      const handler = createMcpHandler(() => {
        const server = new McpServer({ name: 'sf-mcp', version: SERVER_VERSION })

        server.registerTool(
          'describe_data',
          {
            description:
              '資料定義與使用原則：資料來源、狀態詞、「北部」等地區的多種定義、關鍵字/類別/產業的口語對照表、排序規則。第一次搜尋前、或需要回答筆數與比例時，請先讀這份說明。',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => ({ content: [{ type: 'text' as const, text: DATA_GUIDE }] })
        )

        server.registerTool(
          'search_solutions',
          {
            description:
              '搜尋產業策略智庫的方案，篩選與排序邏輯與官網首頁一致。把使用者的需求拆成：一個最關鍵的 keyword + 其他篩選參數（對照表請見 describe_data）。回傳符合筆數與前幾名方案摘要；total_matches 是符合的總筆數。若使用 region，請在回答中說明定義為「公司所在地」（廠商總部，不是客戶位置）並引用回傳的 notes。keyword 整詞比對得到 0 筆時，請改用更短的詞；需求含多種能力時請分次搜尋再用 id 取交集。',
            inputSchema: z.object({
              keyword: z.string().max(60).optional().describe('單一最關鍵的詞（子字串比對），例如「客服」「資安」'),
              query_text: z.string().max(200).optional().describe('使用者的原句，只用來偵測產業別加權'),
              industry_keyword: z.string().max(30).optional().describe('target_industry 的子字串詞根（區分大小寫），例如「餐飲」「金融」「零售」；詞根對照見 describe_data。這是加權，不是篩選'),
              region: z.array(z.enum(['北部', '中部', '南部', '東部', '其他'])).max(5).optional().describe('公司所在地'),
              is_ai: z.boolean().optional().describe('是否為 AI 方案'),
              is_startup: z.boolean().optional().describe('公司是否為新創'),
              is_gov: z.boolean().optional().describe('公司是否有政府能量登錄'),
              pricing_model: z.string().max(20).optional().describe('計價方式，例如「訂閱制」'),
              category: z.array(z.string().max(20)).max(9).optional().describe('服務類別（子字串比對），9 個值見 describe_data'),
              program: z.array(z.string().max(40)).max(10).optional().describe('資料來源名稱，完整清單見 data_status'),
              max_price: z.number().min(0).max(100000000).optional().describe('總費用上限（元）。未提供價格的方案會被排除'),
              include_delisted: z.boolean().default(false).describe('是否包含已下架（預設排除）'),
              sort: z.enum(['relevance', 'price_asc', 'price_desc']).default('relevance'),
              limit: z.number().int().min(1).max(50).default(20),
              offset: z.number().int().min(0).max(5000).default(0),
            }),
            annotations: { readOnlyHint: true },
          },
          async (a) => {
            const { data, error } = await supabase.rpc('sf_search_solutions', {
              p_keyword: a.keyword,
              p_query_text: a.query_text,
              p_industry_keyword: a.industry_keyword,
              p_region: a.region,
              p_is_ai: a.is_ai,
              p_is_startup: a.is_startup,
              p_is_gov: a.is_gov,
              p_pricing_model: a.pricing_model,
              p_category: a.category,
              p_program: a.program,
              p_max_price: a.max_price,
              p_include_delisted: a.include_delisted,
              p_sort: a.sort,
              p_limit: a.limit,
              p_offset: a.offset,
            })
            if (error) throw new Error(error.message)
            const rows = (data ?? []) as Array<Record<string, unknown>>
            const total = rows.length ? Number(rows[0].total_matches) : 0

            const notes: string[] = []
            if (a.region && a.region.length) {
              const cov = await supabase.rpc('sf_data_coverage')
              const row = (cov.data as Array<Record<string, unknown>> | null)?.[0]
              if (row) {
                notes.push(
                  `地區篩選的定義是「公司所在地」（與官網首頁一致）。目前有效方案中有 ${row.company_region_missing} 筆（共 ${row.active_solutions} 筆）的公司所在地未填，不會被納入此數字，實際可能更多。`
                )
              } else {
                // 取不到缺口資訊時不可靜默略過：明確警告，並要求回答時說明
                notes.push(
                  `⚠️ 無法取得「公司所在地未填」的筆數（${cov.error?.message ?? '無資料'}）。地區篩選只涵蓋有填寫公司所在地的方案，實際筆數可能更多；引用此數字時請務必說明這個限制。`
                )
              }
            }
            if (a.max_price) notes.push('max_price 會排除未提供價格（0 或空白）的方案。')
            if (a.include_delisted) notes.push('結果包含已下架方案，請看 status 欄位。')
            if (rows.some((r) => String(r.record_status ?? '').startsWith('疑似'))) {
              notes.push('部分結果的 status 為「疑似已下架」，尚未逐筆驗證，引用時請標註。')
            }
            if (total > a.offset + rows.length) {
              notes.push(`還有更多結果；可用 offset=${a.offset + rows.length} 取得下一頁。`)
            }

            // 補上「列了幾類產業」，讓使用者能分辨專用與通用方案（失敗時明確告知，不靜默略過）
            const ids = rows.map((r) => String(r.solution_id))
            const indMap = new Map<string, unknown>()
            const taxMap = new Map<string, { rank: number | null; name: string | null }>()
            const cids = [...new Set(rows.map((r) => String(r.company_id ?? '')).filter(Boolean))]
            if (cids.length) {
              const tx = await supabase.from('companies').select('company_id, it_code_rank, tax_primary_name').in('company_id', cids)
              if (tx.error) notes.push(`⚠️ 無法取得稅籍登記資訊（${tx.error.message}）。`)
              else for (const x of (tx.data ?? []) as Array<Record<string, unknown>>) taxMap.set(String(x.company_id), { rank: x.it_code_rank == null ? null : Number(x.it_code_rank), name: (x.tax_primary_name as string) ?? null })
            }
            const awardMap = new Map<string, { count: number; best: string | null }>()
            if (cids.length) {
              const aw = await supabase.from('awards').select('company_id, award_category').in('company_id', cids)
              if (aw.error) notes.push(`⚠️ 無法取得獲獎資訊（${aw.error.message}），has_company_award 為空。`)
              else {
                const byCo = new Map<string, string[]>()
                for (const x of (aw.data ?? []) as Array<Record<string, unknown>>) {
                  const k = String(x.company_id)
                  byCo.set(k, [...(byCo.get(k) ?? []), String(x.award_category ?? '')])
                }
                for (const [k, cats] of byCo) awardMap.set(k, { count: cats.length, best: bestAwardTier(cats) })
              }
            }
            if (ids.length) {
              const ind = await supabase.from('solutions').select('solution_id, target_industry').in('solution_id', ids)
              if (ind.error) {
                notes.push(`⚠️ 無法取得產業別資訊（${ind.error.message}），結果中的 industries_count 為空。`)
              } else {
                for (const x of (ind.data ?? []) as Array<Record<string, unknown>>) indMap.set(String(x.solution_id), x.target_industry)
              }
            }
            const pageSummary = {
              normal: rows.filter((r) => !String(r.record_status ?? '').startsWith('疑似')).length,
              suspected_delisted: rows.filter((r) => String(r.record_status ?? '').startsWith('疑似')).length,
              company_region_missing: rows.filter((r) => !r.region).length,
              in_tax_registry: rows.filter((r) => taxMap.get(String(r.company_id ?? ''))?.rank != null).length,
              with_company_award: rows.filter((r) => awardMap.has(String(r.company_id ?? ''))).length,
              matches_industry_keyword: a.industry_keyword
                ? rows.filter((r) => flattenIndustries(indMap.get(String(r.solution_id))).join('｜').includes(a.industry_keyword as string)).length
                : null,
            }
            return asText({
              total_matches: total,
              returned: rows.length,
              offset: a.offset,
              page_summary: pageSummary,
              notes: [...notes, '筆數統計（正常／疑似／未填地區／命中產業詞）請直接引用 page_summary，不要自行點算。'],
              results: rows.map((r) => {
                const inds = flattenIndustries(indMap.get(String(r.solution_id)))
                const tax = taxMap.get(String(r.company_id ?? ''))
                return ({
                id: r.solution_id,
                name: r.solution_name,
                company: r.company_name,
                company_id: r.company_id,
                source: r.program_type,
                category: r.industry_category,
                company_region: r.region || null,
                is_ai: r.has_ai,
                is_startup: r.is_startup,
                is_gov_registered: r.is_gov,
                price: r.price || null,
                monthly_price: r.monthly_price || null,
                pricing_model: r.pricing_model,
                slogan: clip(r.slogan as string, 80),
                summary: clip(r.description_short as string, 160),
                status: r.record_status || '正常',
                score: r.score,
                industries_count: indMap.has(String(r.solution_id)) ? inds.length : null,
                industries_sample: inds.slice(0, 3),
                matches_industry_keyword: a.industry_keyword ? inds.join('｜').includes(a.industry_keyword) : null,
                tax_primary_industry: tax?.name ?? null,
                it_code_rank: tax?.rank ?? null,
                has_company_award: awardMap.has(String(r.company_id ?? '')),
                company_award_count: awardMap.get(String(r.company_id ?? ''))?.count ?? 0,
                company_award_best_level: awardMap.get(String(r.company_id ?? ''))?.best ?? null,
              })
              }),
            })
          }
        )

        server.registerTool(
          'get_solution',
          {
            description:
              '取得單一方案的詳細資料：方案欄位、公司資料、聯絡人（僅姓名、職稱、公司電話）、是否有政府能量登錄。solution_id 來自 search_solutions 的 id。不回傳完整描述、email、手機。',
            inputSchema: z.object({ solution_id: z.string().min(1).max(60) }),
            annotations: { readOnlyHint: true },
          },
          async ({ solution_id }) => {
            const sol = await supabase
              .from('solutions')
              .select(
                'solution_id, solution_name, company_id, program_type, data_source, industry_category, function_category, has_ai, price, price_tier, monthly_price, monthly_price_tier, subscription_months, pricing_model, service_region, target_industry, target_scale, has_award, has_certification, website_url, slogan, description_short, features_list, record_status'
              )
              .eq('solution_id', solution_id)
              .maybeSingle()
            if (sol.error) throw new Error(sol.error.message)
            if (!sol.data) return asText({ found: false, message: `找不到 solution_id=${solution_id}（請確認 id 來自 search_solutions）` })

            const s = sol.data as Record<string, unknown>
            const cid = String(s.company_id ?? '')
            let company: unknown = null
            let contacts: unknown = []
            let govRegistered: boolean | null = null
            let taxIndustries: unknown = []
            let companyAwards: unknown = []
            if (cid) {
              const aw = await supabase.from('awards').select('award_year, award_category, award_level, award_name, host_org').eq('company_id', cid).order('award_year', { ascending: false }).limit(10)
              if (aw.error) throw new Error(aw.error.message)
              companyAwards = aw.data ?? []
              const ti = await supabase.from('company_tax_industry').select('code_rank, code6, code_name, snapshot_date').eq('company_id', cid).order('code_rank')
              if (ti.error) throw new Error(ti.error.message)
              taxIndustries = ti.data ?? []
              const co = await supabase
                .from('companies')
                .select('company_id, company_name, region, city, is_startup, tech_tags, it_code_rank, tax_primary_code, tax_primary_name')
                .eq('company_id', cid)
                .maybeSingle()
              if (co.error) throw new Error(co.error.message)
              company = co.data
              const ct = await supabase.from('contacts').select('contact_name, title, office_phone').eq('company_id', cid).limit(5)
              if (ct.error) throw new Error(ct.error.message)
              contacts = ct.data ?? []
              const gv = await supabase.from('gov_registrations').select('company_id', { count: 'exact', head: true }).eq('company_id', cid)
              if (gv.error) throw new Error(gv.error.message)
              govRegistered = (gv.count ?? 0) > 0
            }
            const contactNotes = (contacts as unknown[]).length
              ? ['聯絡人的 email 與手機基於個資保護不提供；公司電話欄位空白，只代表沒有登錄公司電話，不代表沒有其他聯絡方式。如需聯絡，請洽資料維護者。']
              : ['此方案的公司沒有登錄聯絡人。']
            return asText({
              found: true,
              solution: {
                ...s,
                slogan: clip(s.slogan as string, 200),
                description_short: clip(s.description_short as string, 800),
                features_list: clip(s.features_list as string, 1500),
                price: s.price || null,
                monthly_price: s.monthly_price || null,
                status: s.record_status || '正常',
              },
              company,
              contacts,
              gov_registered: govRegistered,
              tax_industries: taxIndustries,
              company_awards: companyAwards,
              notes: ['收錄不等於推薦或認證；方案文字多為廠商自述，未經逐筆查證。', '獲獎（company_awards）是公司層級的紀錄（award_category＝層級、award_level＝得獎結果），不代表此方案本身得獎；solution.has_award 是方案層級的標記，兩者不同，回答「有沒有獲獎」請引用 company_awards。', '稅籍行業代號（tax_industries／company.it_code_rank）為營業人自行申報、少更新，只代表登記主業，不代表實際主力業務或品質；it_code_rank 為 null 表示不在名冊。', ...contactNotes],
            })
          }
        )

        server.registerTool(
          'data_status',
          {
            description:
              '資料現況：各資料來源的方案數（正常／疑似已下架／已下架），以及資料缺口（公司所在地未填、服務範圍空白、價格未提供的筆數）。回答任何「有幾筆」的問題前，請用它取得最新數字。',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const st = await supabase.rpc('sf_data_status')
            if (st.error) throw new Error(st.error.message)
            const cv = await supabase.rpc('sf_data_coverage')
            if (cv.error) throw new Error(cv.error.message)
            const rs = await supabase.rpc('sf_status_reasons')
            if (rs.error) throw new Error(rs.error.message)
            const cov = (cv.data as Array<Record<string, unknown>>)[0]
            const rows = (st.data ?? []) as Array<Record<string, unknown>>
            const sum = (k: string) => rows.reduce((t, r) => t + Number(r[k] ?? 0), 0)
            return asText({
              totals: {
                all_records: sum('total_count'),
                normal: sum('normal_count'),
                suspected_delisted: sum('suspected_count'),
                delisted: sum('delisted_count'),
                active_visible_on_site: cov?.active_solutions,
              },
              coverage_gaps_among_active: {
                company_region_missing: cov?.company_region_missing,
                service_region_missing: cov?.service_region_missing,
                price_missing: cov?.price_missing,
              },
              non_normal_reasons: ((rs.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
                source: r.program_type,
                status: r.status_reason,
                count: r.record_count,
              })),
              server_version: SERVER_VERSION,
              by_source: rows.map((r) => ({
                source: r.program_type,
                normal: r.normal_count,
                suspected_delisted: r.suspected_count,
                delisted: r.delisted_count,
                total: r.total_count,
              })),
              notes: ['active_visible_on_site = 前台可見（排除已下架，含疑似已下架）。', 'non_normal_reasons 是「疑似已下架／已下架」的實際原因與筆數；解釋為什麼某來源大量疑似下架時，請引用這裡的原因，不要自行推測。', '詳細定義請參考 describe_data。'],
            })
          }
        )

        server.registerTool(
          'whoami',
          {
            description: '顯示目前以哪個帳號連線到產業策略智庫（用來確認連線與身分）',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const { data, error } = await supabase.auth.getUser()
            if (error) throw new Error(error.message)
            return asText({ id: data.user?.id, email: data.user?.email, server_version: SERVER_VERSION })
          }
        )

        server.registerTool(
          'count_solutions',
          {
            description: '回傳方案筆數：total 為資料庫全部筆數（含已下架）、active 為前台可見筆數（排除已下架）。用來驗證資料存取權限。',
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const total = await supabase.from('solutions').select('*', { count: 'exact', head: true })
            if (total.error) throw new Error(total.error.message)
            const active = await supabase.from('solutions').select('*', { count: 'exact', head: true }).or(ACTIVE_FILTER)
            if (active.error) throw new Error(active.error.message)
            return asText({ total: total.count, active: active.count })
          }
        )

        return server
      })

      return handler.fetch(req)
    }
  )
)

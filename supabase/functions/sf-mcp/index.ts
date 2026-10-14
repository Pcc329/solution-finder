// SF MCP v1.2.0 — 唯讀工具；搜尋由資料庫篩選、計數後分頁，提供結構化輸出與下一步建議。
// sf_mcp_touch 僅記錄登入者用量；第一階段不阻擋，沒有業務資料寫入工具。
// 認證：Supabase Auth 為 OAuth 2.1 授權伺服器；每次工具呼叫都以「登入者本人」身分查詢，受 RLS 與白名單約束。
// 注意：沒有業務資料寫入工具；不回傳完整描述(description)、第三方 email、手機；whoami 可回傳登入者本人 email。
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
const asText = (obj: Record<string, unknown>) => {
  const text = JSON.stringify(obj)
  return { structuredContent: JSON.parse(text) as Record<string, unknown>, content: [{ type: 'text' as const, text }] }
}

const SERVER_VERSION = '1.2.0'
const RATE_LIMIT_ENFORCE = false

// target_industry 在資料庫有兩種存法：多個元素的陣列，或單一字串內以「, 」（雲市集）或「；」（主計總處分類）分隔。
// 一律攤平成產業清單，才能算出「這個方案列了幾類產業」。
const flattenIndustries = (arr: unknown): string[] =>
  Array.isArray(arr) ? arr.flatMap((e) => String(e ?? '').split(/；|, /).map((x) => x.trim()).filter(Boolean)) : []

// awards 表：award_category＝層級（國際級／國家級／產業級），award_level＝得獎結果（獲獎、金獎、精品獎…）
const AWARD_TIERS = ['國際級', '國家級', '產業級']
const bestAwardTier = (cats: string[]): string | null =>
  AWARD_TIERS.find((t) => cats.includes(t)) ?? (cats.length ? '其他' : null)

type Row = Record<string, unknown>

const DATA_GUIDE = `# 產業策略智庫（SF）資料說明與使用原則

## 一、資料是什麼
- 這是彙整台灣中小企業數位轉型相關「方案」的資料庫，來源包含臺灣雲市集、雲市集工業館、SME AI 平台、新創嚴選網、農業雲市集、商業服務業專區、政府軟體採購網、新北產業AI化輔導計畫、資策會產業調查等。
- 收錄不等於推薦、認證或品質評分。方案文字多來自廠商或來源平台自述，未經逐筆查證。引用時請避免當成「已驗證的能力」。
- 實際筆數請用 data_status 查詢，不要憑記憶回答。

## 二、狀態（record_status）
- 正常：在來源平台上架中。
- 疑似已下架_…：名單層級的證據顯示可能已下架，尚未逐筆驗證。search_solutions 預設仍會回傳，請在回答中標註。
- 已下架_…：已確認失效。預設排除，除非 include_delisted=true。
- 回答格式：每筆疑似下架標『⚠疑似下架』，最後一句總說明；被問到才說明原因。推薦類問題請用 normal_only=true。

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

## 十、清單類任務怎麼做才快（避免上百次呼叫）
- 「某縣市有○○的廠商與方案」：用 search_companies（廠商為單位）或 search_solutions 加 city 參數，**一次呼叫**即可；不要先搜尋再對每一筆呼叫 get_solution 去查城市（結果已含 company_city）。
- city 比對台／臺視為相同；資料庫採官方寫法「臺」。縣市未填的公司無法判斷，伺服器會在 notes 回報筆數，請在回答中說明。
- 要看多筆方案的詳情，用 get_solutions（一次最多 20 筆）；只對最後的少數候選才用 get_solution（含聯絡人）。
- 子字串比對會有誤判（例如 POS 會搜到 Posky、只做電子發票的方案）：請用回傳的 summary 判斷是否真的相關，並在回答中標註哪些不是。
- 需要匯出檔案時，請先在對話中整理成表格，再用你自己的工具輸出；本資料庫連接器唯讀，不能產生檔案。

## 十一、其他
- 價格欄位為 0 或空白代表「未提供」，不是免費。max_price 篩選會排除未提供價格的方案。
- 本工具只回傳簡短描述；聯絡人僅提供姓名、職稱、公司電話。
- 引用數字時優先使用 summary_line；定義與缺口用一句帶過，被問到再展開。`

const searchFields = {
  keyword: z.string().max(60).optional().describe('單一最關鍵的詞（子字串比對），例如「客服」「資安」'),
  query_text: z.string().max(200).optional().describe('使用者的原句，只用來偵測產業別加權'),
  industry_keyword: z.string().max(30).optional().describe('target_industry 的子字串詞根（區分大小寫），例如「餐飲」「金融」「零售」；詞根對照見 describe_data。這是加權，不是篩選'),
  region: z.array(z.enum(['北部', '中部', '南部', '東部', '其他'])).max(5).optional().describe('公司所在地（北中南東區，廠商總部）'),
  city: z.array(z.string().max(10)).max(10).optional().describe('公司所在縣市（廠商總部），例如「臺北市」「新北市」；台／臺皆可。縣市未填的公司無法被篩到，會在 notes 說明筆數'),
  is_ai: z.boolean().optional().describe('是否為 AI 方案'),
  is_startup: z.boolean().optional().describe('公司是否為新創'),
  is_gov: z.boolean().optional().describe('公司是否有政府能量登錄'),
  pricing_model: z.string().max(20).optional().describe('計價方式，例如「訂閱制」'),
  category: z.array(z.string().max(20)).max(9).optional().describe('服務類別（子字串比對），9 個值見 describe_data'),
  program: z.array(z.string().max(40)).max(10).optional().describe('資料來源名稱，完整清單見 data_status'),
  max_price: z.number().min(0).max(100000000).optional().describe('總費用上限（元）。未提供價格的方案會被排除'),
  include_delisted: z.boolean().default(false).describe('是否包含已下架（預設排除）'),
  normal_only: z.boolean().default(false).describe('只列正常方案（排除疑似已下架與已下架）。推薦類問題請帶 true；盤點、計數類請維持預設'),
  sort: z.enum(['relevance', 'price_asc', 'price_desc']).default('relevance'),
}

const topics = ['index', 'data', 'status', 'region', 'ranking', 'mapping', 'industry', 'tips', 'tax', 'awards', 'lists', 'other', 'all'] as const
const guideSections = DATA_GUIDE.split(/\n(?=## )/).slice(1)
const describeTopic = (topic: typeof topics[number]) => {
  if (topic === 'all') return DATA_GUIDE
  if (topic !== 'index') return guideSections[topics.indexOf(topic) - 1]
  const index = guideSections.map((section) => {
    const [heading, ...body] = section.split('\n')
    const first = body.find((line) => line.trim())?.replace(/^[-\d. ]+/, '') ?? ''
    return `${heading.replace(/^## /, '')}：${first.split('。')[0]}。`
  }).join('\n')
  return `${index}\n\n${guideSections.slice(0, 2).join('\n')}`
}

type SearchArgs = z.output<ReturnType<typeof searchInput>>
const searchInput = () => z.object({
  ...searchFields,
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(5000).default(0),
})
const nextSteps = (a: SearchArgs, unknown: number): string[] => {
  const steps: string[] = []
  if ((a.keyword?.length ?? 0) >= 4) steps.push(`改用較短的關鍵字（例如「${a.keyword!.slice(0, 2)}」）`)
  if (a.city?.length) {
    steps.push('拿掉縣市篩選，或改用 region')
    if (unknown > 0) steps.push(`另有 ${unknown} 筆縣市未填，未納入`)
  }
  const filters = ['category', 'program', 'max_price', 'is_ai', 'is_startup', 'is_gov']
    .filter((key) => {
      const value = a[key as keyof SearchArgs]
      return Array.isArray(value) ? value.length > 0 : value != null
    })
  if (filters.length) steps.push(`放寬篩選條件（目前帶了：${filters.join('、')}）`)
  if (a.normal_only) steps.push('改為包含疑似下架方案再查')
  return steps.length ? steps : ['改用其他關鍵字或放寬搜尋條件再查']
}
const searchMeta = (a: SearchArgs, total: number, suspected: number, unknown: number, failures: string[], companies?: number) => {
  const status_scope = a.normal_only ? '只含正常' : a.include_delisted ? '含已下架' : '正常＋疑似下架'
  const context = [...(a.city ?? []), ...(a.keyword ? [`關鍵字「${a.keyword}」`] : [])].join('，')
  const normal = total - suspected
  const distribution = a.include_delisted && !a.normal_only
    ? `非疑似下架 ${normal}（含已下架）、疑似下架 ${suspected}`
    : `正常 ${normal}、疑似下架 ${suspected}`
  const summary_line = `${context ? context + '：' : ''}${companies == null ? '' : `${companies} 家廠商、`}${total} 筆方案（${distribution}）${unknown ? `；另有 ${unknown} 筆縣市未填未納入` : ''}。`
  const scopeNotes: string[] = []
  if (a.city?.length) scopeNotes.push('縣市指公司總部所在地。')
  if (a.normal_only && a.include_delisted) scopeNotes.push('normal_only 優先於 include_delisted，只列正常方案。')
  // 合併範圍提醒，為疑似下架與部分失敗各保留一條，必讀資訊不被截斷。
  const notes = scopeNotes.length ? [scopeNotes.join('')] : []
  if (failures.length) notes.push(failures.join(''))
  if (suspected > 0) notes.push('疑似下架方案請在回答中逐筆標「⚠疑似下架」，最後一句總說明即可；使用者問到才說明原因（原因可用 data_status 查）。')
  const notes_more: string[] = []
  if (a.region?.length) notes_more.push('地區指公司總部所在地，未填公司地區的方案不會納入；缺口可用 data_status 查詢。')
  if (a.max_price != null) notes_more.push('max_price 會排除未提供價格（0 或空白）的方案。')
  if (a.industry_keyword) notes_more.push('industry_keyword 是產業加權，不是篩選。')
  if (a.include_delisted && !a.normal_only) notes_more.push('結果含已下架；RPC 未另提供已下架總數，totals.normal 為非疑似筆數（含已下架），請勿解讀為全數正常。')
  return { summary_line, status_scope, notes, notes_more }
}

const count = z.number().int().nonnegative()
const rowSchema = z.record(z.string(), z.unknown())
const searchOutput = {
  summary_line: z.string(),
  status_scope: z.enum(['只含正常', '正常＋疑似下架', '含已下架']),
  returned: count, offset: count, next_offset: count.nullable(),
  next_step: z.array(z.string()).nullable(),
  page_summary: rowSchema, notes: z.array(z.string()).max(3), notes_more: z.array(z.string()),
}
const toolOutputs = {
  describe_data: z.object({ topic: z.enum(topics), text: z.string() }),
  search_solutions: z.object({ ...searchOutput, total_matches: count,
    totals: z.object({ matches: count, normal: count, suspected_delisted: count, city_unknown: count }), results: z.array(rowSchema) }),
  search_companies: z.object({ ...searchOutput, companies_total: count, solutions_total: count,
    totals: z.object({ companies: count, solutions: count, normal: count, suspected_delisted: count, city_unknown: count }), companies: z.array(rowSchema) }),
  get_solution: z.object({ found: z.boolean(), message: z.string().optional(), solution: rowSchema.optional(),
    company: rowSchema.nullable().optional(), contacts: z.array(rowSchema).optional(), gov_registered: z.boolean().nullable().optional(),
    tax_industries: z.array(rowSchema).optional(), company_awards: z.array(rowSchema).optional(), notes: z.array(z.string()).optional() }),
  get_solutions: z.object({ requested: count, found: count, not_found: z.array(z.string()), results: z.array(rowSchema), notes: z.array(z.string()) }),
  data_status: z.object({ totals: rowSchema, coverage_gaps_among_active: rowSchema, non_normal_reasons: z.array(rowSchema),
    server_version: z.string(), by_source: z.array(rowSchema), notes: z.array(z.string()) }),
  whoami: z.object({ id: z.string().optional(), email: z.string().optional(), server_version: z.string() }),
  count_solutions: z.object({ total: count.nullable(), active: count.nullable() }),
}
const toolTitles = {
  describe_data: '資料說明', search_solutions: '搜尋方案', search_companies: '依廠商搜尋',
  get_solution: '方案詳情', get_solutions: '批次方案詳情', data_status: '資料現況', whoami: '我是誰', count_solutions: '方案筆數',
}
const toolError = (error: string, next_step = ['稍候再試', '確認查詢條件，或聯絡資料維護者']) => ({
  isError: true as const,
  content: [{ type: 'text' as const, text: JSON.stringify({ error, next_step }) }],
})

// 保留使用者身分的 Supabase client；可注入開關與時間，只供離線測試限流分支。
// deno-lint-ignore no-explicit-any
export const createSfServer = (supabase: any, { rateLimitEnforce = RATE_LIMIT_ENFORCE, now = () => new Date() } = {}) => {
      const runTool = <A,>(name: keyof typeof toolTitles, handler: (args: A) => Promise<ReturnType<typeof asText>>) => async (args: A) => {
        try {
          const touch = await supabase.rpc('sf_mcp_touch')
          if (touch.error) console.error(`[sf-mcp] ${name} sf_mcp_touch 失敗：`, touch.error.message)
          else if (touch.data?.[0]?.over_limit) {
            const limit = Number(touch.data[0].limit_per_minute)
            if (rateLimitEnforce) return toolError(`每分鐘最多 ${limit} 次查詢，請約 ${60 - now().getSeconds()} 秒後再試`, ['稍候再試', '合併查詢條件以減少呼叫次數'])
            console.warn('sf_mcp_touch 超過本分鐘用量；目前僅記錄，不阻擋。')
          }
        } catch (err) {
          console.error(`[sf-mcp] ${name} sf_mcp_touch 失敗：`, err instanceof Error ? err.message : String(err))
        }
        try {
          return await handler(args)
        } catch (err) {
          console.error(`[sf-mcp] ${name} 失敗：`, err instanceof Error ? err.message : String(err))
          return toolError(`「${toolTitles[name]}」暫時無法完成，請稍後再試。`)
        }
      }
      // Edge Function 無狀態：每個請求建立新的 server
      // 共用：搜尋參數對應資料庫函式、當頁補充資訊（平行查詢）。
      const rpcArgs = (a: SearchArgs) => ({
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
      })
      const none = { data: [] as Row[], error: null as { message: string } | null }
      const enrichRows = async (rows: Row[], needIndustry: boolean, notes: string[]) => {
        const ids = rows.map((r) => String(r.solution_id))
        const cids = [...new Set(rows.map((r) => String(r.company_id ?? '')).filter(Boolean))]
        const [co, aw, ind] = await Promise.all([
          cids.length ? supabase.from('companies').select('company_id, it_code_rank, tax_primary_name').in('company_id', cids) : Promise.resolve(none),
          cids.length ? supabase.from('awards').select('company_id, award_category').in('company_id', cids) : Promise.resolve(none),
          needIndustry && ids.length ? supabase.from('solutions').select('solution_id, target_industry').in('solution_id', ids) : Promise.resolve(none),
        ])
        const taxMap = new Map<string, { rank: number | null; name: string | null }>()
        if (co.error) notes.push('無法取得稅籍登記資訊，相關欄位未知。')
        else {
          for (const x of (co.data ?? []) as Row[]) {
            const k = String(x.company_id)
            taxMap.set(k, { rank: x.it_code_rank == null ? null : Number(x.it_code_rank), name: (x.tax_primary_name as string) ?? null })
          }
        }
        const awardMap = new Map<string, { count: number; best: string | null }>()
        if (aw.error) notes.push('無法取得獲獎資訊，相關欄位未知。')
        else {
          const byCo = new Map<string, string[]>()
          for (const x of (aw.data ?? []) as Row[]) {
            const k = String(x.company_id)
            byCo.set(k, [...(byCo.get(k) ?? []), String(x.award_category ?? '')])
          }
          for (const [k, cats] of byCo) awardMap.set(k, { count: cats.length, best: bestAwardTier(cats) })
        }
        const indMap = new Map<string, unknown>()
        if (ind.error) notes.push('無法取得產業別資訊，相關欄位未知。')
        else for (const x of (ind.data ?? []) as Row[]) indMap.set(String(x.solution_id), x.target_industry)
        return { taxMap, awardMap, indMap, awardsKnown: !aw.error, industriesKnown: !ind.error }
      }

        const server = new McpServer({ name: 'sf-mcp', version: SERVER_VERSION })
        const registerTool = <S extends z.ZodType>(name: keyof typeof toolOutputs,
          config: { description: string; inputSchema: S; annotations: { readOnlyHint: boolean } },
          handler: (args: z.output<S>) => Promise<ReturnType<typeof asText>>) => {
          const run = runTool(name, handler)
          server.registerTool(name, { ...config, inputSchema: config.inputSchema as z.ZodType, title: toolTitles[name], outputSchema: toolOutputs[name] }, async (args) => run(args as z.output<S>))
        }

        registerTool(
          'describe_data',
          {
            description:
              '資料定義與使用原則：資料來源、狀態詞、「北部」等地區的多種定義、關鍵字/類別/產業的口語對照表、排序規則。第一次搜尋前、或需要回答筆數與比例時，請先讀這份說明。',
            inputSchema: z.object({ topic: z.enum(topics).default('index') }),
            annotations: { readOnlyHint: true },
          },
          async ({ topic }) => asText({ topic, text: describeTopic(topic) })
        )

        registerTool(
          'search_solutions',
          {
            description: '搜尋方案；先由資料庫篩選與計數，再依 limit／offset 分頁。keyword 放一個最關鍵的詞；縣市直接帶 city，勿逐筆開詳情查縣市。推薦請帶 normal_only=true；盤點維持預設。總數引用 summary_line，詳情批次使用 get_solutions。',
            inputSchema: searchInput(),
            annotations: { readOnlyHint: true },
          },
          async (a) => {
            const res = await supabase.rpc('sf_search_solutions', {
              ...rpcArgs(a), p_cities: a.city, p_normal_only: a.normal_only, p_limit: a.limit, p_offset: a.offset,
            })
            if (res.error) throw new Error(res.error.message)
            const rows = (res.data ?? []) as Row[]
            // 此 RPC 空頁不帶總數列；不以額外查詢推算資料庫沒有回傳的計數。
            const total = Number(rows[0]?.total_matches ?? 0)
            const suspected = Number(rows[0]?.suspected_total ?? 0)
            const unknown = Number(rows[0]?.city_unknown_count ?? 0)
            const failures: string[] = []
            if (!rows.length && a.offset > 0) failures.push('此頁無資料且 RPC 未回傳總數；請以 offset=0 重查，勿將此頁總數解讀為全庫無結果。')
            if (!rows.length && a.city?.length) failures.push('方案 RPC 空頁未回傳縣市未填筆數；city_unknown=0 不代表已確認沒有缺口，可改用 search_companies 取得該計數。')
            const enr = await enrichRows(rows, true, failures)
            const pageSummary = {
              normal: rows.filter((r) => !String(r.record_status ?? '').startsWith('疑似')).length,
              suspected_delisted: rows.filter((r) => String(r.record_status ?? '').startsWith('疑似')).length,
              company_region_missing: rows.filter((r) => !r.region).length,
              company_city_missing: rows.filter((r) => !r.company_city).length,
              in_tax_registry: rows.filter((r) => enr.taxMap.get(String(r.company_id ?? ''))?.rank != null).length,
              with_company_award: enr.awardsKnown ? rows.filter((r) => enr.awardMap.has(String(r.company_id ?? ''))).length : null,
              matches_industry_keyword: a.industry_keyword && enr.industriesKnown
                ? rows.filter((r) => flattenIndustries(enr.indMap.get(String(r.solution_id))).join('｜').includes(a.industry_keyword!)).length
                : null,
            }
            return asText({
              ...searchMeta(a, total, suspected, unknown, failures),
              total_matches: total,
              totals: { matches: total, normal: total - suspected, suspected_delisted: suspected, city_unknown: unknown },
              returned: rows.length, offset: a.offset,
              next_offset: total > a.offset + rows.length ? a.offset + rows.length : null,
              next_step: rows.length ? null : [...(a.offset > 0 ? ['改用 offset=0 重新查詢'] : []), ...nextSteps(a, unknown)],
              page_summary: pageSummary,
              results: rows.map((r) => {
                const cid = String(r.company_id ?? '')
                const inds = flattenIndustries(enr.indMap.get(String(r.solution_id)))
                const tax = enr.taxMap.get(cid)
                return {
                  id: r.solution_id,
                  name: r.solution_name,
                  company: r.company_name,
                  company_id: r.company_id,
                  source: r.program_type,
                  category: r.industry_category,
                  company_city: r.company_city || null,
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
                  industries_count: enr.indMap.has(String(r.solution_id)) ? inds.length : null,
                  industries_sample: inds.slice(0, 3),
                  matches_industry_keyword: a.industry_keyword && enr.industriesKnown ? inds.join('｜').includes(a.industry_keyword) : null,
                  tax_primary_industry: tax?.name ?? null,
                  it_code_rank: tax?.rank ?? null,
                  has_company_award: enr.awardsKnown ? enr.awardMap.has(cid) : null,
                  company_award_count: enr.awardsKnown ? enr.awardMap.get(cid)?.count ?? 0 : null,
                  company_award_best_level: enr.awardMap.get(cid)?.best ?? null,
                }
              }),
            })
          }
        )

        registerTool(
          'search_companies',
          {
            description: '以廠商為單位搜尋，資料庫先完成縣市篩選、全體計數與公司分組，再分頁；每家公司最多列 5 筆符合方案。limit／offset 以廠商數計算。無公司編號的方案各自獨立成組。總數引用 summary_line，推薦請帶 normal_only=true。',
            inputSchema: searchInput(),
            annotations: { readOnlyHint: true },
          },
          async (a) => {
            const res = await supabase.rpc('sf_search_companies', {
              ...rpcArgs(a), p_cities: a.city, p_normal_only: a.normal_only, p_limit: a.limit, p_offset: a.offset,
            })
            if (res.error) throw new Error(res.error.message)
            const raw = (res.data ?? []) as Row[]
            const companiesTotal = Number(raw[0]?.companies_total ?? 0)
            const total = Number(raw[0]?.solutions_total ?? 0)
            const suspected = Number(raw[0]?.suspected_total ?? 0)
            const unknown = Number(raw[0]?.city_unknown_count ?? 0)
            const rows = raw.filter((r) => r.company_key != null)
            const failures: string[] = []
            const enr = await enrichRows(rows, false, failures)
            const companies = rows.map((r) => {
              const cid = String(r.company_id ?? '')
              const tax = enr.taxMap.get(cid)
              const aw = enr.awardMap.get(cid)
              const suspectedCount = Number(r.suspected_count ?? 0)
              const solutionCount = Number(r.solutions_count ?? 0)
              return {
                company_id: cid || null,
                company: r.company_name || (cid ? null : '（資料庫沒有廠商名稱）'),
                company_city: r.company_city || null,
                company_region: r.company_region || null,
                tax_primary_industry: tax?.name ?? null,
                it_code_rank: tax?.rank ?? null,
                has_company_award: enr.awardsKnown ? !!aw : null,
                company_award_best_level: aw?.best ?? null,
                solutions_count: solutionCount,
                normal_count: solutionCount - suspectedCount,
                suspected_delisted_count: suspectedCount,
                solutions: ((r.solutions ?? []) as Row[]).map((s) => ({
                  id: s.id, name: s.name, source: s.source, price: s.price || null,
                  pricing_model: s.pricing_model, status: s.status || '正常', score: s.score,
                })),
              }
            })
            return asText({
              ...searchMeta(a, total, suspected, unknown, failures, companiesTotal),
              companies_total: companiesTotal, solutions_total: total,
              totals: { companies: companiesTotal, solutions: total, normal: total - suspected, suspected_delisted: suspected, city_unknown: unknown },
              returned: companies.length, offset: a.offset,
              next_offset: companiesTotal > a.offset + companies.length ? a.offset + companies.length : null,
              next_step: companies.length ? null : [...(a.offset > 0 ? ['改用 offset=0 重新查詢'] : []), ...nextSteps(a, unknown)],
              page_summary: {
                companies: companies.length,
                solutions: companies.reduce((n, c) => n + c.solutions_count, 0),
                normal: companies.reduce((n, c) => n + c.normal_count, 0),
                suspected_delisted: companies.reduce((n, c) => n + c.suspected_delisted_count, 0),
              },
              companies,
            })
          }
        )

        registerTool(
          'get_solution',
          {
            description:
              '取得單一方案的詳細資料：方案欄位、公司資料、聯絡人（僅姓名、職稱、公司電話）、是否有政府能量登錄。solution_id 來自 search_solutions 的 id。不回傳完整描述、email、手機。若要查多筆請改用 get_solutions（批次），不要逐筆呼叫本工具。',
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
              // 五個查詢互不相依，平行執行
              const [aw, ti, co, ct, gv] = await Promise.all([
                supabase.from('awards').select('award_year, award_category, award_level, award_name, host_org').eq('company_id', cid).order('award_year', { ascending: false }).limit(10),
                supabase.from('company_tax_industry').select('code_rank, code6, code_name, snapshot_date').eq('company_id', cid).order('code_rank'),
                supabase.from('companies').select('company_id, company_name, region, city, is_startup, tech_tags, it_code_rank, tax_primary_code, tax_primary_name').eq('company_id', cid).maybeSingle(),
                supabase.from('contacts').select('contact_name, title, office_phone').eq('company_id', cid).limit(5),
                supabase.from('gov_registrations').select('company_id', { count: 'exact', head: true }).eq('company_id', cid),
              ])
              if (aw.error) throw new Error(aw.error.message)
              if (ti.error) throw new Error(ti.error.message)
              if (co.error) throw new Error(co.error.message)
              if (ct.error) throw new Error(ct.error.message)
              if (gv.error) throw new Error(gv.error.message)
              companyAwards = aw.data ?? []
              taxIndustries = ti.data ?? []
              company = co.data
              contacts = ct.data ?? []
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

        registerTool(
          'get_solutions',
          {
            description:
              '批次取得多筆方案的精簡詳情（一次最多 20 筆）。內部只做 4 次資料庫查詢，比逐筆呼叫 get_solution 快得多。回傳方案欄位（描述已縮短）、公司縣市與稅籍主業、公司獲獎（層級與筆數）與是否有政府能量登錄；不含聯絡人（需要聯絡人請對少數候選用 get_solution）。solution_ids 來自 search_solutions／search_companies 的 id。',
            inputSchema: z.object({ solution_ids: z.array(z.string().min(1).max(60)).min(1).max(20) }),
            annotations: { readOnlyHint: true },
          },
          async ({ solution_ids }) => {
            const ids = [...new Set(solution_ids)]
            const sol = await supabase
              .from('solutions')
              .select('solution_id, solution_name, company_id, program_type, industry_category, has_ai, price, monthly_price, pricing_model, service_region, target_scale, website_url, slogan, description_short, features_list, record_status')
              .in('solution_id', ids)
            if (sol.error) throw new Error(sol.error.message)
            const found = (sol.data ?? []) as Row[]
            const cids = [...new Set(found.map((r) => String(r.company_id ?? '')).filter(Boolean))]
            const [co, aw, gv] = await Promise.all([
              cids.length ? supabase.from('companies').select('company_id, company_name, city, region, is_startup, it_code_rank, tax_primary_name').in('company_id', cids) : Promise.resolve(none),
              cids.length ? supabase.from('awards').select('company_id, award_category, award_level, award_name, award_year').in('company_id', cids) : Promise.resolve(none),
              cids.length ? supabase.from('gov_registrations').select('company_id').in('company_id', cids) : Promise.resolve(none),
            ])
            if (co.error) throw new Error(co.error.message)
            if (aw.error) throw new Error(aw.error.message)
            if (gv.error) throw new Error(gv.error.message)
            const coMap = new Map<string, Row>(((co.data ?? []) as Row[]).map((x) => [String(x.company_id), x]))
            const awMap = new Map<string, Row[]>()
            for (const x of (aw.data ?? []) as Row[]) {
              const k = String(x.company_id)
              awMap.set(k, [...(awMap.get(k) ?? []), x])
            }
            const govSet = new Set(((gv.data ?? []) as Row[]).map((x) => String(x.company_id)))
            const byId = new Map<string, Row>(found.map((r) => [String(r.solution_id), r]))
            const results = ids.filter((id) => byId.has(id)).map((id) => {
              const r = byId.get(id)!
              const cid = String(r.company_id ?? '')
              const c1 = coMap.get(cid)
              const awards = awMap.get(cid) ?? []
              return {
                id: r.solution_id,
                name: r.solution_name,
                source: r.program_type,
                category: r.industry_category,
                status: r.record_status || '正常',
                is_ai: r.has_ai,
                price: r.price || null,
                monthly_price: r.monthly_price || null,
                pricing_model: r.pricing_model,
                service_region: r.service_region,
                target_scale: r.target_scale,
                website_url: r.website_url || null,
                slogan: clip(r.slogan as string, 120),
                summary: clip(r.description_short as string, 300),
                features: clip(r.features_list as string, 400),
                company: c1 ? { id: cid, name: c1.company_name, city: c1.city || null, region: c1.region || null, is_startup: c1.is_startup, tax_primary_industry: c1.tax_primary_name ?? null, it_code_rank: c1.it_code_rank ?? null } : { id: cid || null, name: null },
                company_awards: { count: awards.length, best_level: bestAwardTier(awards.map((x) => String(x.award_category ?? ''))), latest: awards.slice(0, 3).map((x) => `${x.award_year ?? '?'} ${x.award_category ?? ''} ${x.award_name ?? ''}`.trim()) },
                gov_registered: govSet.has(cid),
              }
            })
            return asText({
              requested: ids.length,
              found: results.length,
              not_found: ids.filter((id) => !byId.has(id)),
              results,
              notes: ['收錄不等於推薦或認證；方案文字多為廠商自述。獲獎是公司層級，不代表方案本身得獎。', '本工具不含聯絡人；需要聯絡窗口請對少數候選使用 get_solution。'],
            })
          }
        )

        registerTool(
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

        registerTool(
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

        registerTool(
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
}

Deno.serve(
  pipeline(
    // OAuth 與 RLS 使用者身分維持原流程；每個請求建立獨立的 server。
    [withOAuthProtectedResource(), withSupabase({ auth: 'user' })],
    async (req, { supabase }) => {
      const handler = createMcpHandler(() => createSfServer(supabase))
      return handler.fetch(req)
    }
  )
)

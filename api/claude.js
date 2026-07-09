// api/claude.js — Vercel Serverless Function
// 接收前端的搜尋語句，用 Claude 解析成篩選條件，回傳 JSON
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function fetchAirtableWithRetry(url, options, table, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetch(url, options);
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

  async function writeLog(token, { query }) {
    try {
      if (!token) return;
      const logRes = await fetchAirtableWithRetry(
        'https://api.airtable.com/v0/appttP04OnzzC7qxG/tblLdVCmLwkzDFtMq',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              timestamp: new Date().toISOString().slice(0, 19) + '.000Z',
              search_query: query,
              log_type: 'ai_search',
            },
          }),
        },
        'Search_Logs'
      );
      if (!logRes.ok) {
        const errText = await logRes.text();
        const time = new Date().toISOString();
        console.error(`[Airtable Error] status=${logRes.status} endpoint=${req.url} table=Search_Logs time=${time} message=${errText}`);
        if (logRes.status === 429) {
          console.error(`[Airtable Rate Limit] status=429 endpoint=${req.url} table=Search_Logs time=${time}`);
        }
      }
    } catch (err) {
      console.error('Log write error:', err);
    }
  }

  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    const systemPrompt = `你是一個資服方案資料庫的查詢助手。
使用者會用自然語言描述想找的方案，你要把它轉成 JSON 篩選條件。

可用的篩選欄位：
- region: 區域，可選值："北部"/"中部"/"南部"/"東部"/"其他"
- ai: 是否為AI方案，true/false
- startup: 是否為新創，true/false
- industry_vertical: 五大領域，可選值："旅宿觀光"/"製造業"/"醫療照護"/"建築營造"/"文化創意"
- program: 資料來源，可選值："雲市集"/"新創嚴選"/"五大領域調查"/"商業署"/"中企署"/"產發署"
- maxPrice: 總費用上限（數字）
- maxMonthlyPrice: 月費上限（數字）
- scale: 適用企業規模，可選值："微型企業"/"中小企業"/"中大型企業"/"大型企業"
- category: 方案服務類別，可選值（9個）："銷售管理"/"行銷推廣"/"生產物流"/"協作辦公"/"人力資源"/"資安合規"/"研發創新"/"醫療照護"/"暫無法分類"
- industryKeyword: 產業關鍵字（用於前端軟性排序，比對 target_industry 欄位）
- keyword: 公司名稱、方案名稱、功能關鍵字、或無法歸類的詞

規則：
1. 只回傳 JSON，不要有任何其他文字
2. 只包含使用者提到的條件，沒提到的欄位不要加
3. 金額要轉成數字，例如"5萬"=50000，"3千"=3000
4. 如果使用者輸入包含產業關鍵字（如"旅宿"/"製造"/"醫療"/"建築"/"文創"），對應到 industry_vertical
5. 需求關鍵字對照表（需求 → keyword）：
   - 接觸新客戶、開發客戶、業績成長 → keyword: "行銷"
   - 改善客戶體驗、顧客服務、客戶滿意 → keyword: "客服"
   - 數位轉型入門、開始數位化、數位化第一步 → keyword: "數位"
   - 提升辦公室效率、辦公自動化、文件管理 → keyword: "辦公"
   - 吸引人才、招募人才、人才管理 → keyword: "人資"
   - 資訊安全、網路安全、資安防護 → keyword: "資安"
   - 供應鏈管理、進銷存、倉儲物流 → keyword: "供應鏈"
   - 碳排放、淨零、ESG → keyword: "碳"
6. 服務類別關鍵字對照（輸入包含以下詞 → 設定 category）：
   - 醫療照護、長照、診所、醫院、健康 → category: "醫療照護"
   - 資安、資訊安全、網路安全、合規 → category: "資安合規"
   - ERP、進銷存、供應鏈、倉儲、物流、生產 → category: "生產物流"
   - CRM、銷售、POS、訂單、報價 → category: "銷售管理"
   - SEO、廣告、行銷、社群、官網 → category: "行銷推廣"
   - HR、人資、招募、排班、薪資 → category: "人力資源"
   - 協作、辦公、專案管理、會議、文件 → category: "協作辦公"
   - AI開發、資料分析、IoT、研發 → category: "研發創新"
   - category 和 keyword 可同時存在
7. 產業關鍵字對照（輸入包含產業名 → 設定 industryKeyword）：
   - 餐飲 → industryKeyword: "住宿及餐飲業"
   - 製造 → industryKeyword: "製造業"
   - 零售 → industryKeyword: "批發零售業"
   - 醫療 → industryKeyword: "醫療"
   - 物流 → industryKeyword: "運輸及倉儲"
   - 建築、營造 → industryKeyword: "營建工程"
   - 金融、銀行、保險 → industryKeyword: "金融保險"
   - 教育 → industryKeyword: "教育業"
   - 旅遊、旅宿、住宿 → industryKeyword: "旅宿業"
   - 電商 → industryKeyword: "批發零售業"
注意：金融業、教育業、電商業、物流業、餐飲業等不在 industry_vertical 可選值內的產業，
不要設定 industry_vertical 欄位；請用 industryKeyword 表示產業，並專注解析需求對應的 keyword。
例如：「金融業想要改善客戶體驗」→ {"keyword": "客服", "industryKeyword": "金融保險"}
例如：「金融業想要淨零碳排」→ {"keyword": "碳", "industryKeyword": "金融保險"}
例如：「教育業想要吸引人才」→ {"keyword": "人資", "industryKeyword": "教育業"}
8. 最重要規則：禁止回傳空物件 {}。若無法精確解析，請從使用者輸入中取最關鍵的一個詞作為 keyword 回傳。例如查詢「旅遊住宿業想要改善客戶體驗」至少回傳 {"keyword": "客服", "industryKeyword": "旅宿業"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: query }],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API error:', response.status, errorData);
      return res.status(response.status).json({
        error: `Claude API 錯誤 ${response.status}`,
        detail: errorData,
      });
    }

    const data = await response.json();
    const text = data.content[0].text;
    const clean = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    const airtableToken = process.env.AIRTABLE_TOKEN;
    await writeLog(airtableToken, {
      query,
    });
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
}

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

  async function writeLog(token, { query }) {
    try {
      if (!token) return;
      const logRes = await fetch(
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
        }
      );
      if (!logRes.ok) {
        const errText = await logRes.text();
        console.error('Log write failed:', logRes.status, errText);
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
6. 最重要規則：禁止回傳空物件 {}。若無法精確解析，請從使用者輸入中取最關鍵的一個詞作為 keyword 回傳。例如查詢「旅遊住宿業想要改善客戶體驗」至少回傳 {"keyword": "客服"}`;

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

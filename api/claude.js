// api/claude.js — Vercel Serverless Function
// 接收前端的搜尋語句，用 Claude 解析成篩選條件，回傳 JSON

export default async function handler(req, res) {
  // 設定 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });
  }

  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const systemPrompt = `你是一個資服方案資料庫的查詢助手。
使用者會用自然語言描述想找的方案，你要把它轉成 JSON 篩選條件。

可用的篩選欄位：
- region: 區域，可選值："北部"/"中部"/"南部"/"東部"/"其他"
- ai: 是否為AI方案，true/false
- startup: 是否為新創，true/false
- category: 領域大分類，可選值："企業管理"/"商務交易"/"行銷客服"/"技術基礎"/"ESG永續"
- domainKey: 服務領域關鍵字，例如 "ERP"/"POS"/"客服"/"資安"/"碳排"/"SEO" 等
- program: 參與計畫，可選值："雲市集"/"新創嚴選"
- maxPrice: 總費用上限（數字）
- keyword: 如果使用者的輸入包含特定的公司名稱、方案名稱或無法歸類的關鍵字，請將其提取到此欄位

規則：
1. 只回傳 JSON，不要有任何其他文字
2. 只包含使用者提到的條件，沒提到的不要加
3. 金額要轉成數字，例如"5萬"=50000，"3千"=3000
4. 如果使用者的輸入無法解析成任何條件，回傳空物件 {}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
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

    // 直接回傳解析好的 JSON 篩選條件
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
}

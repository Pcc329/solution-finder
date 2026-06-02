// api/ask.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  async function writeLog(token, { question, resultCount, searchQuery, answerLength }) {
    try {
      if (!token) return;
      const timestamp = new Date().toISOString().slice(0, 19) + '.000Z';
      const logRes = await fetch('https://api.airtable.com/v0/appttP04OnzzC7qxG/tblvnoz1WHtXBzAqA', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            timestamp,
            question,
            result_count: resultCount,
            search_query: searchQuery || '',
            answer_length: answerLength,
          },
        }),
      });
      if (!logRes.ok) {
        const errText = await logRes.text();
        console.error('Log write failed:', logRes.status, errText);
      }
    } catch (err) {
      console.error('Log write error:', err);
    }
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const question = String(body.question || '').trim();
    const searchQuery = String(body.searchQuery || '').trim();
    const solutions = Array.isArray(body.solutions) ? body.solutions : [];

    if (!question) {
      return res.status(400).json({ error: '請輸入問題' });
    }

    if (!solutions.length) {
      return res.status(400).json({ error: '請先搜尋方案再提問' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const compressedSolutions = solutions.slice(0, 50).map(item => ({
      name: item.s || '',
      company: item.c || '',
      price: item.pr ?? null,
      tier: item.pt || '',
      category: item.cat || '',
      hasAi: item.ai === true,
      region: item.r || '',
      features: String(item.feat || '')
        .split(/\n|；|;/)
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 3),
    }));

    const systemPrompt = `你是產業策略智庫的 AI 分析助手。
根據以下方案資料回答使用者問題。
回答請使用繁體中文，條列清楚，簡潔有力。
如果問題超出資料範圍，請說明資料中找不到相關資訊。

【產業關注點對照】
當使用者查詢帶有特定產業時，回答開頭先點出該產業在此需求下的特有重點：

資訊安全：
- 金融業：法遵合規（個資法、金管會規範）、交易安全、客戶個資保護
- 製造業：OT/IT 整合、工控網路防護、營業秘密
- 餐飲/零售：POS 金流加密、會員個資、第三方平台串接安全
- 醫療業：病歷資料保護、存取權限控管
- 電商業：交易資料、金流安全、大量會員資料防護

吸引人才 / 人資：
- 製造業：藍領排班、技術人員留任、現場出勤管理
- 餐飲/零售：高流動率、排班彈性、兼職管理
- 金融/專業服務：專業人才招募、合規教育訓練

接觸新客戶 / 行銷：
- B2B（製造、物流）：精準名單、展會數位化
- B2C（餐飲、零售、電商）：社群、會員經營、回購

回答結構：
1. 先用 1-2 句說明該產業在此需求下的特有關注點。
2. 再從方案資料中推薦可用方案，包含適用理由。
3. 最後提出下一步建議。
不得因找不到產業專屬方案而拒答；仍需從通用方案中挑選並說明適用理由。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `目前搜尋字串：${searchQuery || '未提供'}\n\n方案資料：\n${JSON.stringify(compressedSolutions)}\n\n使用者問題：${question}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const answer = (data.content || [])
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n')
      .trim();

    await writeLog(airtableToken, {
      question,
      resultCount: solutions.length,
      searchQuery,
      answerLength: answer.length,
    });

    return res.status(200).json({ answer });
  } catch (err) {
    console.error('Ask API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

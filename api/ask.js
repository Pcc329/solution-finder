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

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const question = String(body.question || '').trim();
    const solutions = Array.isArray(body.solutions) ? body.solutions : [];

    if (!question) {
      return res.status(400).json({ error: '請輸入問題' });
    }

    if (!solutions.length) {
      return res.status(400).json({ error: '請先搜尋方案再提問' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: '你是產業策略智庫的 AI 分析助手。\n根據以下方案資料回答使用者問題。\n回答請使用繁體中文，條列清楚，簡潔有力。\n如果問題超出資料範圍，請說明資料中找不到相關資訊。',
        messages: [
          {
            role: 'user',
            content: `方案資料：\n${JSON.stringify(compressedSolutions)}\n\n使用者問題：${question}`,
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

    return res.status(200).json({ answer });
  } catch (err) {
    console.error('Ask API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

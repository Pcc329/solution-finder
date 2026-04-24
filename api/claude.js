// api/claude.js — Vercel Serverless Function
// 透過後端呼叫 Claude API，避免前端暴露 API key

export default async function handler(req, res) {
  // 只允許 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });
  }

  try {
    const { query, solutions } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing query' });
    }

    // 組合 prompt：把使用者的搜尋詞 + 方案資料送給 Claude 做語意比對
    const prompt = `你是一個資服方案搜尋助手。使用者正在搜尋：「${query}」

以下是資料庫中的方案列表（JSON 格式）：
${JSON.stringify(solutions, null, 0)}

請根據使用者的搜尋意圖，從上述方案中挑選最相關的方案，回傳一個 JSON 陣列，包含相關方案的索引（從 0 開始）和相關度分數（0-100）。
格式範例：[{"index": 0, "score": 95, "reason": "..."}, {"index": 3, "score": 80, "reason": "..."}]
只回傳 JSON，不要其他文字。最多回傳 20 筆。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: `Claude API 錯誤 ${response.status}`,
        detail: errorData 
      });
    }

    const data = await response.json();
    
    // 回傳 Claude 的回應
    return res.status(200).json({
      success: true,
      content: data.content,
      usage: data.usage,
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
}

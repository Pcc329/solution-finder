// api/manufacturing-recommend.js - manufacturing recommendation summary
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
    const solutions = Array.isArray(body.solutions) ? body.solutions : [];

    if (!solutions.length) {
      return res.status(400).json({ success: false, error: '請提供候選方案' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const compactSolutions = solutions.slice(0, 20).map(item => ({
      id: item.id || '',
      name: item.name || '',
      vendor: item.vendor || '',
      price: item.price ?? '',
      description: String(item.description || '').slice(0, 260),
      features: String(item.features || '').slice(0, 260),
      program_type: item.program_type || '',
    }));

    const systemPrompt = `你是一位製造業數位轉型顧問，負責從候選資服方案中挑選最適合的前三名。
請根據企業條件與候選方案，產生簡潔、具體、能讓顧問直接使用的推薦結果。

輸出規則：
- 只回傳 JSON，不要有任何其他文字
- 不要使用 markdown code block，不要包含 \`\`\`
- reasons 每筆至少 3 點，每點 15 個中文字以內，必須貼合製造業需求
- benefits 每筆至少 2 點，每點 15 個中文字以內
- fit_score 只能是「高」「中」「待確認」
- summary 20 個中文字以內
- overall_advice 50 個中文字以內

JSON 格式：
{
  "summary": "...",
  "top3": [
    {
      "rank": 1,
      "id": "方案ID",
      "name": "方案名稱",
      "vendor": "業者名稱",
      "price": "費用文字",
      "reasons": ["理由1", "理由2", "理由3"],
      "benefits": ["效益1", "效益2"],
      "fit_score": "高"
    }
  ],
  "overall_advice": "..."
}`;

    const userPrompt = `企業資料：
- 產業：${profile.industry || '未提供'}
- 規模：${profile.size || '未提供'}
- 數位成熟度：${profile.digital_maturity || '未提供'}
- 主要痛點：${Array.isArray(profile.pain_points) ? profile.pain_points.join('、') : (profile.pain_points || '未提供')}
- 預算：${profile.budget ?? '未提供'}
- 關鍵字：${profile.keyword || '未提供'}

候選方案清單（共 ${compactSolutions.length} 筆）：
${JSON.stringify(compactSolutions)}

請選出最適合這家製造業企業的前三名方案，並回傳指定 JSON。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Manufacturing recommend API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        error: `Claude 推薦失敗 (${response.status})`,
        detail: errorText,
      });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n')
      .trim();

    const clean = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (err) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw err;
      parsed = JSON.parse(match[0]);
    }

    const top3 = Array.isArray(parsed.top3) ? parsed.top3.slice(0, 3).map((item, index) => ({
      rank: Number(item.rank) || index + 1,
      id: item.id || '',
      name: item.name || '',
      vendor: item.vendor || '',
      price: item.price || '',
      reasons: Array.isArray(item.reasons) ? item.reasons.slice(0, 3) : [],
      benefits: Array.isArray(item.benefits) ? item.benefits.slice(0, 2) : [],
      fit_score: ['高', '中', '待確認'].includes(item.fit_score) ? item.fit_score : '待確認',
    })) : [];

    return res.status(200).json({
      success: true,
      summary: parsed.summary || '',
      top3,
      overall_advice: parsed.overall_advice || '',
    });
  } catch (err) {
    console.error('Manufacturing recommend server error:', err);
    return res.status(500).json({ success: false, error: err.message || '推薦產生失敗' });
  }
}

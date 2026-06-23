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

    const compactSolutions = solutions.slice(0, 5).map(item => ({
      id: item.id || '',
      name: item.name || '',
      vendor: item.vendor || '',
      price: item.price ?? '',
      description: String(item.description || '').slice(0, 260),
      features: String(item.features || '').slice(0, 260),
      category: item.category || '',
      program_type: item.program_type || '',
    }));

    const systemPrompt = `你是一位製造業數位轉型顧問。前端已依企業條件完成官方工具庫方案排序，請不要重新排序或替換方案。
請針對輸入的官方工具庫候選方案做整體綜合評比，不要逐一剖析個別方案。

輸出規則：
- 只回傳 JSON，不要有任何其他文字
- 不要使用 markdown code block，不要包含 \`\`\`
- summary 需使用繁體中文，約 150 到 250 個中文字
- summary 需涵蓋：共通點、整體特色與優勢、共同限制或注意事項、企業條件輪廓對應的大方向建議
- 不要輸出 top3、rank、reasons、benefits、fit_score
- 不要列點逐一介紹方案

JSON 格式：
{
  "summary": "..."
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

請根據企業資料與候選方案清單，輸出整體綜合評比 JSON。`;

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

    return res.status(200).json({
      success: true,
      summary: parsed.summary || '',
    });
  } catch (err) {
    console.error('Manufacturing recommend server error:', err);
    return res.status(500).json({ success: false, error: err.message || '推薦產生失敗' });
  }
}

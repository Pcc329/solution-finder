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
- 全部使用繁體中文，不輸出 markdown，不輸出多餘欄位
- overview：1 到 2 句，說明這批方案的整體定位
- strengths：3 到 5 項，每項一句，條列這批方案的共同優勢
- considerations：1 到 3 項，每項一句，說明導入前需注意事項
- recommendation：1 句，給企業具體可執行的建議行動
- 不要輸出 top3、rank、reasons、benefits、fit_score
- 不要列點逐一介紹方案

JSON 格式：
{
  "overview": "1–2句整體評語",
  "strengths": ["優點1", "優點2", "優點3"],
  "considerations": ["注意事項1", "注意事項2"],
  "recommendation": "1句建議行動"
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
      overview: typeof parsed.overview === 'string' ? parsed.overview : '',
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.filter(item => typeof item === 'string' && item.trim())
        : [],
      considerations: Array.isArray(parsed.considerations)
        ? parsed.considerations.filter(item => typeof item === 'string' && item.trim())
        : [],
      recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
    });
  } catch (err) {
    console.error('Manufacturing recommend server error:', err);
    return res.status(500).json({ success: false, error: err.message || '推薦產生失敗' });
  }
}

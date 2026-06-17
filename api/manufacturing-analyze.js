// api/manufacturing-analyze.js - manufacturing document analysis
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
    const fileBase64 = String(body.fileBase64 || '').trim();
    const mediaType = String(body.mediaType || '').trim();
    const fileName = String(body.fileName || '').trim();

    if (!fileBase64 || !mediaType || !fileName) {
      return res.status(400).json({ success: false, error: '缺少 fileBase64、mediaType 或 fileName' });
    }

    const allowedMediaTypes = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);

    if (!allowedMediaTypes.has(mediaType)) {
      return res.status(400).json({ success: false, error: '僅支援 PDF 或 DOCX 文件' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const prompt = `請閱讀這份製造業 AI 需求文件，萃取可用於推薦資服方案的條件。

只回傳 JSON，不要有 Markdown，不要有額外說明。
如果文件中找不到某個欄位，請填 null 或空陣列。

JSON 格式：
{
  "industry": "製造業子產業或應用場景",
  "size": "企業或工廠規模",
  "digital_maturity": "數位成熟度，例如剛起步、已有 ERP/MES、有資料但未整合、已有 AI/IoT 專案",
  "pain_points": ["主要痛點1", "主要痛點2"],
  "budget": 數字或 null,
  "keyword": "最重要的搜尋關鍵字",
  "summary": "一段簡短摘要，說明這家企業的 AI 需求"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: fileBase64,
                },
              },
              {
                type: 'text',
                text: `檔名：${fileName}\n\n${prompt}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Manufacturing analyze API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        error: `Claude 文件解析失敗 (${response.status})`,
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

    let extracted;
    try {
      extracted = JSON.parse(clean);
    } catch (err) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw err;
      extracted = JSON.parse(match[0]);
    }

    const safeExtracted = {
      industry: extracted.industry || null,
      size: extracted.size || null,
      digital_maturity: extracted.digital_maturity || null,
      pain_points: Array.isArray(extracted.pain_points) ? extracted.pain_points : [],
      budget: Number.isFinite(Number(extracted.budget)) ? Number(extracted.budget) : null,
      keyword: extracted.keyword || null,
      summary: extracted.summary || null,
    };

    const agentMessage = [
      `我已讀取 ${fileName}。`,
      safeExtracted.summary ? `摘要：${safeExtracted.summary}` : null,
      safeExtracted.industry ? `產業/場景：${safeExtracted.industry}` : null,
      safeExtracted.digital_maturity ? `數位成熟度：${safeExtracted.digital_maturity}` : null,
      safeExtracted.pain_points.length ? `主要痛點：${safeExtracted.pain_points.join('、')}` : null,
      safeExtracted.keyword ? `推薦關鍵字：${safeExtracted.keyword}` : null,
      '我會把這些條件納入製造業方案推薦。',
    ].filter(Boolean).join('\n');

    return res.status(200).json({
      success: true,
      summary: safeExtracted.summary || '',
      extracted: safeExtracted,
      agentMessage,
    });
  } catch (err) {
    console.error('Manufacturing analyze server error:', err);
    return res.status(500).json({ success: false, error: err.message || '文件解析失敗' });
  }
}

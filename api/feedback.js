const BASE_ID = 'appttP04OnzzC7qxG';
const FEEDBACK_TABLE_ID = 'tbly0aNVLiogY9Eu1';

const ALLOWED_MILESTONES = new Set([
  'M1 AI語意搜尋',
  'M2 案例知識庫',
  'M3 情境實戰',
  'M4 真實應用',
  '其他回饋',
]);
const ALLOWED_PATH_CHOICES = new Set(['AI 搜尋', 'AI 分析', '兩者都用']);
const ALLOWED_WOULD_CITE = new Set(['會', '不會']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'AIRTABLE_TOKEN not configured' });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function logAirtableError(table, status, body) {
    const time = new Date().toISOString();
    console.error(`[Airtable Error] status=${status} endpoint=${req.url} table=${table} time=${time} message=${body}`);
    if (status === 429) {
      console.error(`[Airtable Rate Limit] status=429 endpoint=${req.url} table=${table} time=${time}`);
    }
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

  function parseBody() {
    if (typeof req.body === 'string') {
      return JSON.parse(req.body || '{}');
    }
    return req.body || {};
  }

  function requiredString(body, key, label, min, max) {
    const value = String(body[key] || '').trim();
    if (value.length < min) throw new Error(`${label}為必填`);
    if (value.length > max) throw new Error(`${label}不可超過${max}字`);
    return value;
  }

  function optionalString(body, key, label, max) {
    if (body[key] === undefined || body[key] === null || body[key] === '') return null;
    const value = String(body[key]).trim();
    if (!value) return null;
    if (value.length > max) throw new Error(`${label}不可超過${max}字`);
    return value;
  }

  function optionalInteger(body, key, label, min, max) {
    if (body[key] === undefined || body[key] === null || body[key] === '') return null;
    const value = Number(body[key]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${label}必須是${min}到${max}的整數`);
    }
    return value;
  }

  try {
    const body = parseBody();
    const name = requiredString(body, 'name', '姓名', 1, 50);
    const department = optionalString(body, 'department', '部門', 50);
    const milestone = requiredString(body, 'milestone', '里程碑', 1, 50);
    const detail = requiredString(body, 'detail', '回報內容', 1, 2000);
    const score = optionalInteger(body, 'score', '評分', 1, 5);
    const relevantCount = optionalInteger(body, 'relevant_count', '相關筆數', 0, 5);
    const pathChoice = optionalString(body, 'path_choice', '路徑選擇', 20);
    const wouldCite = optionalString(body, 'would_cite', '會否引用', 10);

    if (!ALLOWED_MILESTONES.has(milestone)) {
      return res.status(400).json({ error: '里程碑不在允許範圍內' });
    }
    if (pathChoice && !ALLOWED_PATH_CHOICES.has(pathChoice)) {
      return res.status(400).json({ error: '路徑選擇不在允許範圍內' });
    }
    if (wouldCite && !ALLOWED_WOULD_CITE.has(wouldCite)) {
      return res.status(400).json({ error: '會否引用不在允許範圍內' });
    }

    const fields = {
      Name: name,
      里程碑: milestone,
      回報內容: detail,
    };
    if (department) fields['部門'] = department;
    if (score !== null) fields['評分'] = score;
    if (relevantCount !== null) fields['相關筆數'] = relevantCount;
    if (pathChoice) fields['路徑選擇'] = pathChoice;
    if (wouldCite) fields['會否引用'] = wouldCite;

    const response = await fetchAirtableWithRetry(
      `https://api.airtable.com/v0/${BASE_ID}/${FEEDBACK_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: [{ fields }],
          typecast: true,
        }),
      },
      'Feedback'
    );

    if (!response.ok) {
      const bodyText = await response.text();
      logAirtableError('Feedback', response.status, bodyText);
      return res.status(502).json({ error: 'Storage write failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: 'JSON 格式錯誤' });
    }
    return res.status(400).json({ error: err.message || '欄位驗證失敗' });
  }
}

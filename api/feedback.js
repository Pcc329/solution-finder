import { requireAuth } from '../_lib/auth.js';
import { insertSupabase } from '../_lib/supabase-insert.js';

const ALLOWED_MILESTONES = new Set([
  'M1 AI語意搜尋',
  'M2 案例知識庫',
  'M3 AI分析推薦',
  '其他回饋',
]);
const ALLOWED_PATH_CHOICES = new Set(['AI 搜尋', 'AI 分析', '兩者都用']);
const ALLOWED_WOULD_CITE = new Set(['會', '不會']);
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  record.count += 1;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAuth(req, res)) return;

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: '提交過於頻繁，請稍後再試' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' });
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
    const milestone = requiredString(body, 'milestone', '任務', 1, 50);
    const detail = requiredString(body, 'detail', '回報內容', 1, 2000);
    const score = optionalInteger(body, 'score', '評分', 1, 5);
    const relevantCount = optionalInteger(body, 'relevant_count', '相關筆數', 0, 5);
    const pathChoice = optionalString(body, 'path_choice', '路徑選擇', 20);
    const wouldCite = optionalString(body, 'would_cite', '會否引用', 10);

    if (!ALLOWED_MILESTONES.has(milestone)) {
      return res.status(400).json({ error: '任務不在允許範圍內' });
    }
    if (pathChoice && !ALLOWED_PATH_CHOICES.has(pathChoice)) {
      return res.status(400).json({ error: '路徑選擇不在允許範圍內' });
    }
    if (wouldCite && !ALLOWED_WOULD_CITE.has(wouldCite)) {
      return res.status(400).json({ error: '會否引用不在允許範圍內' });
    }

    const stored = await insertSupabase('feedback_submissions', {
      name,
      department,
      milestone,
      detail,
      score,
      relevant_count: relevantCount,
      path_choice: pathChoice,
      would_cite: wouldCite,
    });

    if (!stored) {
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

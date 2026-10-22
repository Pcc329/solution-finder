// Same-origin relay: dashboard passwords and signing secrets live only in
// Supabase Secrets. The service-role key is never sent by this Vercel function.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const action = req.query?.action;
  if (!['login', 'data'].includes(action)) return res.status(404).json({ error: 'Not found' });
  if (req.method !== (action === 'login' ? 'POST' : 'GET')) return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL) return res.status(503).json({ error: '儀表板連線尚未設定' });
  if (action === 'data' && !/^Bearer \S+$/i.test(req.headers?.authorization || '')) {
    return res.status(401).json({ error: '請先登入' });
  }
  if (action === 'login' && typeof req.body?.password !== 'string') return res.status(400).json({ error: '請輸入密碼' });
  if (action === 'login' && Buffer.byteLength(req.body.password) > 1024) return res.status(413).json({ error: '登入內容過長' });
  try {
    const upstream = await fetch(new URL(`/functions/v1/dash-data/${action}`, process.env.SUPABASE_URL), {
      method: req.method,
      headers: action === 'login' ? { 'Content-Type': 'application/json' }
        : { Authorization: req.headers.authorization },
      ...(action === 'login' ? { body: JSON.stringify({ password: req.body.password }) } : {}),
      cache: 'no-store', signal: AbortSignal.timeout(25_000),
    });
    const body = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json({ error: body.error || '儀表板服務暫時無法使用' });
    return res.status(200).json(body);
  } catch {
    return res.status(502).json({ error: '儀表板服務暫時無法使用' });
  }
}

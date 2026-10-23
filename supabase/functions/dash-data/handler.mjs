// Same expiry.HMAC-SHA256 token format and seven-day lifetime as _lib/auth.js.
// This function only reads the three dashboard relations. It never writes data.
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
const queries = [
  ['platforms', 'dash_platform_overview', 'platform_key'],
  ['vendors', 'dash_vendor_platforms', 'company_id'],
  ['profiles', 'platform_profiles', 'platform_order,dimension_order,platform_key,dimension'],
];

const PRODUCTION_ORIGIN = 'https://solution-finder-gray.vercel.app';
const ALLOWED_HEADERS = ['authorization', 'content-type'];

export function isAllowedOrigin(origin) {
  return origin === PRODUCTION_ORIGIN;
}

function responseHeaders(origin = null) {
  const headers = { ...HEADERS, Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body, status = 200, origin = null) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createToken(expiry, secret) {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(String(expiry)));
  return `${expiry}.${Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function verifyToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string') return false;
  const [expiry, signature, ...extra] = token.split('.');
  const expires = Number(expiry);
  if (extra.length || !/^\d+$/.test(expiry) || !Number.isSafeInteger(expires)
    || expires <= now || expires > now + MAX_AGE || !/^[a-f0-9]{64}$/i.test(signature || '')) return false;
  return crypto.subtle.verify('HMAC', await hmacKey(secret),
    new Uint8Array(signature.match(/../g).map(b => parseInt(b, 16))), encoder.encode(expiry));
}

async function passwordMatches(provided, expected) {
  const hashes = await Promise.all([provided, expected].map(s => crypto.subtle.digest('SHA-256', encoder.encode(s))));
  const a = new Uint8Array(hashes[0]), b = new Uint8Array(hashes[1]);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

async function readAll(fetcher, url, key, relation, order) {
  const rows = [];
  // Use explicit offset/limit rather than relying on the default REST row cap.
  // Content-Range also handles a project configured with a cap below 1000.
  for (;;) {
    const endpoint = new URL(`/rest/v1/${relation}`, url);
    endpoint.searchParams.set('select', '*');
    endpoint.searchParams.set('order', order);
    endpoint.searchParams.set('offset', String(rows.length));
    endpoint.searchParams.set('limit', '1000');
    const response = await fetcher(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      cache: 'no-store', signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error('Dashboard relation unavailable');
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Invalid dashboard response');
    rows.push(...page);
    const total = response.headers.get('content-range')?.split('/')[1];
    if (!page.length || (total && total !== '*' && rows.length >= Number(total))) break;
    if (!total && page.length < 1000) break;
  }
  return rows;
}

export function createHandler({ env, fetcher = fetch, now = Date.now }) {
  return async request => {
    const origin = request.headers.get('origin');
    if (origin !== null && !isAllowedOrigin(origin)) return json({ error: '來源未獲允許' }, 403);
    const respond = (body, status = 200) => json(body, status, origin);
    const path = new URL(request.url).pathname;
    const action = path.match(/(?:^|\/)dash-data\/(login|data)\/?$/)?.[1];
    if (!action) return respond({ error: 'Not found' }, 404);
    const method = action === 'login' ? 'POST' : 'GET';
    if (request.method === 'OPTIONS') {
      const requestedHeaders = (request.headers.get('access-control-request-headers') || '')
        .split(',').map(header => header.trim().toLowerCase()).filter(Boolean);
      if (!origin || request.headers.get('access-control-request-method') !== method
        || requestedHeaders.some(header => !ALLOWED_HEADERS.includes(header))) {
        return respond({ error: '不允許的預檢請求' }, 403);
      }
      return new Response(null, { status: 204, headers: {
        ...responseHeaders(origin), 'Access-Control-Allow-Methods': method,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      } });
    }
    if (request.method !== method) return respond({ error: 'Method not allowed' }, 405);
    const secret = env('DASH_TOKEN_SECRET');
    const password = env('DASH_PASSWORD');
    if (!secret || !password) return respond({ error: '儀表板登入尚未設定' }, 503);
    try {
      if (action === 'login') {
        if (!request.headers.get('content-type')?.includes('application/json')) return respond({ error: '請使用 JSON' }, 415);
        // Shared-password gate follows api/auth.js; no password is returned or logged.
        const text = await request.text();
        if (encoder.encode(text).length > 4096) return respond({ error: '登入內容過長' }, 413);
        let body;
        try { body = JSON.parse(text); } catch { return respond({ error: '無效的登入內容' }, 400); }
        if (typeof body?.password !== 'string' || !(await passwordMatches(body.password, password))) {
          return respond({ error: '密碼錯誤' }, 401);
        }
        const expires = now() + MAX_AGE;
        return respond({ token: await createToken(expires, secret), expires_at: new Date(expires).toISOString() });
      }
      const bearer = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!(await verifyToken(bearer, secret, now()))) return respond({ error: '登入已失效，請重新登入' }, 401);
      const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) return respond({ error: '儀表板資料服務尚未設定' }, 503);
      const results = await Promise.all(queries.map(async ([name, relation, order]) =>
        [name, await readAll(fetcher, url, key, relation, order)]));
      return respond({ ...Object.fromEntries(results), generated_at: new Date(now()).toISOString() });
    } catch {
      return respond({ error: '資料服務暫時無法使用，請稍後重新整理' }, 502);
    }
  };
}

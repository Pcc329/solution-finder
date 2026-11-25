import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'sf_session';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const authCache = new Map();
const CACHE_TTL_MS = 60_000;
export const AUTH_UNAVAILABLE = '登入驗證服務暫時無法使用，請稍後再試';

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function validSignature(payload, signature, secret) {
  if (!/^[a-f0-9]{64}$/i.test(signature || '')) return false;
  const provided = Buffer.from(signature, 'hex');
  const expected = Buffer.from(sign(payload, secret), 'hex');
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function sessionIdentity(req) {
  const secret = process.env.SESSION_SECRET;
  const session = req.cookies?.[SESSION_COOKIE_NAME];
  if (!secret || !session) return null;
  const parts = String(session).split('.');
  const personal = parts[0] === 'v2';
  if (parts.length !== (personal ? 4 : 2)) return null;
  const expiry = parts[personal ? 1 : 0];
  if (!Number.isSafeInteger(Number(expiry)) || Number(expiry) <= Date.now()) return null;
  if (personal && !UUID.test(parts[2])) return null;
  const payload = parts.slice(0, -1).join('.');
  if (!validSignature(payload, parts.at(-1), secret)) return null;
  return personal ? { method: 'user', userId: parts[2] } : { method: 'shared' };
}

// Cryptographic validity only; requireAuth applies the shared-login switch and user status.
export function verifySession(req) {
  return Boolean(sessionIdentity(req));
}

export function verifyApiKey(req) {
  const apiKey = String(req.headers?.['x-api-key'] || '').trim();
  const allowlist = String(process.env.API_KEYS_ALLOWLIST || '')
    .split(',').map(key => key.trim()).filter(Boolean);
  return Boolean(apiKey) && allowlist.includes(apiKey);
}

export function createSessionValue(expiry, secret) {
  return `${expiry}.${sign(String(expiry), secret)}`;
}

export function createUserSessionValue(expiry, userId, secret) {
  if (!UUID.test(userId)) throw new Error('Invalid user UUID');
  const payload = `v2.${expiry}.${userId}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function sharedLoginEnabled() {
  return process.env.SHARED_PASSWORD_ENABLED === 'true';
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', 'sf_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

export function invalidateAuthCache(userId) {
  authCache.delete(userId);
}

// Test hook: only clears cached user status.
export function resetAuthCacheForTests() {
  authCache.clear();
}

export async function getUserRole(userId, { refresh = false } = {}) {
  if (!UUID.test(userId)) throw new Error(AUTH_UNAVAILABLE);
  const now = Date.now();
  // Each Vercel instance has its own cache; status may remain valid for up to 60 seconds.
  for (const [key, value] of authCache) {
    if (now - value.fetchedAt >= CACHE_TTL_MS) authCache.delete(key);
  }
  if (!refresh && authCache.has(userId)) return authCache.get(userId);
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error();
    const endpoint = new URL('/rest/v1/user_roles', url);
    endpoint.search = new URLSearchParams({
      select: 'email,role,is_active,must_change_password', user_id: `eq.${userId}`, limit: '1',
    }).toString();
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error();
    if (!rows.length) return null;
    const row = rows[0];
    if (typeof row.email !== 'string' || !['super', 'admin', 'user'].includes(row.role)
      || typeof row.is_active !== 'boolean' || typeof row.must_change_password !== 'boolean') throw new Error();
    const result = { email: row.email, role: row.role, isActive: row.is_active,
      mustChangePassword: row.must_change_password, fetchedAt: Date.now() };
    authCache.set(userId, result);
    return result;
  } catch {
    // Do not cache failures or serve stale status when the database cannot be checked.
    throw new Error(AUTH_UNAVAILABLE);
  }
}

export async function requireAuth(req, res, options = {}) {
  const identity = sessionIdentity(req);
  if (identity?.method === 'user') {
    let user;
    try {
      user = await getUserRole(identity.userId);
    } catch {
      res.status(503).json({ error: AUTH_UNAVAILABLE });
      return null;
    }
    if (!user?.isActive) {
      clearSession(res);
      res.status(401).json({ error: '未授權，請先登入' });
      return null;
    }
    if (user.mustChangePassword && options.allowMustChange !== true) {
      res.status(403).json({ error: '請先變更密碼', code: 'must_change_password' });
      return null;
    }
    return { ...identity, email: user.email, role: user.role,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}) };
  }
  if (identity?.method === 'shared' && sharedLoginEnabled()) return identity;
  if (verifyApiKey(req)) return { method: 'api_key' };
  res.status(401).json({ error: '未授權，請先登入' });
  return null;
}

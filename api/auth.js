import crypto from 'node:crypto';
import { AUTH_UNAVAILABLE, clearSession, createSessionValue, createUserSessionValue,
  getUserRole, invalidateAuthCache, requireAuth, sharedLoginEnabled } from '../_lib/auth.js';
import { passwordPolicyError } from '../_lib/password-policy.js';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const ipLimits = new Map();
const accountLimits = new Map();
const LOCK_MS = 15 * 60_000;
const unavailable = '登入服務暫時無法使用，請稍後再試';

// In-memory limits are per execution instance, not global across Vercel instances.
function allowIp(req, action) {
  const now = Date.now();
  for (const [key, record] of ipLimits) {
    if (now - record.start >= 60_000) ipLimits.delete(key);
  }
  for (const [key, record] of accountLimits) {
    if (record.expires <= now) accountLimits.delete(key);
  }
  const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const key = `${action}:${ip}`;
  const record = ipLimits.get(key) || { start: now, count: 0 };
  ipLimits.set(key, record);
  record.count += 1;
  return record.count <= 20;
}

function locked(key) {
  const record = accountLimits.get(key);
  return Boolean(record && record.failures >= 5 && record.expires > Date.now());
}

function failed(key) {
  const record = accountLimits.get(key) || { failures: 0 };
  accountLimits.set(key, { failures: record.failures + 1, expires: Date.now() + LOCK_MS });
}

function tooMany(res) {
  return res.status(429).json({ error: '嘗試次數過多，請稍後再試' });
}

function setSession(res, value) {
  res.setHeader('Set-Cookie', `sf_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`);
}

async function passwordGrant(email, password) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error();
  return fetch(new URL('/auth/v1/token?grant_type=password', url), {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!allowIp(req, 'login')) return tooMany(res);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email) {
    if (!sharedLoginEnabled()) return res.status(400).json({ error: '請輸入院內 email 與密碼' });
    const sitePassword = process.env.SITE_PASSWORD;
    const secret = process.env.SESSION_SECRET;
    if (!sitePassword || !secret) return res.status(500).json({ error: 'Authentication is not configured' });
    const provided = Buffer.from(password, 'utf8');
    const expected = Buffer.from(sitePassword, 'utf8');
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return res.status(401).json({ error: '密碼錯誤' });
    }
    setSession(res, createSessionValue(Date.now() + SESSION_MAX_AGE_SECONDS * 1000, secret));
    return res.status(200).json({ ok: true });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '請輸入有效的 email' });
  const account = `login:${email}`;
  if (locked(account)) return tooMany(res);
  try {
    if (!process.env.SESSION_SECRET) throw new Error();
    const response = await passwordGrant(email, password);
    if (!response.ok) {
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) return res.status(503).json({ error: unavailable });
      failed(account);
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }
    const data = await response.json();
    const userId = data.user?.id;
    // Always refresh after a new password grant, including reactivation by an administrator.
    const user = await getUserRole(userId, { refresh: true });
    if (!user?.isActive) return res.status(403).json({ error: '帳號未啟用，請洽系統管理者' });
    const value = createUserSessionValue(Date.now() + SESSION_MAX_AGE_SECONDS * 1000, userId, process.env.SESSION_SECRET);
    setSession(res, value);
    accountLimits.delete(account);
    return res.status(200).json({ ok: true, must_change_password: user.mustChangePassword });
  } catch {
    return res.status(503).json({ error: unavailable });
  }
}

async function changePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!allowIp(req, 'change-password')) return tooMany(res);
  const auth = await requireAuth(req, res, { allowMustChange: true });
  if (!auth) return;
  if (auth.method !== 'user') return res.status(401).json({ error: '未授權，請先登入' });
  const account = `change-password:${auth.email}`;
  if (locked(account)) return tooMany(res);
  const current = typeof req.body?.current_password === 'string' ? req.body.current_password : '';
  const next = req.body?.new_password;
  const policyError = passwordPolicyError(current, next, auth.email);
  if (policyError) return res.status(400).json({ error: policyError });
  let grant;
  try {
    const response = await passwordGrant(auth.email, current);
    if (!response.ok) {
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) return res.status(503).json({ error: unavailable });
      failed(account);
      return res.status(401).json({ error: '目前密碼錯誤' });
    }
    grant = await response.json();
    if (!grant.access_token || grant.user?.id !== auth.userId) {
      failed(account);
      return res.status(401).json({ error: '目前密碼錯誤' });
    }
  } catch {
    return res.status(503).json({ error: unavailable });
  }
  try {
    const response = await fetch(new URL('/auth/v1/user', process.env.SUPABASE_URL), {
      method: 'PUT', headers: { apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${grant.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: next }),
    });
    if (!response.ok) return res.status(502).json({ error: '密碼變更失敗，請稍後再試' });
  } catch {
    return res.status(502).json({ error: '密碼變更失敗，請稍後再試' });
  }
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error();
    const endpoint = new URL('/rest/v1/user_roles', url);
    endpoint.searchParams.set('user_id', `eq.${auth.userId}`);
    const response = await fetch(endpoint, {
      method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ must_change_password: false }),
    });
    if (!response.ok) throw new Error();
  } catch {
    return res.status(502).json({ error: '密碼已變更，但帳號狀態更新失敗；請使用新密碼重試或洽系統管理者' });
  }
  invalidateAuthCache(auth.userId);
  accountLimits.delete(account);
  return res.status(200).json({ ok: true });
}

function logout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearSession(res);
  return res.status(200).json({ ok: true });
}

async function sessionCheck(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  // Buffer only the auth error so session-check can keep its unauthenticated response contract.
  const check = { code: 200, body: null,
    setHeader: (key, value) => res.setHeader(key, value),
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const auth = await requireAuth(req, check, { allowMustChange: true });
  if (!auth) {
    if (check.code !== 401) return res.status(check.code).json(check.body || { error: AUTH_UNAVAILABLE });
    return res.status(401).json({ authenticated: false, shared_login_enabled: sharedLoginEnabled() });
  }
  return res.status(200).json({ authenticated: true, method: auth.method,
    ...(auth.method === 'user' ? { email: auth.email, role: auth.role,
      must_change_password: auth.mustChangePassword === true } : {}) });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const action = String(req.query?.action || '').trim();
  if (action === 'login') return login(req, res);
  if (action === 'logout') return logout(req, res);
  if (action === 'session-check') return sessionCheck(req, res);
  if (action === 'change-password') return changePassword(req, res);
  return res.status(404).json({ error: 'Not found' });
}

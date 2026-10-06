import crypto from 'node:crypto';
import { createSessionValue, verifySession } from '../_lib/auth.js';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const SCRYPT_KEY_LENGTH = 64;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;
const DUMMY_SCRYPT_SALT = Buffer.alloc(16);
const DUMMY_SCRYPT_HASH = Buffer.alloc(SCRYPT_KEY_LENGTH);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function clearSession(res) {
  res.setHeader('Set-Cookie', 'sf_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

function getAuthConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !sessionSecret) return null;

  return {
    supabaseUrl,
    serviceRoleKey,
    sessionSecret,
  };
}

async function fetchUser(config, column, value, select) {
  const endpoint = new URL('/rest/v1/users', config.supabaseUrl);
  endpoint.searchParams.set('select', select);
  endpoint.searchParams.set(column, `eq.${value}`);
  endpoint.searchParams.set('limit', '1');

  const response = await fetch(endpoint, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `[Supabase Error] status=${response.status} endpoint=/api/auth table=users time=${new Date().toISOString()} message=${body}`
    );
    throw new Error('User lookup failed');
  }

  const users = await response.json();
  return Array.isArray(users) ? users[0] || null : null;
}

function passwordMatches(password, user) {
  const hashIsValid = /^[a-f0-9]{128}$/i.test(String(user?.password_hash || ''));
  const saltIsValid = /^[a-f0-9]{2,}$/i.test(String(user?.password_salt || ''))
    && String(user.password_salt).length % 2 === 0;
  const salt = hashIsValid && saltIsValid
    ? Buffer.from(user.password_salt, 'hex')
    : DUMMY_SCRYPT_SALT;
  const expectedHash = hashIsValid
    ? Buffer.from(user.password_hash, 'hex')
    : DUMMY_SCRYPT_HASH;
  const actualHash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS);

  return hashIsValid
    && saltIsValid
    && actualHash.length === expectedHash.length
    && crypto.timingSafeEqual(actualHash, expectedHash);
}

async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const config = getAuthConfig();
  if (!config) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!USERNAME_PATTERN.test(username) || !password) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  try {
    const user = await fetchUser(
      config,
      'username',
      username,
      'id,username,display_name,password_hash,password_salt'
    );
    if (!passwordMatches(password, user)) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const expiry = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
    const session = createSessionValue(expiry, user.id, config.sessionSecret);
    res.setHeader(
      'Set-Cookie',
      `sf_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
    );
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Authentication login error:', error);
    return res.status(500).json({ error: 'Authentication is temporarily unavailable' });
  }
}

function logout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearSession(res);
  return res.status(200).json({ ok: true });
}

async function sessionCheck(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = verifySession(req);
  if (!session?.authenticated) return res.status(401).json({ authenticated: false });

  const config = getAuthConfig();
  if (!config) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  try {
    const user = await fetchUser(config, 'id', session.userId, 'id,username,display_name');
    if (!user) {
      clearSession(res);
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({
      authenticated: true,
      username: String(user.username || ''),
      displayName: String(user.display_name || ''),
    });
  } catch (error) {
    console.error('Authentication session check error:', error);
    return res.status(500).json({ error: 'Authentication is temporarily unavailable' });
  }
}

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = String(req.query?.action || '').trim();
  if (action === 'login') return login(req, res);
  if (action === 'logout') return logout(req, res);
  if (action === 'session-check') return sessionCheck(req, res);
  return res.status(404).json({ error: 'Not found' });
}

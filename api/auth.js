import crypto from 'node:crypto';
import { createSessionValue, verifySession } from '../_lib/auth.js';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function clearSession(res) {
  res.setHeader('Set-Cookie', 'sf_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sitePassword = process.env.SITE_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sitePassword || !sessionSecret) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  const providedPassword = Buffer.from(String(req.body?.password || ''), 'utf8');
  const expectedPassword = Buffer.from(sitePassword, 'utf8');
  const passwordsMatch = providedPassword.length === expectedPassword.length
    && crypto.timingSafeEqual(providedPassword, expectedPassword);
  if (!passwordsMatch) return res.status(401).json({ error: '密碼錯誤' });

  const expiry = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const session = createSessionValue(expiry, sessionSecret);
  res.setHeader(
    'Set-Cookie',
    `sf_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  );
  return res.status(200).json({ ok: true });
}

function logout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearSession(res);
  return res.status(200).json({ ok: true });
}

function sessionCheck(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifySession(req)) return res.status(401).json({ authenticated: false });
  return res.status(200).json({ authenticated: true });
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

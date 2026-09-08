import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'sf_session';

function signExpiry(expiry, secret) {
  return crypto.createHmac('sha256', secret).update(expiry).digest('hex');
}

export function verifySession(req) {
  const secret = process.env.SESSION_SECRET;
  const session = req.cookies?.[SESSION_COOKIE_NAME];
  if (!secret || !session) return false;

  const [expiry, signature, ...extra] = String(session).split('.');
  const expiryNumber = Number(expiry);
  if (
    extra.length ||
    !Number.isSafeInteger(expiryNumber) ||
    expiryNumber <= Date.now() ||
    !/^[a-f0-9]{64}$/i.test(signature || '')
  ) {
    return false;
  }

  const expectedSignature = signExpiry(expiry, secret);
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function verifyApiKey(req) {
  const apiKey = String(req.headers?.['x-api-key'] || '').trim();
  const allowlist = String(process.env.API_KEYS_ALLOWLIST || '')
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);
  return Boolean(apiKey) && allowlist.includes(apiKey);
}

export function createSessionValue(expiry, secret) {
  return `${expiry}.${signExpiry(String(expiry), secret)}`;
}

export function requireAuth(req, res) {
  if (verifySession(req) || verifyApiKey(req)) return true;
  res.status(401).json({ error: '未授權，請先登入' });
  return false;
}

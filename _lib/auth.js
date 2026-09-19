import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'sf_session';

function signSessionPayload(expiry, userId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${expiry}.${userId}`)
    .digest('hex');
}

export function verifySession(req) {
  const secret = process.env.SESSION_SECRET;
  const session = req.cookies?.[SESSION_COOKIE_NAME];
  if (!secret || !session) return false;

  const [expiry, userId, signature, ...extra] = String(session).split('.');
  const expiryNumber = Number(expiry);
  const userIdNumber = Number(userId);
  if (
    extra.length ||
    !Number.isSafeInteger(expiryNumber) ||
    expiryNumber <= Date.now() ||
    !Number.isSafeInteger(userIdNumber) ||
    userIdNumber <= 0 ||
    !/^[a-f0-9]{64}$/i.test(signature || '')
  ) {
    return false;
  }

  const expectedSignature = signSessionPayload(expiry, userId, secret);
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  return { authenticated: true, userId: userIdNumber };
}

export function verifyApiKey(req) {
  const apiKey = String(req.headers?.['x-api-key'] || '').trim();
  const allowlist = String(process.env.API_KEYS_ALLOWLIST || '')
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);
  return Boolean(apiKey) && allowlist.includes(apiKey);
}

export function createSessionValue(expiry, userId, secret) {
  const expiryNumber = Number(expiry);
  const userIdNumber = Number(userId);
  if (
    !Number.isSafeInteger(expiryNumber) ||
    !Number.isSafeInteger(userIdNumber) ||
    userIdNumber <= 0
  ) {
    throw new Error('Invalid session payload');
  }

  return `${expiryNumber}.${userIdNumber}.${signSessionPayload(expiryNumber, userIdNumber, secret)}`;
}

export function requireAuth(req, res) {
  if (verifySession(req)?.authenticated || verifyApiKey(req)) return true;
  res.status(401).json({ error: '未授權，請先登入' });
  return false;
}

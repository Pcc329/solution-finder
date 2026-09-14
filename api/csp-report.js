const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_REPORTS_PER_REQUEST = 20;
const MAX_URI_LENGTH = 2048;
const MAX_DIRECTIVE_LENGTH = 512;

export const config = {
  api: {
    bodyParser: false,
  },
};

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) return false;

  record.count += 1;
  return true;
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

async function readJsonBody(req) {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    const error = new Error('Request body too large');
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) return null;
  return JSON.parse(rawBody);
}

function normalizeString(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : '';
}

function normalizeReport(report) {
  if (!report || typeof report !== 'object') return null;

  const blockedUri = normalizeString(report['blocked-uri'], MAX_URI_LENGTH);
  const violatedDirective = normalizeString(
    report['violated-directive'] || report['effective-directive'],
    MAX_DIRECTIVE_LENGTH
  );
  const documentUri = normalizeString(report['document-uri'], MAX_URI_LENGTH);

  if (!blockedUri || !violatedDirective || !documentUri) return null;

  return {
    blocked_uri: blockedUri,
    violated_directive: violatedDirective,
    document_uri: documentUri,
  };
}

function collectReports(payload) {
  const envelopes = Array.isArray(payload) ? payload : [payload];

  return envelopes
    .map(envelope => {
      if (!envelope || typeof envelope !== 'object') return null;
      return envelope['csp-report'] || envelope.body || envelope;
    })
    .map(normalizeReport)
    .filter(Boolean)
    .slice(0, MAX_REPORTS_PER_REQUEST);
}

async function writeReports(reports, req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  const endpoint = new URL('/rest/v1/csp_violations', supabaseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(reports),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `[Supabase Error] status=${response.status} endpoint=${req.url} table=csp_violations time=${new Date().toISOString()} message=${body}`
    );
    throw new Error(`Supabase error: ${response.status}`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkRateLimit(getClientIp(req))) {
    return res.status(429).json({ error: 'Too many reports' });
  }

  try {
    const payload = await readJsonBody(req);
    const reports = collectReports(payload);

    if (reports.length === 0) return res.status(204).end();

    await writeReports(reports, req);
    return res.status(204).end();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON report' });
    }
    if (error.statusCode === 413) {
      return res.status(413).json({ error: 'Request body too large' });
    }

    console.error('CSP report API error:', error);
    return res.status(500).json({ error: 'Report storage failed' });
  }
}

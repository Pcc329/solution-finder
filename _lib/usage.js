import crypto from 'node:crypto';
import { insertSupabase } from './supabase-insert.js';

export async function recordUsage(req, auth, action, detail = {}) {
  try {
    const safeDetail = {};
    if (typeof detail.endpoint === 'string') safeDetail.endpoint = detail.endpoint;
    if (typeof detail.ok === 'boolean') safeDetail.ok = detail.ok;
    if (Number.isInteger(detail.status)) safeDetail.status = detail.status;
    if (typeof detail.company_id === 'string') safeDetail.company_id = detail.company_id;
    const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const salt = process.env.LOG_HASH_SALT;
    await insertSupabase('usage_logs', {
      user_id: auth.method === 'user' ? auth.userId : null,
      auth_method: auth.method, action, detail: safeDetail,
      ip_hash: salt ? crypto.createHmac('sha256', salt).update(ip).digest('hex') : null,
    });
  } catch {
    // Metering must never change the business response or disclose upstream details.
  }
}

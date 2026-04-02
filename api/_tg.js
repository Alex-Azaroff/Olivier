const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwtHS256(payload, secret, expiresInSec) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + (expiresInSec || 60 * 60 * 24 * 30) };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(body));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64');
  const s = sig.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${s}`;
}

function verifyJwtHS256(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (expected !== s) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && now >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Telegram Login Widget verification:
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function verifyTelegramLogin(data, botToken) {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'bad_payload' };
  const hash = String(data.hash || '');
  if (!hash) return { ok: false, reason: 'missing_hash' };

  // Build data-check-string from fields (except hash), sorted by key.
  const pairs = Object.keys(data)
    .filter((k) => k !== 'hash' && data[k] != null)
    .sort()
    .map((k) => `${k}=${data[k]}`);
  const checkString = pairs.join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest(); // binary
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  if (hmac !== hash) return { ok: false, reason: 'hash_mismatch' };

  const authDate = Number(data.auth_date);
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: 'bad_auth_date' };
  // Optional freshness check (24h); allow larger if you want.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - authDate) > 60 * 60 * 24) return { ok: false, reason: 'stale_auth' };

  const id = String(data.id || '').trim();
  if (!id) return { ok: false, reason: 'missing_id' };
  return { ok: true, telegram_user_id: id };
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

module.exports = {
  signJwtHS256,
  verifyJwtHS256,
  verifyTelegramLogin,
  parseCookies
};


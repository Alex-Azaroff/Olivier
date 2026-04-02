const crypto = require('crypto');
const { getSupabaseAdmin, getSupabaseAdminConfigError } = require('../../_supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: getSupabaseAdminConfigError() || 'server_not_configured' }));
    return;
  }
  const token = crypto.randomBytes(18).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from('web_login_tokens').insert({
    token,
    expires_at: expiresAt
  });
  if (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: `db_error:${error.message || 'unknown'}` }));
    return;
  }
  const botUsername = process.env.VITE_TELEGRAM_BOT_USERNAME || 'ZayKypi_Bot';
  const botLink = `https://t.me/${botUsername}?start=web_${token}`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, token, expires_at: expiresAt, bot_link: botLink }));
};


const { getSupabaseAdmin } = require('../../_supabaseAdmin');
const { signJwtHS256 } = require('../../_tg');

module.exports = async (req, res) => {
  const supabase = getSupabaseAdmin();
  const jwtSecret = process.env.WEB_JWT_SECRET;
  if (!supabase || !jwtSecret) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'server_not_configured' }));
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const token = String(url.searchParams.get('token') || '').trim();
  if (!token) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'missing_token' }));
    return;
  }

  const { data, error } = await supabase
    .from('web_login_tokens')
    .select('token, telegram_user_id, expires_at, confirmed_at, consumed_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, status: 'not_found' }));
    return;
  }

  const expired = new Date(data.expires_at).getTime() <= Date.now();
  if (expired) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, status: 'expired' }));
    return;
  }

  if (!data.telegram_user_id || !data.confirmed_at) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, status: 'pending' }));
    return;
  }

  const jwt = signJwtHS256({ telegram_user_id: String(data.telegram_user_id) }, jwtSecret, 60 * 60 * 24 * 30);
  const cookie =
    `olivier_session=${encodeURIComponent(jwt)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}` +
    (process.env.NODE_ENV === 'production' ? '; Secure' : '');
  res.setHeader('Set-Cookie', cookie);

  if (!data.consumed_at) {
    await supabase
      .from('web_login_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('token', token);
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, status: 'authorized', telegram_user_id: String(data.telegram_user_id) }));
};


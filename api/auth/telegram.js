const { signJwtHS256, verifyTelegramLogin } = require('../_tg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const botToken = process.env.BOT_TOKEN;
  const jwtSecret = process.env.WEB_JWT_SECRET;
  if (!botToken || !jwtSecret) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'server_not_configured' }));
    return;
  }

  let body = '';
  await new Promise((resolve) => {
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', resolve);
  });

  let data = null;
  try {
    data = JSON.parse(body || '{}');
  } catch {
    data = null;
  }

  const v = verifyTelegramLogin(data, botToken);
  if (!v.ok) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: v.reason }));
    return;
  }

  const token = signJwtHS256({ telegram_user_id: v.telegram_user_id }, jwtSecret, 60 * 60 * 24 * 30);
  const cookie =
    `olivier_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}` +
    (process.env.NODE_ENV === 'production' ? '; Secure' : '');

  res.statusCode = 200;
  res.setHeader('Set-Cookie', cookie);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, telegram_user_id: v.telegram_user_id }));
};


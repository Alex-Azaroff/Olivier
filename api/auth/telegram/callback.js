const { signJwtHS256, verifyTelegramLogin } = require('../../_tg');

module.exports = async (req, res) => {
  const botToken = process.env.BOT_TOKEN;
  const jwtSecret = process.env.WEB_JWT_SECRET;
  if (!botToken || !jwtSecret) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Server is not configured');
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const data = {};
  for (const [k, v] of url.searchParams.entries()) data[k] = v;

  const next = data.next || '/';
  const v = verifyTelegramLogin(data, botToken);
  if (!v.ok) {
    res.statusCode = 302;
    res.setHeader('Location', `${next.includes('?') ? next : `${next}?`}auth=failed`);
    res.end();
    return;
  }

  const token = signJwtHS256({ telegram_user_id: v.telegram_user_id }, jwtSecret, 60 * 60 * 24 * 30);
  const cookie =
    `olivier_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}` +
    (process.env.NODE_ENV === 'production' ? '; Secure' : '');

  res.statusCode = 302;
  res.setHeader('Set-Cookie', cookie);
  res.setHeader('Location', next);
  res.end();
};


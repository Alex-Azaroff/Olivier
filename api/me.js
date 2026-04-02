const { parseCookies, verifyJwtHS256 } = require('./_tg');

module.exports = async (req, res) => {
  const jwtSecret = process.env.WEB_JWT_SECRET;
  if (!jwtSecret) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'server_not_configured' }));
    return;
  }

  const cookies = parseCookies(req);
  const token = cookies.olivier_session;
  const payload = verifyJwtHS256(token, jwtSecret);
  const telegramUserId = payload?.telegram_user_id ? String(payload.telegram_user_id) : null;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, telegram_user_id: telegramUserId }));
};


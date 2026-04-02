require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");

// Подключаем Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Подключаем бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// /start — сохраняем пользователя
bot.start(async (ctx) => {
  const user = ctx.from;
  const payload =
    (typeof ctx.startPayload === "string" && ctx.startPayload) ||
    String(ctx.message?.text || "").split(" ").slice(1).join(" ");

  try {
    if (payload && payload.startsWith("web_")) {
      const token = payload.slice(4).trim();
      if (!token) {
        await ctx.reply("Неверный токен входа.");
        return;
      }
      const nowIso = new Date().toISOString();
      const { data: row, error: rowErr } = await supabase
        .from("web_login_tokens")
        .select("token, expires_at, consumed_at")
        .eq("token", token)
        .maybeSingle();
      if (rowErr || !row) {
        await ctx.reply("Токен входа не найден или устарел.");
        return;
      }
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        await ctx.reply("Токен входа истек. Вернитесь на сайт и начните вход заново.");
        return;
      }
      if (row.consumed_at) {
        await ctx.reply("Этот токен уже использован. Создайте новый вход на сайте.");
        return;
      }
      const { error: updErr } = await supabase
        .from("web_login_tokens")
        .update({
          telegram_user_id: String(user.id),
          confirmed_at: nowIso
        })
        .eq("token", token);
      if (updErr) {
        console.error("web_login_tokens update error:", updErr);
        await ctx.reply("Не удалось подтвердить вход. Попробуйте ещё раз.");
        return;
      }
      await ctx.reply("Вход подтверждён. Вернитесь в браузер — сайт авторизует вас автоматически.");
      return;
    }

    await supabase.from("users").upsert({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name
    });

    ctx.reply(
      `Привет, ${user.first_name}! Добро пожаловать 🚀`,
      Markup.keyboard([["Начать работу"]]).resize()
    );
  } catch (error) {
    console.error("Supabase error:", error);
    ctx.reply("Произошла ошибка при сохранении данных 😢");
  }
});

// Обработка кнопки "Начать работу"
bot.hears("Начать работу", (ctx) => {
  ctx.reply("Работаем 💪");
});

// Запуск бота
bot.launch().then(() => console.log("Bot started"));
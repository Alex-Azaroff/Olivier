require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");

// Подключаем Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Подключаем бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// /start — сохраняем пользователя
bot.start(async (ctx) => {
  const user = ctx.from;

  try {
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
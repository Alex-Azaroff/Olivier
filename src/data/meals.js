/*
  Категории для готовых блюд (пресеты) — для правок без изменения UI-кода:
  src/data/meals.json

  Поля:
  - version — номер схемы (при необходимости миграций).
  - categories — массив строк с названиями категорий.

  После правок перезапустите dev или выполните npm run build.
*/

import mealsCatalog from './meals.json';

const raw = Array.isArray(mealsCatalog.categories) ? mealsCatalog.categories : [];

// Поддержка формата:
// 1) { name, defaultDays }
// 2) "Название" (для обратной совместимости — defaultDays = 1)
const MEAL_DEFAULT_DAYS_FALLBACK = 1;

const normalized = raw
  .map((c) => {
    if (!c) return null;
    if (typeof c === 'string') return { name: c, defaultDays: MEAL_DEFAULT_DAYS_FALLBACK };
    if (typeof c === 'object' && typeof c.name === 'string') {
      const days = Number(c.defaultDays);
      return { name: c.name, defaultDays: isFinite(days) ? days : MEAL_DEFAULT_DAYS_FALLBACK };
    }
    return null;
  })
  .filter(Boolean);

export const MEAL_CATEGORIES = normalized.map((c) => c.name);

export const MEAL_DEFAULT_DAYS_BY_CATEGORY = normalized.reduce((acc, c) => {
  acc[c.name] = c.defaultDays;
  return acc;
}, {});


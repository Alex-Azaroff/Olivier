/*
  Каталог рецептов для правок без изменения кода приложения: src/data/recipes.json
  (поле "recipes" — массив объектов; после правок пересоберите/перезапустите dev).

  Про «таблицу»: одна Excel-строка на рецепт не вмещает списки ингредиентов и шагов без
  JSON в ячейке или отдельных листов. JSON — удобный компромисс; при желании можно
  вести Google Таблицу и скриптом выгружать в recipes.json.

  Соотношения единиц (конвертация в UI — UNIT_MAP в component.jsx):
  Масса: 1 кг = 1000 г; 1 г = 1000 мг; и т.д.
  Объём: 1 л = 1000 мл; 1 мл = 1 см³.
  Кухня: ч.л. 5 мл; ст.л. 15 мл; стакан 250 мл (ориентиры массы — в комментариях к UNIT_MAP).

  Нормализация ингредиентов (при загрузке каталога):
  - Литр/кг с amount < 1 → мл/г (*1000).
  - мл/г с amount >= 1000 → л/кг (/1000).
  - «мл» не путаем с «л» (measureKind).
*/

import recipeCatalog from './recipes.json';

function roundIfNeeded(n) {
  if (Number.isInteger(n)) return n;
  return parseFloat(n.toFixed(2));
}

/** Без двусмысленности «мл» vs «л», «мг» vs «г» */
function measureKind(measure) {
  const raw = (measure || '').trim().toLowerCase();
  const x = raw.replace(/\.$/, '').replace(/\s+/g, '');

  if (x === 'мл' || x === 'ml') return 'ml';
  if (x === 'л' || x === 'l') return 'l';
  if (x === 'мг' || x === 'mg') return 'mg';
  if (x === 'кг' || x === 'kg') return 'kg';
  if (x === 'г' || x === 'g') return 'g';

  return 'other';
}

function normalizeIngredient(ing) {
  let { amount, measure } = { ...ing };

  if (measureKind(measure) === 'l' && amount > 0 && amount < 1) {
    amount = Math.round(amount * 1000);
    measure = 'мл.';
  }

  if (measureKind(measure) === 'ml' && amount >= 1000) {
    amount = roundIfNeeded(amount / 1000);
    measure = 'л.';
  }

  if (measureKind(measure) === 'kg' && amount > 0 && amount < 1) {
    amount = Math.round(amount * 1000);
    measure = 'г.';
  }

  if (measureKind(measure) === 'g' && amount >= 1000) {
    amount = roundIfNeeded(amount / 1000);
    measure = 'кг.';
  }

  return { ...ing, amount, measure };
}

function normalizeIngredientsList(list) {
  if (!Array.isArray(list)) return list;
  return list.map(normalizeIngredient);
}

const RAW_RECIPES = Array.isArray(recipeCatalog.recipes) ? recipeCatalog.recipes : [];

export const RECIPES_DB = RAW_RECIPES.map((r) => ({
  ...r,
  ingredients: normalizeIngredientsList(r.ingredients)
}));

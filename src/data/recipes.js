/*
  Normalization rules for ingredient amounts to avoid leading-zero decimals:
  - If measure is liters ('л.' or 'л') and amount < 1 => convert to milliliters ('мл.') by *1000.
  - If measure is kilograms ('кг.' or 'кг') and amount < 1 => convert to grams ('г.') by *1000.
  - If after conversion ml or g >= 1000 => convert back to liters/kg (divide by 1000) and keep up to 2 decimals.
  - Other measures are left unchanged.
*/

const RAW_RECIPES = [
  {
    id: 1,
    name: 'Омлет с овощами',
    difficulty: 'легкий',
    time: 15,
    ingredients: [
      { name: 'Яйца', amount: 3, measure: 'шт.' },
      { name: 'Молоко', amount: 0.1, measure: 'л.' },
      { name: 'Помидоры', amount: 0.2, measure: 'кг.' },
      { name: 'Лук', amount: 0.1, measure: 'кг.' }
    ],
    steps: ['Взбить яйца с молоком', 'Нарезать овощи', 'Жарить на сковороде 5 минут'],
    image: '/assets/omelet.jpeg'
  },
  {
    id: 2,
    name: 'Рисовая каша',
    difficulty: 'легкий',
    time: 20,
    ingredients: [
      { name: 'Рис', amount: 200, measure: 'г.' },
      { name: 'Молоко', amount: 0.5, measure: 'л.' },
      { name: 'Сахар', amount: 50, measure: 'г.' }
    ],
    steps: ['Промыть рис', 'Варить в молоке 15 минут', 'Добавить сахар'],
    image: '/assets/rice-porridge.jpeg'
  },
  {
    id: 3,
    name: 'Салат с огурцами',
    difficulty: 'легкий',
    time: 10,
    ingredients: [
      { name: 'Огурцы', amount: 0.5, measure: 'кг.' },
      { name: 'Помидоры', amount: 0.3, measure: 'кг.' },
      { name: 'Лук', amount: 0.1, measure: 'кг.' }
    ],
    steps: ['Нарезать овощи', 'Перемешать', 'Посолить по вкусу'],
    description: 'Хорошая альтернатива классическому греческому салату.',
    image: '/assets/vegetable-salad.jpeg'
  }
];

function roundIfNeeded(n) {
  if (Number.isInteger(n)) return n;
  // Keep up to 2 decimal places, but trim trailing zeros
  return parseFloat(n.toFixed(2));
}

function normalizeIngredient(ing) {
  let { name, amount, measure } = { ...ing };
  const m = (measure || '').toLowerCase();

  // handle liters
  if (m.includes('л')) {
    // convert fractions of liters to ml
    if (amount > 0 && amount < 1) {
      amount = Math.round(amount * 1000);
      measure = 'мл.';
    }
    // if currently ml and >= 1000, convert to liters
    if (measure && measure.toLowerCase().includes('мл')) {
      if (amount >= 1000) {
        amount = roundIfNeeded(amount / 1000);
        measure = 'л.';
      }
    }
  }

  // handle kilograms
  if (m.includes('кг')) {
    if (amount > 0 && amount < 1) {
      amount = Math.round(amount * 1000);
      measure = 'г.';
    }
    if (measure && measure.toLowerCase().includes('г')) {
      if (amount >= 1000) {
        amount = roundIfNeeded(amount / 1000);
        measure = 'кг.';
      }
    }
  }

  return { ...ing, amount, measure };
}

function normalizeIngredientsList(list) {
  if (!Array.isArray(list)) return list;
  return list.map(normalizeIngredient);
}

export const RECIPES_DB = RAW_RECIPES.map(r => ({
  ...r,
  ingredients: normalizeIngredientsList(r.ingredients)
}));



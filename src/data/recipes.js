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
    steps: [
      { text: 'Взбить яйца с молоком', image: '' },
      { text: 'Нарезать овощи', image: '' },
      { text: 'Жарить на сковороде 5 минут', image: '' }
    ],
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
    steps: [
      { text: 'Промыть рис', image: '' },
      { text: 'Варить в молоке 15 минут', image: '' },
      { text: 'Добавить сахар', image: '' }
    ],
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
    steps: [
      { text: 'Нарезать овощи', image: '' },
      { text: 'Перемешать', image: '' },
      { text: 'Посолить по вкусу', image: '' }
    ],
    description: 'Хорошая альтернатива классическому греческому салату.',
    image: '/assets/vegetable-salad.jpeg'
  }
];

// Лазанья: добавляем рецепт с шагами и путями к изображениям в подпапке public/assets/recipes/lasagna
RAW_RECIPES.push({
  id: 4,
  name: 'Лазанья болоньезе (ВкусВилл)',
  difficulty: 'средний',
  time: 75,
  ingredients: [
    { name: 'Листы для лазаньи', amount: 10, measure: 'шт.' },
    { name: 'Фарш из говядины и свинины', amount: 0.36, measure: 'кг.' },
    { name: 'Томаты в собственном соку', amount: 0.75, measure: 'кг.' },
    { name: 'Молоко 3.2%', amount: 0.8, measure: 'л.' },
    { name: 'Сыр Пармезан (крошка)', amount: 0.1, measure: 'кг.' },
    { name: 'Масло сливочное 82.5%', amount: 0.05, measure: 'кг.' },
    { name: 'Мука пшеничная', amount: 0.06, measure: 'кг.' },
    { name: 'Лук репчатый', amount: 1, measure: 'шт.' },
    { name: 'Чеснок', amount: 0.015, measure: 'кг.' },
    { name: 'Томатная паста', amount: 0.06, measure: 'кг.' },
    { name: 'Масло оливковое', amount: 0.015, measure: 'л.' },
    { name: 'Специи (базилик, орегано, мускатный орех)', amount: 0.005, measure: 'кг.' }
  ],
  steps: [
    { 
      text: 'Мелко нарезать лук и чеснок, обжарить на оливковом масле до прозрачности.', 
      image: '/assets/recipes/lasagna/step1.jpeg' 
    },
    { 
      text: 'Добавить фарш к овощам и обжаривать до золотистого цвета, разбивая комочки.', 
      image: '/assets/recipes/lasagna/step2.jpeg' 
    },
    { 
      text: 'Влить томаты в собственном соку и добавить томатную пасту. Посолить, добавить сахар и сухие травы. Тушить 30 минут, в конце добавить свежую зелень.', 
      image: '/assets/recipes/lasagna/step3.jpeg' 
    },
    { 
      text: 'Для соуса бешамель обжарить муку в кастрюле до орехового аромата, добавить сливочное масло и перемешать.', 
      image: '/assets/recipes/lasagna/step4.jpeg' 
    },
    { 
      text: 'Постепенно вливать теплое молоко в мучную смесь, постоянно помешивая венчиком.', 
      image: '/assets/recipes/lasagna/step5.jpeg' 
    },
    { 
      text: 'Добавить соль и мускатный орех, варить соус до загустения, затем снять с огня.', 
      image: '/assets/recipes/lasagna/step6.jpeg' 
    },
    { 
      text: 'Смазать дно формы соусом бешамель или маслом.', 
      image: '/assets/recipes/lasagna/step7.jpeg' 
    },
    { 
      text: 'Выложить слоями: листы лазаньи, мясной соус болоньезе, затем соус бешамель.', 
      image: '/assets/recipes/lasagna/step8.jpeg' 
    },
    { 
      text: 'Повторить слои несколько раз. Верхний слой залить остатками бешамеля и густо посыпать тертым пармезаном.', 
      image: '/assets/recipes/lasagna/step9.jpeg' 
    },
    { 
      text: 'Запекать в разогретой до 180°C духовке в течение 20–25 минут.', 
      image: '/assets/recipes/lasagna/step10.jpeg' 
    }
  ],
  image: '/assets/recipes/vkusvill_lasagna.jpeg'
});

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



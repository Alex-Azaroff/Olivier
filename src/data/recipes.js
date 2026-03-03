export const RECIPES_DB = [
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


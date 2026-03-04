import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Home, Book, ShoppingCart, User, Plus, Edit3, Trash2, Calendar, Check, X, FileText } from 'lucide-react';
import { supabase } from './src/supabaseClient';
import { RECIPES_DB } from './src/data/recipes';

// Sample product database (1000 products simulated with 50 for demo)
const PRODUCTS_DB = [
// 🥦 Овощи
{ name: 'Картофель', category: '🥦 Овощи', measure: 'кг.', shelfLife: 150 },
{ name: 'Морковь', category: '🥦 Овощи', measure: 'кг.', shelfLife: 30 },
{ name: 'Лук репчатый', category: '🥦 Овощи', measure: 'кг.', shelfLife: 90 },
{ name: 'Капуста белокочанная', category: '🥦 Овощи', measure: 'кг.', shelfLife: 40 },
{ name: 'Огурцы', category: '🥦 Овощи', measure: 'кг.', shelfLife: 7 },
{ name: 'Томаты', category: '🥦 Овощи', measure: 'кг.', shelfLife: 7 },
{ name: 'Перец болгарский', category: '🥦 Овощи', measure: 'кг.', shelfLife: 10 },
{ name: 'Кабачки', category: '🥦 Овощи', measure: 'кг.', shelfLife: 14 },
{ name: 'Чеснок', category: '🥦 Овощи', measure: 'кг.', shelfLife: 180 },
{ name: 'Баклажаны', category: '🥦 Овощи', measure: 'кг.', shelfLife: 10 },

// 🍎 Фрукты
{ name: 'Яблоки', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 30 },
{ name: 'Бананы', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 5 },
{ name: 'Груши', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 14 },
{ name: 'Апельсины', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 21 },
{ name: 'Лимоны', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 30 },
{ name: 'Грейпфруты', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 21 },
{ name: 'Виноград', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 7 },
{ name: 'Киви', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 15 },
{ name: 'Сливы', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 7 },
{ name: 'Персики', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 5 },

// 🍍 Экзотика
{ name: 'Манго', category: '🍍 Экзотика', measure: 'шт.', shelfLife: 7 },
{ name: 'Авокадо', category: '🍍 Экзотика', measure: 'шт.', shelfLife: 5 },
{ name: 'Ананас', category: '🍍 Экзотика', measure: 'шт.', shelfLife: 7 },
{ name: 'Папайя', category: '🍍 Экзотика', measure: 'шт.', shelfLife: 5 },
{ name: 'Маракуйя', category: '🍍 Экзотика', measure: 'шт.', shelfLife: 10 },
{ name: 'Кокос', category: '🍍 Экзотика', measure: 'шт.', shelfLife: 30 },
{ name: 'Помело', category: '🍍 Экзотика', measure: 'шт.', shelfLife: 20 },
{ name: 'Фейхоа', category: '🍍 Экзотика', measure: 'кг.', shelfLife: 7 },
{ name: 'Питахайя', category: '🍍 Экзотика', measure: 'шт.', shelfLife: 5 },
{ name: 'Личи', category: '🍍 Экзотика', measure: 'кг.', shelfLife: 7 },

// 🍓 Ягоды
{ name: 'Клубника', category: '🍓 Ягоды', measure: 'г.', shelfLife: 3 },
{ name: 'Голубика', category: '🍓 Ягоды', measure: 'г.', shelfLife: 7 },
{ name: 'Малина', category: '🍓 Ягоды', measure: 'г.', shelfLife: 2 },
{ name: 'Ежевика', category: '🍓 Ягоды', measure: 'г.', shelfLife: 3 },
{ name: 'Вишня', category: '🍓 Ягоды', measure: 'кг.', shelfLife: 5 },
{ name: 'Черешня', category: '🍓 Ягоды', measure: 'кг.', shelfLife: 5 },
{ name: 'Клюква', category: '🍓 Ягоды', measure: 'кг.', shelfLife: 30 },
{ name: 'Брусника', category: '🍓 Ягоды', measure: 'кг.', shelfLife: 30 },
{ name: 'Смородина', category: '🍓 Ягоды', measure: 'кг.', shelfLife: 7 },
{ name: 'Крыжовник', category: '🍓 Ягоды', measure: 'кг.', shelfLife: 7 },

// 🌿 Зелень
{ name: 'Укроп', category: '🌿 Зелень', measure: 'г.', shelfLife: 5 },
{ name: 'Петрушка', category: '🌿 Зелень', measure: 'г.', shelfLife: 5 },
{ name: 'Кинза', category: '🌿 Зелень', measure: 'г.', shelfLife: 4 },
{ name: 'Салат Айсберг', category: '🌿 Зелень', measure: 'шт.', shelfLife: 7 },
{ name: 'Руккола', category: '🌿 Зелень', measure: 'г.', shelfLife: 4 },
{ name: 'Шпинат', category: '🌿 Зелень', measure: 'г.', shelfLife: 4 },
{ name: 'Зеленый лук', category: '🌿 Зелень', measure: 'г.', shelfLife: 5 },
{ name: 'Базилик', category: '🌿 Зелень', measure: 'г.', shelfLife: 3 },
{ name: 'Мята', category: '🌿 Зелень', measure: 'г.', shelfLife: 5 },
{ name: 'Сельдерей (стебли)', category: '🌿 Зелень', measure: 'уп.', shelfLife: 14 },

// 🍄 Грибы
{ name: 'Шампиньоны', category: '🍄 Грибы', measure: 'кг.', shelfLife: 7 },
{ name: 'Вешенки', category: '🍄 Грибы', measure: 'кг.', shelfLife: 5 },
{ name: 'Шиитаке', category: '🍄 Грибы', measure: 'г.', shelfLife: 7 },
{ name: 'Эринги', category: '🍄 Грибы', measure: 'кг.', shelfLife: 10 },
{ name: 'Портобелло', category: '🍄 Грибы', measure: 'шт.', shelfLife: 5 },
{ name: 'Опята', category: '🍄 Грибы', measure: 'кг.', shelfLife: 5 },
{ name: 'Лисички', category: '🍄 Грибы', measure: 'кг.', shelfLife: 7 },
{ name: 'Белые грибы', category: '🍄 Грибы', measure: 'кг.', shelfLife: 5 },
{ name: 'Грибное ассорти', category: '🍄 Грибы', measure: 'уп.', shelfLife: 5 },
{ name: 'Трюфели (свежие)', category: '🍄 Грибы', measure: 'г.', shelfLife: 7 },

// 🥛 Молочные
{ name: 'Молоко пастеризованное', category: '🥛 Молочные', measure: 'л.', shelfLife: 7 },
{ name: 'Молоко ультрапаст.', category: '🥛 Молочные', measure: 'л.', shelfLife: 180 },
{ name: 'Сливки 10%', category: '🥛 Молочные', measure: 'л.', shelfLife: 7 },
{ name: 'Сливки 33%', category: '🥛 Молочные', measure: 'л.', shelfLife: 10 },
{ name: 'Топленое молоко', category: '🥛 Молочные', measure: 'л.', shelfLife: 10 },
{ name: 'Сгущенное молоко', category: '🥛 Молочные', measure: 'банка', shelfLife: 365 },
{ name: 'Сухое молоко', category: '🥛 Молочные', measure: 'г.', shelfLife: 365 },
{ name: 'Молоко безлактозное', category: '🥛 Молочные', measure: 'л.', shelfLife: 30 },
{ name: 'Сливки порционные', category: '🥛 Молочные', measure: 'уп.', shelfLife: 120 },
{ name: 'Козье молоко', category: '🥛 Молочные', measure: 'л.', shelfLife: 5 },

// 🥛 Кисломолочные
{ name: 'Кефир', category: '🥛 Кисломолочные', measure: 'л.', shelfLife: 10 },
{ name: 'Ряженка', category: '🥛 Кисломолочные', measure: 'л.', shelfLife: 10 },
{ name: 'Питьевой йогурт', category: '🥛 Кисломолочные', measure: 'шт.', shelfLife: 21 },
{ name: 'Ацидофилин', category: '🥛 Кисломолочные', measure: 'л.', shelfLife: 7 },
{ name: 'Айран', category: '🥛 Кисломолочные', measure: 'л.', shelfLife: 14 },
{ name: 'Тан', category: '🥛 Кисломолочные', measure: 'л.', shelfLife: 14 },
{ name: 'Простокваша', category: '🥛 Кисломолочные', measure: 'л.', shelfLife: 7 },
{ name: 'Кумыс', category: '🥛 Кисломолочные', measure: 'л.', shelfLife: 5 },
{ name: 'Биолакт', category: '🥛 Кисломолочные', measure: 'шт.', shelfLife: 10 },
{ name: 'Варенец', category: '🥛 Кисломолочные', measure: 'л.', shelfLife: 10 },

// 🧀 Творог и сырки
{ name: 'Творог рассыпчатый', category: '🧀 Творог', measure: 'г.', shelfLife: 5 },
{ name: 'Творог в пачках', category: '🧀 Творог', measure: 'шт.', shelfLife: 7 },
{ name: 'Мягкий творог', category: '🧀 Творог', measure: 'шт.', shelfLife: 14 },
{ name: 'Глазированные сырки', category: '🧀 Творог', measure: 'шт.', shelfLife: 15 },
{ name: 'Творожная масса', category: '🧀 Творог', measure: 'г.', shelfLife: 5 },
{ name: 'Зерненый творог', category: '🧀 Творог', measure: 'г.', shelfLife: 14 },
{ name: 'Творожный сыр', category: '🧀 Творог', measure: 'г.', shelfLife: 30 },
{ name: 'Детские творожки', category: '🧀 Творог', measure: 'шт.', shelfLife: 14 },
{ name: 'Запеканка (готовая)', category: '🧀 Творог', measure: 'кг.', shelfLife: 3 },
{ name: 'Сырники (п/ф)', category: '🧀 Творог', measure: 'уп.', shelfLife: 30 },

// 🥛 Сметана
{ name: 'Сметана 10%', category: '🥛 Сметана', measure: 'г.', shelfLife: 15 },
{ name: 'Сметана 15%', category: '🥛 Сметана', measure: 'г.', shelfLife: 15 },
{ name: 'Сметана 20%', category: '🥛 Сметана', measure: 'г.', shelfLife: 15 },
{ name: 'Сметана 30%', category: '🥛 Сметана', measure: 'г.', shelfLife: 14 },
{ name: 'Крем-фреш', category: '🥛 Сметана', measure: 'г.', shelfLife: 10 },
{ name: 'Термостатная сметана', category: '🥛 Сметана', measure: 'г.', shelfLife: 20 },
{ name: 'Сметанный продукт', category: '🥛 Сметана', measure: 'г.', shelfLife: 30 },
{ name: 'Сметана из козьего молока', category: '🥛 Сметана', measure: 'г.', shelfLife: 7 },
{ name: 'Сметана с зеленью', category: '🥛 Сметана', measure: 'г.', shelfLife: 10 },
{ name: 'Сметана деревенская', category: '🥛 Сметана', measure: 'г.', shelfLife: 5 },

// 🧈 Масло и маргарин
{ name: 'Масло сливочное 82.5%', category: '🧈 Масло', measure: 'шт.', shelfLife: 35 },
{ name: 'Масло сливочное 72.5%', category: '🧈 Масло', measure: 'шт.', shelfLife: 35 },
{ name: 'Масло гхи', category: '🧈 Масло', measure: 'г.', shelfLife: 365 },
{ name: 'Маргарин для выпечки', category: '🧈 Масло', measure: 'шт.', shelfLife: 90 },
{ name: 'Спред', category: '🧈 Масло', measure: 'шт.', shelfLife: 60 },
{ name: 'Масло соленое', category: '🧈 Масло', measure: 'шт.', shelfLife: 45 },
{ name: 'Масло шоколадное', category: '🧈 Масло', measure: 'шт.', shelfLife: 20 },
{ name: 'Масло чесночное', category: '🧈 Масло', measure: 'г.', shelfLife: 15 },
{ name: 'Сливочно-раст. смесь', category: '🧈 Масло', measure: 'шт.', shelfLife: 60 },
{ name: 'Мягкое масло', category: '🧈 Масло', measure: 'г.', shelfLife: 45 },

// 🧀 Твердые сыры
{ name: 'Пармезан', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 120 },
{ name: 'Гауда', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 60 },
{ name: 'Эдам', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 60 },
{ name: 'Маасдам', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 45 },
{ name: 'Чеддер', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 90 },
{ name: 'Российский сыр', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 45 },
{ name: 'Тильзитер', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 45 },
{ name: 'Швейцарский сыр', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 90 },
{ name: 'Сыр в нарезке', category: '🧀 Сыры твердые', measure: 'уп.', shelfLife: 30 },
{ name: 'Козий твердый сыр', category: '🧀 Сыры твердые', measure: 'кг.', shelfLife: 60 },

// 🧀 Мягкие сыры
{ name: 'Моцарелла', category: '🧀 Сыры мягкие', measure: 'уп.', shelfLife: 15 },
{ name: 'Фета', category: '🧀 Сыры мягкие', measure: 'г.', shelfLife: 30 },
{ name: 'Брынза', category: '🧀 Сыры мягкие', measure: 'кг.', shelfLife: 15 },
{ name: 'Сулугуни', category: '🧀 Сыры мягкие', measure: 'кг.', shelfLife: 15 },
{ name: 'Камамбер', category: '🧀 Сыры мягкие', measure: 'шт.', shelfLife: 30 },
{ name: 'Бри', category: '🧀 Сыры мягкие', measure: 'шт.', shelfLife: 30 },
{ name: 'Адыгейский сыр', category: '🧀 Сыры мягкие', measure: 'кг.', shelfLife: 5 },
{ name: 'Дорблю', category: '🧀 Сыры мягкие', measure: 'г.', shelfLife: 30 },
{ name: 'Рикотта', category: '🧀 Сыры мягкие', measure: 'г.', shelfLife: 10 },
{ name: 'Маскарпоне', category: '🧀 Сыры мягкие', measure: 'г.', shelfLife: 15 },

// 🥚 Яйца
{ name: 'Яйца С0', category: '🥚 Яйца', measure: 'дес.', shelfLife: 25 },
{ name: 'Яйца С1', category: '🥚 Яйца', measure: 'дес.', shelfLife: 25 },
{ name: 'Перепелиные яйца', category: '🥚 Яйца', measure: 'уп.', shelfLife: 40 },
{ name: 'Яйца диетические', category: '🥚 Яйца', measure: 'дес.', shelfLife: 7 },
{ name: 'Яйца с селеном', category: '🥚 Яйца', measure: 'дес.', shelfLife: 25 },
{ name: 'Деревенские яйца', category: '🥚 Яйца', measure: 'дес.', shelfLife: 25 },
{ name: 'Меланж яичный', category: '🥚 Яйца', measure: 'л.', shelfLife: 3 },
{ name: 'Белок в бутылке', category: '🥚 Яйца', measure: 'шт.', shelfLife: 5 },
{ name: 'Желток в бутылке', category: '🥚 Яйца', measure: 'шт.', shelfLife: 5 },
{ name: 'Вареные яйца', category: '🥚 Яйца', measure: 'уп.', shelfLife: 10 },

// 🥩 Мясо
{ name: 'Говядина (вырезка)', category: '🥩 Мясо', measure: 'кг.', shelfLife: 4 },
{ name: 'Свинина (шея)', category: '🥩 Мясо', measure: 'кг.', shelfLife: 4 },
{ name: 'Баранина', category: '🥩 Мясо', measure: 'кг.', shelfLife: 3 },
{ name: 'Телятина', category: '🥩 Мясо', measure: 'кг.', shelfLife: 3 },
{ name: 'Мясной фарш', category: '🥩 Мясо', measure: 'кг.', shelfLife: 2 },
{ name: 'Ребра свиные', category: '🥩 Мясо', measure: 'кг.', shelfLife: 4 },
{ name: 'Антрекот говяжий', category: '🥩 Мясо', measure: 'кг.', shelfLife: 4 },
{ name: 'Субпродукты (печень)', category: '🥩 Мясо', measure: 'кг.', shelfLife: 2 },
{ name: 'Мясо для гуляша', category: '🥩 Мясо', measure: 'кг.', shelfLife: 3 },
{ name: 'Стейк в вакууме', category: '🥩 Мясо', measure: 'шт.', shelfLife: 21 },

// 🍗 Птица
{ name: 'Куриное филе', category: '🍗 Птица', measure: 'кг.', shelfLife: 4 },
{ name: 'Бедра куриные', category: '🍗 Птица', measure: 'кг.', shelfLife: 4 },
{ name: 'Крылья куриные', category: '🍗 Птица', measure: 'кг.', shelfLife: 4 },
{ name: 'Тушка цыпленка', category: '🍗 Птица', measure: 'кг.', shelfLife: 5 },
{ name: 'Филе индейки', category: '🍗 Птица', measure: 'кг.', shelfLife: 4 },
{ name: 'Голень индейки', category: '🍗 Птица', measure: 'кг.', shelfLife: 4 },
{ name: 'Утиная грудка', category: '🍗 Птица', measure: 'кг.', shelfLife: 3 },
{ name: 'Перепел (тушка)', category: '🍗 Птица', measure: 'шт.', shelfLife: 3 },
{ name: 'Фарш из индейки', category: '🍗 Птица', measure: 'кг.', shelfLife: 2 },
{ name: 'Куриная печень', category: '🍗 Птица', measure: 'кг.', shelfLife: 2 },

// 🥟 Полуфабрикаты
{ name: 'Котлеты зам.', category: '🥟 Полуфабрикаты', measure: 'уп.', shelfLife: 90 },
{ name: 'Пельмени', category: '🥟 Полуфабрикаты', measure: 'кг.', shelfLife: 180 },
{ name: 'Хинкали', category: '🥟 Полуфабрикаты', measure: 'кг.', shelfLife: 180 },
{ name: 'Блинчики с мясом', category: '🥟 Полуфабрикаты', measure: 'уп.', shelfLife: 90 },
{ name: 'Наггетсы', category: '🥟 Полуфабрикаты', measure: 'уп.', shelfLife: 120 },
{ name: 'Вареники', category: '🥟 Полуфабрикаты', measure: 'кг.', shelfLife: 180 },
{ name: 'Чебуреки', category: '🥟 Полуфабрикаты', measure: 'шт.', shelfLife: 90 },
{ name: 'Фрикадельки', category: '🥟 Полуфабрикаты', measure: 'уп.', shelfLife: 90 },
{ name: 'Мясные ежики', category: '🥟 Полуфабрикаты', measure: 'уп.', shelfLife: 90 },
{ name: 'Голубцы', category: '🥟 Полуфабрикаты', measure: 'кг.', shelfLife: 90 },

// 🌭 Колбасы
{ name: 'Сосиски молочные', category: '🌭 Колбасы', measure: 'кг.', shelfLife: 20 },
{ name: 'Сардельки', category: '🌭 Колбасы', measure: 'кг.', shelfLife: 15 },
{ name: 'Докторская колбаса', category: '🌭 Колбасы', measure: 'кг.', shelfLife: 20 },
{ name: 'Салями', category: '🌭 Колбасы', measure: 'кг.', shelfLife: 60 },
{ name: 'Сервелат', category: '🌭 Колбасы', measure: 'кг.', shelfLife: 45 },
{ name: 'Ветчина', category: '🌭 Колбасы', measure: 'кг.', shelfLife: 25 },
{ name: 'Краковская колбаса', category: '🌭 Колбасы', measure: 'шт.', shelfLife: 30 },
{ name: 'Колбаски для гриля', category: '🌭 Колбасы', measure: 'уп.', shelfLife: 10 },
{ name: 'Шпикачки', category: '🌭 Колбасы', measure: 'кг.', shelfLife: 15 },
{ name: 'Паштет мясной', category: '🌭 Колбасы', measure: 'шт.', shelfLife: 30 },

// 🥓 Деликатесы
{ name: 'Бекон с/к', category: '🥓 Деликатесы', measure: 'уп.', shelfLife: 60 },
{ name: 'Буженина', category: '🥓 Деликатесы', measure: 'кг.', shelfLife: 15 },
{ name: 'Карбонад', category: '🥓 Деликатесы', measure: 'кг.', shelfLife: 20 },
{ name: 'Хамон', category: '🥓 Деликатесы', measure: 'г.', shelfLife: 120 },
{ name: 'Прошутто', category: '🥓 Деликатесы', measure: 'г.', shelfLife: 90 },
{ name: 'Балык мясной', category: '🥓 Деликатесы', measure: 'кг.', shelfLife: 30 },
{ name: 'Грудинка копченая', category: '🥓 Деликатесы', measure: 'кг.', shelfLife: 30 },
{ name: 'Солонина', category: '🥓 Деликатесы', measure: 'кг.', shelfLife: 45 },
{ name: 'Зельц', category: '🥓 Деликатесы', measure: 'кг.', shelfLife: 7 },
{ name: 'Бастурма', category: '🥓 Деликатесы', measure: 'г.', shelfLife: 180 },

// 🐟 Рыба свежая
{ name: 'Семга (филе)', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 3 },
{ name: 'Дорадо', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 3 },
{ name: 'Сибас', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 3 },
{ name: 'Форель речная', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 3 },
{ name: 'Треска', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 2 },
{ name: 'Окунь речной', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 2 },
{ name: 'Карп', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 2 },
{ name: 'Щука', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 2 },
{ name: 'Стейк лосося', category: '🐟 Рыба свежая', measure: 'шт.', shelfLife: 3 },
{ name: 'Филе минтая охл.', category: '🐟 Рыба свежая', measure: 'кг.', shelfLife: 2 },

// 🧊 Рыба заморозка
{ name: 'Горбуша зам.', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 210 },
{ name: 'Скумбрия зам.', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 180 },
{ name: 'Хек', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 240 },
{ name: 'Пангасиус', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 180 },
{ name: 'Тилапия', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 180 },
{ name: 'Сельдь зам.', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 180 },
{ name: 'Камбала', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 180 },
{ name: 'Рыбные палочки', category: '🧊 Рыба заморозка', measure: 'уп.', shelfLife: 120 },
{ name: 'Стейки зубатки', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 150 },
{ name: 'Мойва', category: '🧊 Рыба заморозка', measure: 'кг.', shelfLife: 180 },

// 🦐 Морепродукты
{ name: 'Креветки зам.', category: '🦐 Морепродукты', measure: 'кг.', shelfLife: 270 },
{ name: 'Кальмары', category: '🦐 Морепродукты', measure: 'кг.', shelfLife: 180 },
{ name: 'Мидии в раковинах', category: '🦐 Морепродукты', measure: 'кг.', shelfLife: 180 },
{ name: 'Морской коктейль', category: '🦐 Морепродукты', measure: 'кг.', shelfLife: 180 },
{ name: 'Осьминоги', category: '🦐 Морепродукты', measure: 'кг.', shelfLife: 180 },
{ name: 'Гребешки', category: '🦐 Морепродукты', measure: 'г.', shelfLife: 180 },
{ name: 'Крабы зам.', category: '🦐 Морепродукты', measure: 'кг.', shelfLife: 180 },
{ name: 'Лангустины', category: '🦐 Морепродукты', measure: 'кг.', shelfLife: 270 },
{ name: 'Крабовые палочки', category: '🦐 Морепродукты', measure: 'уп.', shelfLife: 90 },
{ name: 'Морская капуста', category: '🦐 Морепродукты', measure: 'г.', shelfLife: 30 },

// 🍣 Рыба соленая
{ name: 'Слабосоленая семга', category: '🍣 Рыба соленая', measure: 'г.', shelfLife: 45 },
{ name: 'Сельдь в масле', category: '🍣 Рыба соленая', measure: 'шт.', shelfLife: 60 },
{ name: 'Скумбрия х/к', category: '🍣 Рыба соленая', measure: 'кг.', shelfLife: 30 },
{ name: 'Скумбрия г/к', category: '🍣 Рыба соленая', measure: 'кг.', shelfLife: 5 },
{ name: 'Форель х/к', category: '🍣 Рыба соленая', measure: 'г.', shelfLife: 45 },
{ name: 'Килька пряная', category: '🍣 Рыба соленая', measure: 'г.', shelfLife: 30 },
{ name: 'Балык рыбы', category: '🍣 Рыба соленая', measure: 'г.', shelfLife: 30 },
{ name: 'Шпроты (пресервы)', category: '🍣 Рыба соленая', measure: 'шт.', shelfLife: 60 },
{ name: 'Анчоусы', category: '🍣 Рыба соленая', measure: 'банка', shelfLife: 90 },
{ name: 'Вяленая вобла', category: '🍣 Рыба соленая', measure: 'кг.', shelfLife: 180 },

// 🥫 Консервы рыбные
{ name: 'Тунец в с/с', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 1095 },
{ name: 'Сайра в масле', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 730 },
{ name: 'Горбуша натур.', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 730 },
{ name: 'Печень трески', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 730 },
{ name: 'Шпроты в масле', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 730 },
{ name: 'Сардины', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 730 },
{ name: 'Бычки в томате', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 730 },
{ name: 'Килька в томате', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 540 },
{ name: 'Морская капуста конс.', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 730 },
{ name: 'Крабовое мясо конс.', category: '🥫 Консервы рыбные', measure: 'банка', shelfLife: 730 },

// 🖤 Икра
{ name: 'Икра красная', category: '🖤 Икра', measure: 'г.', shelfLife: 180 },
{ name: 'Икра черная', category: '🖤 Икра', measure: 'г.', shelfLife: 180 },
{ name: 'Икра минтая', category: '🖤 Икра', measure: 'г.', shelfLife: 180 },
{ name: 'Икра мойвы в соусе', category: '🖤 Икра', measure: 'шт.', shelfLife: 120 },
{ name: 'Икра щучья', category: '🖤 Икра', measure: 'г.', shelfLife: 120 },
{ name: 'Икра сазана', category: '🖤 Икра', measure: 'г.', shelfLife: 120 },
{ name: 'Икра сельди', category: '🖤 Икра', measure: 'г.', shelfLife: 120 },
{ name: 'Имитированная икра', category: '🖤 Икра', measure: 'г.', shelfLife: 180 },
{ name: 'Икра трески', category: '🖤 Икра', measure: 'г.', shelfLife: 180 },
{ name: 'Тарамасалата', category: '🖤 Икра', measure: 'г.', shelfLife: 30 },

// 🌾 Крупы
{ name: 'Рис длиннозерный', category: '🌾 Крупы', measure: 'кг.', shelfLife: 540 },
{ name: 'Гречневая крупа', category: '🌾 Крупы', measure: 'кг.', shelfLife: 600 },
{ name: 'Овсяные хлопья', category: '🌾 Крупы', measure: 'кг.', shelfLife: 365 },
{ name: 'Пшено', category: '🌾 Крупы', measure: 'кг.', shelfLife: 270 },
{ name: 'Булгур', category: '🌾 Крупы', measure: 'кг.', shelfLife: 540 },
{ name: 'Киноа', category: '🌾 Крупы', measure: 'кг.', shelfLife: 365 },
{ name: 'Кускус', category: '🌾 Крупы', measure: 'кг.', shelfLife: 540 },
{ name: 'Манная крупа', category: '🌾 Крупы', measure: 'кг.', shelfLife: 300 },
{ name: 'Перловая крупа', category: '🌾 Крупы', measure: 'кг.', shelfLife: 540 },
{ name: 'Ячневая крупа', category: '🌾 Крупы', measure: 'кг.', shelfLife: 450 },

// 🍝 Макароны
{ name: 'Спагетти', category: '🍝 Макароны', measure: 'кг.', shelfLife: 730 },
{ name: 'Рожки', category: '🍝 Макароны', measure: 'кг.', shelfLife: 730 },
{ name: 'Перья (пенне)', category: '🍝 Макароны', measure: 'кг.', shelfLife: 730 },
{ name: 'Спиральки', category: '🍝 Макароны', measure: 'кг.', shelfLife: 730 },
{ name: 'Вермишель', category: '🍝 Макароны', measure: 'кг.', shelfLife: 730 },
{ name: 'Гнезда', category: '🍝 Макароны', measure: 'уп.', shelfLife: 730 },
{ name: 'Листы для лазаньи', category: '🍝 Макароны', measure: 'уп.', shelfLife: 730 },
{ name: 'Цельнозерновые мак.', category: '🍝 Макароны', measure: 'кг.', shelfLife: 365 },
{ name: 'Рисовая лапша', category: '🍝 Макароны', measure: 'г.', shelfLife: 730 },
{ name: 'Гречневая лапша', category: '🍝 Макароны', measure: 'г.', shelfLife: 365 },
{ name: 'Листы для лазаньи', category: '🍝 Макаронные изделия', measure: 'шт.', shelfLife: 730 },

// 👩‍🍳 Мука/Ингредиенты
{ name: 'Мука пшеничная', category: '👩‍🍳 Мука/Ингредиенты', measure: 'кг.', shelfLife: 365 },
{ name: 'Мука ржаная', category: '👩‍🍳 Мука/Ингредиенты', measure: 'кг.', shelfLife: 180 },
{ name: 'Дрожжи сухие', category: '👩‍🍳 Мука/Ингредиенты', measure: 'г.', shelfLife: 365 },
{ name: 'Разрыхлитель теста', category: '👩‍🍳 Мука/Ингредиенты', measure: 'г.', shelfLife: 730 },
{ name: 'Крахмал кукурузный', category: '👩‍🍳 Мука/Ингредиенты', measure: 'г.', shelfLife: 730 },
{ name: 'Сахарная пудра', category: '👩‍🍳 Мука/Ингредиенты', measure: 'г.', shelfLife: 730 },
{ name: 'Ванилин', category: '👩‍🍳 Мука/Ингредиенты', measure: 'г.', shelfLife: 1095 },
{ name: 'Желатин', category: '👩‍🍳 Мука/Ингредиенты', measure: 'г.', shelfLife: 730 },
{ name: 'Панировочные сухари', category: '👩‍🍳 Мука/Ингредиенты', measure: 'г.', shelfLife: 180 },
{ name: 'Смесь для блинов', category: '👩‍🍳 Мука/Ингредиенты', measure: 'кг.', shelfLife: 365 },

// 🌻 Масла
{ name: 'Подсолнечное масло', category: '🌻 Масла', measure: 'л.', shelfLife: 365 },
{ name: 'Оливковое масло EV', category: '🌻 Масла', measure: 'л.', shelfLife: 540 },
{ name: 'Масло для жарки', category: '🌻 Масла', measure: 'л.', shelfLife: 730 },
{ name: 'Льняное масло', category: '🌻 Масла', measure: 'л.', shelfLife: 180 },
{ name: 'Кунжутное масло', category: '🌻 Масла', measure: 'л.', shelfLife: 365 },
{ name: 'Кокосовое масло', category: '🌻 Масла', measure: 'г.', shelfLife: 730 },
{ name: 'Виноградная косточка', category: '🌻 Масла', measure: 'л.', shelfLife: 365 },
{ name: 'Кукурузное масло', category: '🌻 Масла', measure: 'л.', shelfLife: 365 },
{ name: 'Масло авокадо', category: '🌻 Масла', measure: 'л.', shelfLife: 270 },
{ name: 'Рапсовое масло', category: '🌻 Масла', measure: 'л.', shelfLife: 365 },

// 🧂 Специи/Сахар
{ name: 'Сахар-песок', category: '🧂 Специи/Сахар', measure: 'кг.', shelfLife: 1825 },
{ name: 'Соль поваренная', category: '🧂 Специи/Сахар', measure: 'кг.', shelfLife: 1825 },
{ name: 'Черный перец (молотый)', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 1095 },
{ name: 'Паприка молотая', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Куркума', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Корица молотая', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Морская соль', category: '🧂 Специи/Сахар', measure: 'кг.', shelfLife: 1825 },
{ name: 'Тростниковый сахар', category: '🧂 Специи/Сахар', measure: 'кг.', shelfLife: 1095 },
{ name: 'Итальянские травы', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Чеснок сушеный', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Мускатный орех', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Орегано сушеный', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Базилик сушеный', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Тимьян сушеный', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Розмарин сушеный', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Хмели-сунели', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Уцхо-сунели', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Кориандр молотый', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Зира (кумин)', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 1095 },
{ name: 'Красный перец (чили)', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Имбирь молотый', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Гвоздика целая', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 1095 },
{ name: 'Лавровый лист', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Ванилин', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 365 },
{ name: 'Разрыхлитель теста', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 365 },
{ name: 'Прованские травы', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Смесь 5 перцев', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 1095 },
{ name: 'Карри (смесь)', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Сахарная пудра', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 730 },
{ name: 'Лимонная кислота', category: '🧂 Специи/Сахар', measure: 'г.', shelfLife: 1825 },

// 🍯 Соусы
{ name: 'Кетчуп', category: '🍯 Соусы', measure: 'шт.', shelfLife: 365 },
{ name: 'Майонез', category: '🍯 Соусы', measure: 'г.', shelfLife: 90 },
{ name: 'Горчица', category: '🍯 Соусы', measure: 'г.', shelfLife: 180 },
{ name: 'Соевый соус', category: '🍯 Соусы', measure: 'л.', shelfLife: 730 },
{ name: 'Томатный соус', category: '🍯 Соусы', measure: 'г.', shelfLife: 365 },
{ name: 'Соус Терияки', category: '🍯 Соусы', measure: 'г.', shelfLife: 365 },
{ name: 'Соус Песто', category: '🍯 Соусы', measure: 'г.', shelfLife: 270 },
{ name: 'Соус Сырный', category: '🍯 Соусы', measure: 'г.', shelfLife: 180 },
{ name: 'Хрен', category: '🍯 Соусы', measure: 'г.', shelfLife: 90 },
{ name: 'Аджика', category: '🍯 Соусы', measure: 'г.', shelfLife: 365 },

// 🥒 Маринады
{ name: 'Уксус 9%', category: '🥒 Маринады', measure: 'л.', shelfLife: 1095 },
{ name: 'Уксус яблочный', category: '🥒 Маринады', measure: 'л.', shelfLife: 730 },
{ name: 'Бальзамик', category: '🥒 Маринады', measure: 'л.', shelfLife: 1095 },
{ name: 'Маринов. огурцы', category: '🥒 Маринады', measure: 'банка', shelfLife: 730 },
{ name: 'Маринов. томаты', category: '🥒 Маринады', measure: 'банка', shelfLife: 730 },
{ name: 'Квашеная капуста', category: '🥒 Маринады', measure: 'кг.', shelfLife: 30 },
{ name: 'Оливки', category: '🥒 Маринады', measure: 'банка', shelfLife: 1095 },
{ name: 'Каперсы', category: '🥒 Маринады', measure: 'г.', shelfLife: 730 },
{ name: 'Корнишоны', category: '🥒 Маринады', measure: 'банка', shelfLife: 730 },
{ name: 'Имбирь маринов.', category: '🥒 Маринады', measure: 'г.', shelfLife: 180 },

// 🫘 Бобовые
{ name: 'Чечевица красная', category: '🫘 Бобовые', measure: 'кг.', shelfLife: 540 },
{ name: 'Чечевица зеленая', category: '🫘 Бобовые', measure: 'кг.', shelfLife: 540 },
{ name: 'Нут', category: '🫘 Бобовые', measure: 'кг.', shelfLife: 540 },
{ name: 'Фасоль белая', category: '🫘 Бобовые', measure: 'кг.', shelfLife: 730 },
{ name: 'Фасоль красная', category: '🫘 Бобовые', measure: 'кг.', shelfLife: 730 },
{ name: 'Горох колотый', category: '🫘 Бобовые', measure: 'кг.', shelfLife: 540 },
{ name: 'Маш', category: '🫘 Бобовые', measure: 'кг.', shelfLife: 540 },
{ name: 'Фасоль конс.', category: '🫘 Бобовые', measure: 'банка', shelfLife: 1095 },
{ name: 'Горошек конс.', category: '🫘 Бобовые', measure: 'банка', shelfLife: 730 },
{ name: 'Кукуруза конс.', category: '🫘 Бобовые', measure: 'банка', shelfLife: 730 },

// 🥣 Завтраки
{ name: 'Хлопья кукурузные', category: '🥣 Завтраки', measure: 'г.', shelfLife: 270 },
{ name: 'Мюсли с орехами', category: '🥣 Завтраки', measure: 'кг.', shelfLife: 270 },
{ name: 'Гранола', category: '🥣 Завтраки', measure: 'г.', shelfLife: 180 },
{ name: 'Шоколадные шарики', category: '🥣 Завтраки', measure: 'г.', shelfLife: 365 },
{ name: 'Подушечки', category: '🥣 Завтраки', measure: 'г.', shelfLife: 270 },
{ name: 'Каша быстр. приг.', category: '🥣 Завтраки', measure: 'уп.', shelfLife: 365 },
{ name: 'Отруби', category: '🥣 Завтраки', measure: 'г.', shelfLife: 180 },
{ name: 'Гречневые хлопья', category: '🥣 Завтраки', measure: 'г.', shelfLife: 365 },
{ name: 'Смесь злаков', category: '🥣 Завтраки', measure: 'кг.', shelfLife: 365 },
{ name: 'Батончики мюсли', category: '🥣 Завтраки', measure: 'шт.', shelfLife: 365 },

// 🍞 Хлеб
{ name: 'Хлеб пшеничный', category: '🍞 Хлеб', measure: 'шт.', shelfLife: 3 },
{ name: 'Хлеб ржаной', category: '🍞 Хлеб', measure: 'шт.', shelfLife: 5 },
{ name: 'Батон нарезной', category: '🍞 Хлеб', measure: 'шт.', shelfLife: 3 },
{ name: 'Хлеб для тостов', category: '🍞 Хлеб', measure: 'уп.', shelfLife: 10 },
{ name: 'Бородинский хлеб', category: '🍞 Хлеб', measure: 'шт.', shelfLife: 5 },
{ name: 'Багет', category: '🍞 Хлеб', measure: 'шт.', shelfLife: 1 },
{ name: 'Чиабатта', category: '🍞 Хлеб', measure: 'шт.', shelfLife: 2 },
{ name: 'Хлеб цельнозерновой', category: '🍞 Хлеб', measure: 'шт.', shelfLife: 5 },
{ name: 'Хлебцы сухие', category: '🍞 Хлеб', measure: 'уп.', shelfLife: 180 },
{ name: 'Лаваш', category: '🍞 Хлеб', measure: 'уп.', shelfLife: 3 },

// 🥐 Выпечка
{ name: 'Булки для бургеров', category: '🥐 Выпечка', measure: 'уп.', shelfLife: 7 },
{ name: 'Пирожки с мясом', category: '🥐 Выпечка', measure: 'шт.', shelfLife: 2 },
{ name: 'Пирожки с капустой', category: '🥐 Выпечка', measure: 'шт.', shelfLife: 2 },
{ name: 'Сосиска в тесте', category: '🥐 Выпечка', measure: 'шт.', shelfLife: 2 },
{ name: 'Слойки язычки', category: '🥐 Выпечка', measure: 'шт.', shelfLife: 3 },
{ name: 'Круассаны пустые', category: '🥐 Выпечка', measure: 'шт.', shelfLife: 3 },
{ name: 'Хачапури', category: '🥐 Выпечка', measure: 'шт.', shelfLife: 2 },
{ name: 'Пита', category: '🥐 Выпечка', measure: 'уп.', shelfLife: 5 },
{ name: 'Тортилья', category: '🥐 Выпечка', measure: 'уп.', shelfLife: 60 },
{ name: 'Слойка с сыром', category: '🥐 Выпечка', measure: 'шт.', shelfLife: 2 },

// 🍪 Печенье
{ name: 'Печенье овсяное', category: '🍪 Печенье', measure: 'кг.', shelfLife: 60 },
{ name: 'Печенье песочное', category: '🍪 Печенье', measure: 'кг.', shelfLife: 90 },
{ name: 'Пряники', category: '🍪 Печенье', measure: 'кг.', shelfLife: 60 },
{ name: 'Вафли', category: '🍪 Печенье', measure: 'кг.', shelfLife: 240 },
{ name: 'Галеты', category: '🍪 Печенье', measure: 'уп.', shelfLife: 180 },
{ name: 'Крекер', category: '🍪 Печенье', measure: 'уп.', shelfLife: 180 },
{ name: 'Сушки', category: '🍪 Печенье', measure: 'кг.', shelfLife: 120 },
{ name: 'Баранки', category: '🍪 Печенье', measure: 'уп.', shelfLife: 15 },
{ name: 'Крекеры с сыром', category: '🍪 Печенье', measure: 'уп.', shelfLife: 180 },
{ name: 'Бисквитное печенье', category: '🍪 Печенье', measure: 'г.', shelfLife: 120 },

// 🍰 Торты
{ name: 'Торт Наполеон', category: '🍰 Торты', measure: 'шт.', shelfLife: 3 },
{ name: 'Торт Медовик', category: '🍰 Торты', measure: 'шт.', shelfLife: 5 },
{ name: 'Пирожное Картошка', category: '🍰 Торты', measure: 'шт.', shelfLife: 5 },
{ name: 'Эклер', category: '🍰 Торты', measure: 'шт.', shelfLife: 3 },
{ name: 'Чизкейк', category: '🍰 Торты', measure: 'шт.', shelfLife: 5 },
{ name: 'Тирамису', category: '🍰 Торты', measure: 'шт.', shelfLife: 3 },
{ name: 'Безе', category: '🍰 Торты', measure: 'г.', shelfLife: 14 },
{ name: 'Маффины', category: '🍰 Торты', measure: 'шт.', shelfLife: 7 },
{ name: 'Рулет бисквитный', category: '🍰 Торты', measure: 'шт.', shelfLife: 15 },
{ name: 'Тарталетки', category: '🍰 Торты', measure: 'шт.', shelfLife: 2 },

// 🍫 Сладости
{ name: 'Шоколад молочный', category: '🍫 Сладости', measure: 'шт.', shelfLife: 365 },
{ name: 'Шоколад горький', category: '🍫 Сладости', measure: 'шт.', shelfLife: 540 },
{ name: 'Конфеты в коробке', category: '🍫 Сладости', measure: 'шт.', shelfLife: 270 },
{ name: 'Карамель', category: '🍫 Сладости', measure: 'кг.', shelfLife: 365 },
{ name: 'Леденцы', category: '🍫 Сладости', measure: 'уп.', shelfLife: 540 },
{ name: 'Мармелад', category: '🍫 Сладости', measure: 'г.', shelfLife: 90 },
{ name: 'Зефир', category: '🍫 Сладости', measure: 'г.', shelfLife: 60 },
{ name: 'Пастила', category: '🍫 Сладости', measure: 'г.', shelfLife: 60 },
{ name: 'Ирис', category: '🍫 Сладости', measure: 'г.', shelfLife: 180 },
{ name: 'Шоколадные батончики', category: '🍫 Сладости', measure: 'шт.', shelfLife: 365 },

// 🍯 Варенье/Мед
{ name: 'Мед цветочный', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 730 },
{ name: 'Варенье малиновое', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 730 },
{ name: 'Джем клубничный', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 730 },
{ name: 'Повидло', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 730 },
{ name: 'Конфитюр', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 730 },
{ name: 'Кленовый сироп', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 730 },
{ name: 'Сироп топинамбура', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 365 },
{ name: 'Арахисовая паста', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 270 },
{ name: 'Шоколадная паста', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 365 },
{ name: 'Урбеч', category: '🍯 Варенье/Мед', measure: 'г.', shelfLife: 180 },

// 💧 Вода
{ name: 'Вода 5л', category: '💧 Вода', measure: 'шт.', shelfLife: 365 },
{ name: 'Вода газированная', category: '💧 Вода', measure: 'л.', shelfLife: 365 },
{ name: 'Лечебная минералка', category: '💧 Вода', measure: 'л.', shelfLife: 365 },
{ name: 'Вода со вкусом', category: '💧 Вода', measure: 'л.', shelfLife: 270 },
{ name: 'Детская вода', category: '💧 Вода', measure: 'л.', shelfLife: 365 },
{ name: 'Вода в стекле', category: '💧 Вода', measure: 'л.', shelfLife: 730 },
{ name: 'Спортивная вода', category: '💧 Вода', measure: 'л.', shelfLife: 365 },
{ name: 'Талая вода', category: '💧 Вода', measure: 'л.', shelfLife: 180 },
{ name: 'Вода с магнием', category: '💧 Вода', measure: 'л.', shelfLife: 365 },
{ name: 'Дистиллированная вода', category: '💧 Вода', measure: 'л.', shelfLife: 730 },

// 🧃 Соки
{ name: 'Яблочный сок', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },
{ name: 'Апельсиновый сок', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },
{ name: 'Томатный сок', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },
{ name: 'Нектар мультифрукт', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },
{ name: 'Клюквенный морс', category: '🧃 Соки', measure: 'л.', shelfLife: 270 },
{ name: 'Вишневый нектар', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },
{ name: 'Ананасовый сок', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },
{ name: 'Гранатовый сок', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },
{ name: 'Березовый сок', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },
{ name: 'Овощной микс сок', category: '🧃 Соки', measure: 'л.', shelfLife: 365 },

// 🥤 Газировка
{ name: 'Кола', category: '🥤 Газировка', measure: 'л.', shelfLife: 365 },
{ name: 'Лимонад', category: '🥤 Газировка', measure: 'л.', shelfLife: 270 },
{ name: 'Тоник', category: '🥤 Газировка', measure: 'л.', shelfLife: 365 },
{ name: 'Холодный чай', category: '🥤 Газировка', measure: 'л.', shelfLife: 270 },
{ name: 'Квас фильтров.', category: '🥤 Газировка', measure: 'л.', shelfLife: 180 },
{ name: 'Тархун', category: '🥤 Газировка', measure: 'л.', shelfLife: 270 },
{ name: 'Энергетик', category: '🥤 Газировка', measure: 'шт.', shelfLife: 540 },
{ name: 'Имбирный эль', category: '🥤 Газировка', measure: 'л.', shelfLife: 365 },
{ name: 'Байкал', category: '🥤 Газировка', measure: 'л.', shelfLife: 180 },
{ name: 'Газировка без сахара', category: '🥤 Газировка', measure: 'л.', shelfLife: 270 },

// ☕ Чай
{ name: 'Чай в пакетиках', category: '☕ Чай', measure: 'уп.', shelfLife: 730 },
{ name: 'Зеленый листовой', category: '☕ Чай', measure: 'г.', shelfLife: 730 },
{ name: 'Иван-чай', category: '☕ Чай', measure: 'г.', shelfLife: 730 },
{ name: 'Каркаде', category: '☕ Чай', measure: 'г.', shelfLife: 730 },
{ name: 'Улун', category: '☕ Чай', measure: 'г.', shelfLife: 540 },
{ name: 'Травяной сбор', category: '☕ Чай', measure: 'г.', shelfLife: 730 },
{ name: 'Ройбуш', category: '☕ Чай', measure: 'г.', shelfLife: 730 },
{ name: 'Фруктовый чай', category: '☕ Чай', measure: 'г.', shelfLife: 540 },
{ name: 'Пуэр', category: '☕ Чай', measure: 'г.', shelfLife: 1825 },
{ name: 'Матча', category: '☕ Чай', measure: 'г.', shelfLife: 365 },

// ☕ Кофе
{ name: 'Кофе растворимый', category: '☕ Кофе', measure: 'г.', shelfLife: 730 },
{ name: 'Кофе в зернах', category: '☕ Кофе', measure: 'г.', shelfLife: 540 },
{ name: 'Кофе молотый', category: '☕ Кофе', measure: 'г.', shelfLife: 365 },
{ name: 'Кофе в капсулах', category: '☕ Кофе', measure: 'уп.', shelfLife: 450 },
{ name: 'Кофе без кофеина', category: '☕ Кофе', measure: 'г.', shelfLife: 365 },
{ name: 'Напиток 3в1', category: '☕ Кофе', measure: 'шт.', shelfLife: 365 },
{ name: 'Цикорий', category: '☕ Кофе', measure: 'г.', shelfLife: 540 },
{ name: 'Зеленый кофе', category: '☕ Кофе', measure: 'г.', shelfLife: 365 },
{ name: 'Кофе для турки', category: '☕ Кофе', measure: 'г.', shelfLife: 270 },
{ name: 'Кофе в дрипах', category: '☕ Кофе', measure: 'уп.', shelfLife: 365 },

// ☕ Какао
{ name: 'Какао-порошок', category: '☕ Какао', measure: 'г.', shelfLife: 365 },
{ name: 'Горячий шоколад', category: '☕ Какао', measure: 'г.', shelfLife: 365 },
{ name: 'Растворимое какао', category: '☕ Какао', measure: 'г.', shelfLife: 540 },
{ name: 'Кэроб', category: '☕ Какао', measure: 'г.', shelfLife: 365 },
{ name: 'Какао-масло', category: '☕ Какао', measure: 'г.', shelfLife: 730 },
{ name: 'Шоколадная крошка', category: '☕ Какао', measure: 'г.', shelfLife: 365 },
{ name: 'Какао-велла', category: '☕ Какао', measure: 'г.', shelfLife: 365 },
{ name: 'Напиток какао готовый', category: '☕ Какао', measure: 'л.', shelfLife: 180 },
{ name: 'Кусковое какао', category: '☕ Какао', measure: 'г.', shelfLife: 730 },
{ name: 'Смесь для брауни', category: '☕ Какао', measure: 'уп.', shelfLife: 365 },

// 🥛 Растительное молоко
{ name: 'Овсяное молоко', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 365 },
{ name: 'Миндальное молоко', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 365 },
{ name: 'Кокосовое молоко', category: '🥛 Растительное молоко', measure: 'банка', shelfLife: 730 },
{ name: 'Соевое молоко', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 365 },
{ name: 'Рисовое молоко', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 270 },
{ name: 'Фундучное молоко', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 270 },
{ name: 'Гречневое молоко', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 270 },
{ name: 'Кешью молоко', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 270 },
{ name: 'Банановое молоко', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 270 },
{ name: 'Растительные сливки', category: '🥛 Растительное молоко', measure: 'л.', shelfLife: 180 },

// 🥜 Орехи
{ name: 'Грецкий орех', category: '🥜 Орехи', measure: 'кг.', shelfLife: 180 },
{ name: 'Фундук', category: '🥜 Орехи', measure: 'кг.', shelfLife: 180 },
{ name: 'Миндаль', category: '🥜 Орехи', measure: 'кг.', shelfLife: 270 },
{ name: 'Кешью', category: '🥜 Орехи', measure: 'кг.', shelfLife: 180 },
{ name: 'Кедровый орех', category: '🥜 Орехи', measure: 'г.', shelfLife: 90 },
{ name: 'Курага', category: '🥜 Орехи', measure: 'кг.', shelfLife: 180 },
{ name: 'Чернослив', category: '🥜 Орехи', measure: 'кг.', shelfLife: 180 },
{ name: 'Изюм', category: '🥜 Орехи', measure: 'кг.', shelfLife: 180 },
{ name: 'Финики', category: '🥜 Орехи', measure: 'кг.', shelfLife: 270 },
{ name: 'Смесь орехов', category: '🥜 Орехи', measure: 'г.', shelfLife: 180 },

// 🍿 Снеки
{ name: 'Чипсы картоф.', category: '🍿 Снеки', measure: 'уп.', shelfLife: 270 },
{ name: 'Сухарики', category: '🍿 Снеки', measure: 'уп.', shelfLife: 180 },
{ name: 'Попкорн', category: '🍿 Снеки', measure: 'уп.', shelfLife: 180 },
{ name: 'Кукурузные палочки', category: '🍿 Снеки', measure: 'уп.', shelfLife: 180 },
{ name: 'Арахис соленый', category: '🍿 Снеки', measure: 'г.', shelfLife: 270 },
{ name: 'Фисташки', category: '🍿 Снеки', measure: 'кг.', shelfLife: 270 },
{ name: 'Соломка', category: '🍿 Снеки', measure: 'шт.', shelfLife: 180 },
{ name: 'Чипсы нори', category: '🍿 Снеки', measure: 'уп.', shelfLife: 365 },
{ name: 'Фруктовые чипсы', category: '🍿 Снеки', measure: 'г.', shelfLife: 365 },
{ name: 'Семечки', category: '🍿 Снеки', measure: 'уп.', shelfLife: 120 },

// 👶 Детское питание
{ name: 'Фруктовое пюре', category: '👶 Детское питание', measure: 'шт.', shelfLife: 365 },
{ name: 'Мясное пюре', category: '👶 Детское питание', measure: 'шт.', shelfLife: 730 },
{ name: 'Каша безмолочная', category: '👶 Детское питание', measure: 'г.', shelfLife: 365 },
{ name: 'Молочная смесь', category: '👶 Детское питание', measure: 'банка', shelfLife: 540 },
{ name: 'Детский сок', category: '👶 Детское питание', measure: 'шт.', shelfLife: 365 },
{ name: 'Детское печенье', category: '👶 Детское питание', measure: 'уп.', shelfLife: 270 },
{ name: 'Овощное пюре', category: '👶 Детское питание', measure: 'шт.', shelfLife: 365 },
{ name: 'Чай для мам', category: '👶 Детское питание', measure: 'уп.', shelfLife: 730 },
{ name: 'Вода детская', category: '👶 Детское питание', measure: 'л.', shelfLife: 365 },
{ name: 'Пудинг детский', category: '👶 Детское питание', measure: 'шт.', shelfLife: 90 },
// 🥫 Консервы
{ name: 'Томаты в собственном соку', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Томатная паста', category: '🥫 Консервы', measure: 'кг.', shelfLife: 365 },
{ name: 'Томаты в собственном соку', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Томатная паста', category: '🥫 Консервы', measure: 'кг.', shelfLife: 365 },
{ name: 'Горошек зеленый консервированный', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Кукуруза сладкая консервированная', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Тунец консервированный (в соку)', category: '🥫 Консервы', measure: 'кг.', shelfLife: 1095 },
{ name: 'Фасоль красная консервированная', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Фасоль белая консервированная', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Оливки без косточек', category: '🥫 Консервы', measure: 'кг.', shelfLife: 1095 },
{ name: 'Маслины без косточек', category: '🥫 Консервы', measure: 'кг.', shelfLife: 1095 },
{ name: 'Шампиньоны консервированные', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Кокосовое молоко (банка)', category: '🥫 Консервы', measure: 'л.', shelfLife: 545 },
{ name: 'Ананасы консервированные (кольца)', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Сгущенное молоко с сахаром', category: '🥫 Консервы', measure: 'кг.', shelfLife: 365 },
{ name: 'Шпроты в масле', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Горбуша консервированная', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Огурцы маринованные (корнишоны)', category: '🥫 Консервы', measure: 'кг.', shelfLife: 730 },
{ name: 'Паштет печеночный', category: '🥫 Консервы', measure: 'кг.', shelfLife: 365 }
];

// Unit conversion helpers (module-level so all components can use them)
const UNIT_MAP = {
  'г.': { type: 'mass', factor: 1 },      // base: grams
  'кг.': { type: 'mass', factor: 1000 },  // kilograms -> grams
  'мл.': { type: 'volume', factor: 1 },   // base: milliliters
  'л.': { type: 'volume', factor: 1000 }, // liters -> milliliters
  'шт.': { type: 'count', factor: 1 }
};

const normalizeMeasure = (m) => {
  if (!m) return '';
  const s = String(m).trim().toLowerCase();
  if (s === 'г' || s === 'g') return 'г.';
  if (s === 'кг' || s === 'kg') return 'кг.';
  if (s === 'л' || s === 'l') return 'л.';
  if (s === 'мл' || s === 'ml') return 'мл.';
  if (s === 'шт' || s === 'pcs') return 'шт.';
  return s.endsWith('.') ? s : s + (s === '' ? '' : '.');
};

const convertQuantity = (quantity, fromMeasure, toMeasure) => {
  try {
    const q = Number(quantity);
    if (!isFinite(q)) return 0;
    const fromN = normalizeMeasure(fromMeasure);
    const toN = normalizeMeasure(toMeasure);
    if (!fromN || !toN || fromN === toN) return q;
    const from = UNIT_MAP[fromN] || { type: 'count', factor: 1 };
    const to = UNIT_MAP[toN] || { type: 'count', factor: 1 };
    if (from.type !== to.type) return q;
    return (q * from.factor) / to.factor;
  } catch (e) {
    console.error('convertQuantity error', e, quantity, fromMeasure, toMeasure);
    return quantity;
  }
};

const getStepDecimals = (step) => {
  const s = String(step);
  if (!s.includes('.')) return 0;
  return s.split('.')[1].length;
};

const roundToStep = (quantity, step) => {
  if (!isFinite(quantity) || !isFinite(step) || step === 0) return quantity;
  const rounded = Math.round(quantity / step) * step;
  const decimals = getStepDecimals(step);
  return Number(rounded.toFixed(decimals));
};

const getQuantityStep = (measure) => {
  if (measure === 'л.') return 0.1;
  if (measure === 'мл.') return 50;
  if (measure === 'кг.') return 0.1;
  if (measure === 'г.') return 10;
  if (measure === 'шт.') return 1;
  return 1;
};

// Format quantities for display: choose sensible decimals per measure and trim trailing zeros
const formatQuantityForDisplay = (quantity, measure) => {
  const q = Number(quantity);
  if (!isFinite(q)) return '0';
  const m = normalizeMeasure(measure);
  // For small-unit integer measures show integer
  if (m === 'г.' || m === 'мл.' || m === 'шт.' || m === 'уп.') {
    return String(Math.round(q));
  }

  // For larger units (kg, l) show up to 3 decimals but trim trailing zeros
  const decimals = 3;
  const fixed = q.toFixed(decimals);
  // remove trailing zeros and optional trailing dot
  return fixed.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
};

const adjustQuantity = (currentQuantity, measure, increment) => {
  try {
    const step = getQuantityStep(measure);
    let q = Number(currentQuantity);
    if (!isFinite(q)) q = step;
    let newQ = increment ? q + step : q - step;
    if (newQ < step) newQ = step;
    return roundToStep(newQ, step);
  } catch (e) {
    console.error('adjustQuantity error', e, currentQuantity, measure, increment);
    return currentQuantity || getQuantityStep(measure);
  }
};


// Компонент для поля с автозаполнением
const AutocompleteInput = ({ value, onChange, onSelect, placeholder, products }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const safeProducts = Array.isArray(products) ? products : [];
  const normalizeForSearch = (s) => {
    if (!s && s !== 0) return '';
    try {
      return String(s)
        .toLowerCase()
        .normalize('NFKD')
        // replace non-letter/number with space
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
    } catch (e) {
      return String(s).toLowerCase();
    }
  };

  const handleChange = (e) => {
    const inputValue = e.target.value || '';
    onChange(inputValue);

    const query = normalizeForSearch(inputValue);

    if (query.length > 0) {
      const filtered = safeProducts
        .filter(product => {
          if (!product || !product.name) return false;
          const nameNorm = normalizeForSearch(product.name);
          return nameNorm.includes(query);
        })
        .slice(0, 12);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      // when input is cleared, hide suggestions (they can reappear on focus)
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleFocus = () => {
    // show a short list of popular / first products when focusing empty input
    if (!value || value.length === 0) {
      const popular = safeProducts.slice(0, 8);
      setSuggestions(popular);
      setShowSuggestions(popular.length > 0);
    }
  };

  const handleSelect = (product) => {
    onSelect(product);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        className="w-full p-3 border border-gray-200 rounded-xl"
      />
      
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
          {suggestions.map(product => (
            <button
              key={product.name}
              onClick={() => handleSelect(product)}
              className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="font-semibold">{product.name}</div>
              <div className="text-sm text-gray-600">{product.category}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Компонент авторизации
const AuthModal = ({ isOpen, onClose, onLogin, onRegister }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', email: '' });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoginMode) {
      onLogin(formData);
    } else {
      onRegister(formData);
    }
    setFormData({ username: '', password: '', email: '' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{isLoginMode ? 'Вход' : 'Регистрация'}</h2>
          <button onClick={onClose} className="text-gray-500">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Имя пользователя
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className="w-full p-3 border border-gray-200 rounded-xl"
              required
            />
          </div>

          {!isLoginMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-3 border border-gray-200 rounded-xl"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full p-3 border border-gray-200 rounded-xl"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-3 rounded-xl font-semibold"
          >
            {isLoginMode ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        {/* Разделитель */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500">или</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Google авторизация */}
        <button
          onClick={() => {
            // Имитация Google OAuth
            const googleUser = {
              name: 'Пользователь Google',
              email: 'user@gmail.com',
              avatar: 'https://lh3.googleusercontent.com/a-/default-user'
            };
            if (isLoginMode) {
              onLogin({ username: googleUser.name, password: 'google', email: googleUser.email });
            } else {
              onRegister({ username: googleUser.name, password: 'google', email: googleUser.email });
            }
            onClose();
          }}
          className="w-full bg-white border border-gray-300 text-gray-700 p-3 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoginMode ? 'Войти через Google' : 'Зарегистрироваться через Google'}
        </button>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLoginMode(!isLoginMode)}
            className="text-blue-500 text-sm"
          >
            {isLoginMode ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Компонент карточки рецепта
const RecipeCard = ({ recipe, pantryItems, isCustom, onAddToCart, onToggleFavorite, onViewDetails, onDelete, onAddToMyRecipes, onEdit, isFavorite }) => {
  const getIngredientStatus = (ingredient) => {
    const pantryItem = pantryItems.find(item => item.name === ingredient.name);
    if (!pantryItem || pantryItem.quantity === 0) return {
      status: 'missing',
      color: 'bg-gray-200 text-gray-700'
    };

    // Convert pantry quantity to the unit used by the ingredient for comparison
    const availableInIngredientUnit = convertQuantity(pantryItem.quantity, pantryItem.measure, ingredient.measure);
    if (availableInIngredientUnit >= ingredient.amount) return {
      status: 'available',
      color: 'bg-green-200 text-green-800'
    };

    return {
      status: 'partial',
      color: 'bg-orange-200 text-orange-800',
      available: availableInIngredientUnit
    };
  };

  const missingIngredients = recipe.ingredients.filter(ingredient => {
    const status = getIngredientStatus(ingredient);
    return status.status === 'missing' || status.status === 'partial';
  });

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
         onClick={(e) => {
           // Если клик по кнопкам - не открывать модал
           if (e.target.closest('button')) return;
           onViewDetails && onViewDetails(recipe);
         }}>
      <div className="flex gap-3">
        {/* Картинка */}
        <div 
          className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0"
        >
          {recipe.image && (
            <img 
              src={recipe.image} 
              alt={recipe.name}
              className="w-full h-full object-cover rounded-lg"
            />
          )}
        </div>

        {/* Содержимое */}
        <div className="flex-1 min-w-0">
          {/* Название с кнопкой редактирования */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
            {isCustom && onEdit && (
              <button
                onClick={() => onEdit(recipe)}
                className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                title="Редактировать рецепт"
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>
          
          {/* Сложность и время */}
          <div className="text-sm text-gray-600 mb-2">
            {recipe.difficulty} • {recipe.time} мин
            {missingIngredients.length > 0 && (
              <span className="text-orange-600 ml-2">• не хватает {missingIngredients.length} продуктов</span>
            )}
          </div>

          {/* Ингредиенты */}
          <div className="flex flex-wrap gap-1">
            {recipe.ingredients.map((ingredient, index) => {
              const status = getIngredientStatus(ingredient);
              
              return (
                <span 
                  key={index}
                  className={`text-xs px-2 py-1 rounded-full ${status.color}`}
                >
                  {ingredient.name} {ingredient.amount}{ingredient.measure}
                  {status.status === 'partial' && (
                    ` (нед: ${formatQuantityForDisplay(Math.max(0, ingredient.amount - (status.available || 0)), ingredient.measure)}${ingredient.measure})`
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Кнопки справа в вертикальном ряду */}
        <div className="flex flex-col gap-3 items-end flex-shrink-0">
          <button
            onClick={() => onToggleFavorite(recipe)}
            className={isFavorite ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}
            title="Добавить в избранное"
          >
            <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          {missingIngredients.length > 0 && (
            <button
              onClick={() => onAddToCart(recipe)}
              className="text-blue-500 hover:text-blue-700"
              title="Добавить недостающие ингредиенты в корзину"
            >
              <ShoppingCart size={18} />
            </button>
          )}
          {!isCustom && onAddToMyRecipes && (
            <button
              onClick={() => onAddToMyRecipes(recipe)}
              className="text-green-500 hover:text-green-700"
              title="Добавить в мои рецепты"
            >
              <Plus size={18} />
            </button>
          )}
          {isCustom && onDelete && (
            <button
              onClick={() => onDelete(recipe.id)}
              className="text-gray-400 hover:text-red-500"
              title="Удалить рецепт"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Utility function to break text into lines of max 15 characters
const formatTextWithLineBreaks = (text, maxLength = 15) => {
  if (!text || text.length <= maxLength) return text;
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    if (currentLine.length + word.length + 1 <= maxLength) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
};

const OlivierApp = () => {
  const tg = window.Telegram?.WebApp;
  const telegramUserId = tg?.initDataUnsafe?.user?.id?.toString() || null;

  // LocalStorage key helper
  const getLocalKey = (userId) => `olivier_state_${userId || 'anon'}`;

  const loadLocalState = () => {
    try {
      const key = getLocalKey(telegramUserId);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      // convert expiryDate strings back to Date objects where present
      if (parsed.pantryItems) {
        parsed.pantryItems = parsed.pantryItems.map(item => ({
          ...item,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
        }));
      }
      return parsed;
    } catch (e) {
      console.error('Error loading local state', e);
      return null;
    }
  };

  const saveLocalState = (stateObj) => {
    try {
      const key = getLocalKey(telegramUserId);
      const toSave = JSON.parse(JSON.stringify(stateObj));
      // ensure dates are stored as ISO strings
      if (toSave.pantryItems) {
        toSave.pantryItems = toSave.pantryItems.map(item => ({
          ...item,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null
        }));
      }
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.error('Error saving local state', e);
    }
  };

  const [currentTab, setCurrentTab] = useState('pantry');
  const contentRef = useRef(null);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [stateError, setStateError] = useState(null);
  const [pantryItems, setPantryItems] = useState([]);
  const [shoppingItems, setShoppingItems] = useState([
    {
      id: 1,
      name: 'Молоко',
      quantity: 2,
      measure: 'л.',
      category: '🥛 Молочные',
      completed: false,
      note: ''
    },
    {
      id: 2,
      name: 'Помидоры',
      quantity: 1,
      measure: 'кг.',
      category: '🥦 Овощи',
      completed: false,
      note: ''
    },
    {
      id: 3,
      name: 'Яйца',
      quantity: 12,
      measure: 'шт.',
      category: '🥚 Яйца',
      completed: true,
      note: ''
    },
    {
      id: 4,
      name: 'Хлеб',
      quantity: 1,
      measure: 'шт.',
      category: '🍞 Хлебобулочные',
      completed: true,
      note: ''
    }
  ]);
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [favoriteRecipes, setFavoriteRecipes] = useState([]);
  const [customRecipes, setCustomRecipes] = useState([]);
  const [notification, setNotification] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [editingDateProduct, setEditingDateProduct] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletingRecipe, setDeletingRecipe] = useState(null);

  const [addFormData, setAddFormData] = useState({
    name: '',
    category: '',
    measure: '',
    quantity: 1,
    expiryDate: '',
    autoFilled: false
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    quantity: 1,
    measure: '',
    expiryDate: ''
  });

  const [recipeFormData, setRecipeFormData] = useState({
    name: '',
    ingredients: [],
    difficulty: 'легкий',
    time: 30,
    steps: [{ text: '', image: '' }],
    comments: '',
    image: ''
  });

  const createDefaultPantryItems = () => {
    const now = Date.now();

    const makeItem = (productName, quantity, measureOverride) => {
      const product = PRODUCTS_DB.find(p => p.name === productName) || {
        name: productName,
        category: '🏷️ Прочее',
        measure: measureOverride || 'шт.',
        shelfLife: 7
      };

      const measure = measureOverride || product.measure;
      const shelfLife = product.shelfLife || 7;
      const expiryDate = new Date(now + shelfLife * 24 * 60 * 60 * 1000);

      return {
        id: Date.now() + Math.random(),
        name: product.name,
        category: product.category,
        measure,
        quantity,
        expiryDate,
        autoFilled: true
      };
    };

    return [
      makeItem('Рис', 1, 'кг.'),
      makeItem('Молоко', 1.5, 'л.'),
      makeItem('Яблоки', 3, 'шт.')
    ];
  };

  

  // Загрузка состояния пользователя (сначала локально, затем при наличии — из Supabase)
  useEffect(() => {
    const loadState = async () => {
      // Попробуем сначала загрузить локально (быстрый отклик при перезагрузке)
      const local = loadLocalState();
      if (local) {
        if (local.pantryItems) setPantryItems(local.pantryItems);
        if (local.shoppingItems) setShoppingItems(local.shoppingItems);
        if (local.favoriteProducts) setFavoriteProducts(local.favoriteProducts);
        if (local.favoriteRecipes) setFavoriteRecipes(local.favoriteRecipes);
        if (local.customRecipes) setCustomRecipes(local.customRecipes);
      }

      // Если есть Supabase и Telegram ID — обновим состояние с сервера (при наличии)
      if (!supabase || !telegramUserId) {
        // Нет удалённого хранения — если локального не было, заполним дефолтом
        if (!local) setPantryItems(createDefaultPantryItems());
        setIsLoadingState(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_states')
          .select('state')
          .eq('telegram_user_id', telegramUserId)
          .maybeSingle();

        if (error) {
          console.error('Error loading state', error);
          setStateError('Не удалось загрузить данные');
        }

        if (data && data.state) {
          const state = data.state;
          if (state.pantryItems) {
            setPantryItems(state.pantryItems.map(item => ({
              ...item,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
            })));
          }
          if (state.shoppingItems) setShoppingItems(state.shoppingItems);
          if (state.favoriteProducts) setFavoriteProducts(state.favoriteProducts);
          if (state.favoriteRecipes) setFavoriteRecipes(state.favoriteRecipes);
          if (state.customRecipes) setCustomRecipes(state.customRecipes);
        } else if (!local) {
          // Первый вход пользователя — заполняем кладовую дефолтными продуктами
          setPantryItems(createDefaultPantryItems());
        }
      } catch (e) {
        console.error(e);
        setStateError('Не удалось загрузить данные');
      } finally {
        setIsLoadingState(false);
      }
    };

    loadState();
  }, [telegramUserId]);

  // Сохранение состояния пользователя локально и в Supabase (если доступен)
  useEffect(() => {
    if (isLoadingState) return;

    const saveState = async () => {
      try {
        const stateToSave = {
          pantryItems: pantryItems.map(item => ({
            ...item,
            expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null
          })),
          shoppingItems,
          favoriteProducts,
          favoriteRecipes,
          customRecipes
        };

        // Always save locally so data survives page reloads even without Supabase/Telegram
        saveLocalState(stateToSave);

        // If Supabase and Telegram ID available, sync to server
        if (supabase && telegramUserId) {
          await supabase
            .from('user_states')
            .upsert(
              {
                telegram_user_id: telegramUserId,
                state: stateToSave
              },
              { onConflict: 'telegram_user_id' }
            );
        }
      } catch (e) {
        console.error('Error saving state', e);
      }
    };

    saveState();
  }, [telegramUserId, isLoadingState, pantryItems, shoppingItems, favoriteProducts, favoriteRecipes, customRecipes]);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 1000);
  };

  const handleDateClick = (item) => {
    setEditingDateProduct(item);
    setShowDateModal(true);
  };

  const updateExpiryDate = (newDate) => {
    if (editingDateProduct && newDate) {
      setPantryItems(prevItems =>
        prevItems.map(item =>
          item.id === editingDateProduct.id
            ? { ...item, expiryDate: new Date(newDate) }
            : item
        )
      );
      setShowDateModal(false);
      setEditingDateProduct(null);
      showNotification('Срок годности обновлен!');
    }
  };

  const handleProductSelect = (product) => {
    setAddFormData(prev => ({
      ...prev,
      name: product.name,
      category: product.category,
      measure: product.measure,
      autoFilled: true
    }));
  };

  const addToPantry = (product, quantity = 1, expiryDate = null) => {
    const existingItem = pantryItems.find(item => item.name === product.name);
    if (existingItem) {
      showNotification('Продукт уже в кладовой');
      return;
    }

    const defaultExpiry = expiryDate || new Date(Date.now() + product.shelfLife * 24 * 60 * 60 * 1000);
    const newItem = {
      id: Date.now(),
      ...product,
      quantity,
      expiryDate: defaultExpiry,
      autoFilled: !expiryDate
    };

    setPantryItems(prev => [...prev, newItem]);
    showNotification(`${product.name} добавлен в кладовую`);
    // scroll content to bottom so the newly added item is visible
    try {
      setTimeout(() => {
        if (contentRef?.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
        else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 50);
    } catch (e) { /* ignore */ }
  };

  const addToShopping = (product, quantity = 1) => {
    const existingItem = shoppingItems.find(item => item.name === product.name && !item.completed);
    if (existingItem) {
      const updatedItems = shoppingItems.map(item =>
        item.id === existingItem.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
      setShoppingItems(updatedItems);
      showNotification(`Количество ${product.name} увеличено`);
      return;
    }

    const newItem = {
      id: Date.now() + Math.random(),
      ...product,
      quantity,
      completed: false,
      addedAt: new Date()
    };

    setShoppingItems(prev => [...prev, newItem]);
    showNotification(`${product.name} добавлен в список покупок`);
    try {
      setTimeout(() => {
        if (contentRef?.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
        else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 50);
    } catch (e) {}
  };

  const handleAddProduct = () => {
    if (!addFormData.name) {
      showNotification('Введите название продукта');
      return;
    }

    const foundProduct = PRODUCTS_DB.find(p => p.name === addFormData.name);
    const selectedProduct = foundProduct || {
      name: addFormData.name,
      category: addFormData.category || '🏷️ Прочее',
      measure: addFormData.measure || 'шт.',
      shelfLife: 7
    };

    // If product exists in DB but user selected a different measure in the form,
    // respect user's measure and convert quantity to the stored measure (or store with user's measure).
    let measureToStore = selectedProduct.measure;
    // Allow the input to be an empty/partial string while typing; only coerce to number when storing
    let qtyToStore = Number(addFormData.quantity);
    const defaultStep = getQuantityStep(addFormData.measure || selectedProduct.measure) || 1;
    if (!isFinite(qtyToStore) || qtyToStore <= 0) qtyToStore = defaultStep;
    if (addFormData.measure) {
      // prefer to store the measure the user selected
      measureToStore = addFormData.measure;
      // if the DB product had a different measure and we want to keep DB measure, convert instead
      // but better to store as user selected measure so we don't surprise the user
    }
    // Build a product object that uses the chosen measure
    const productToUse = { ...selectedProduct, measure: measureToStore };

    const expiryDate = addFormData.expiryDate 
      ? new Date(addFormData.expiryDate)
      : new Date(Date.now() + selectedProduct.shelfLife * 24 * 60 * 60 * 1000);

    if (currentTab === 'pantry') {
      addToPantry(productToUse, qtyToStore, expiryDate);
    } else if (currentTab === 'shopping') {
      addToShopping(productToUse, qtyToStore);
    } else if (currentTab === 'favorites') {
      toggleFavoriteProduct(selectedProduct);
    }

    setShowAddModal(false);
    setAddFormData({
      name: '',
      category: '',
      measure: '',
      quantity: 1,
      expiryDate: '',
      autoFilled: false
    });
  };

  const toggleFavoriteProduct = (product) => {
    const isFavorite = favoriteProducts.some(fav => fav.name === product.name);
    if (isFavorite) {
      setFavoriteProducts(prev => prev.filter(fav => fav.name !== product.name));
      showNotification(`${product.name} удален из избранного`);
    } else {
      setFavoriteProducts(prev => [...prev, product]);
      showNotification(`${product.name} добавлен в избранное`);
    }
  };

  const toggleFavoriteRecipe = (recipe) => {
    const isFavorite = favoriteRecipes.some(fav => fav.id === recipe.id);
    if (isFavorite) {
      setFavoriteRecipes(prev => prev.filter(fav => fav.id !== recipe.id));
      showNotification(`${recipe.name} удален из избранного`);
    } else {
      setFavoriteRecipes(prev => [...prev, recipe]);
      showNotification(`${recipe.name} добавлен в избранное`);
    }
  };

  // Функции для работы с рецептами
  const getAvailableRecipes = () => {
    return RECIPES_DB.filter(recipe => {
      const availableIngredients = recipe.ingredients.filter(ingredient => {
        const pantryItem = pantryItems.find(item => item.name === ingredient.name);
        return pantryItem && pantryItem.quantity > 0;
      });
      return availableIngredients.length >= 2;
    });
  };

  const addRecipeToCart = (recipe) => {
    let addedCount = 0;
    let skippedCount = 0;
    
    recipe.ingredients.forEach(ingredient => {
  const pantryItem = pantryItems.find(item => item.name === ingredient.name);
  const pantryAvailable = pantryItem ? convertQuantity(pantryItem.quantity, pantryItem.measure, ingredient.measure) : 0;
  const needed = ingredient.amount - pantryAvailable;
      
      if (needed > 0) {
        // Проверяем, есть ли уже такой продукт в корзине
        const existingCartItem = shoppingItems.find(item => 
          item.name === ingredient.name && 
          item.note === `для ${recipe.name}`
        );
        
        if (existingCartItem) {
          skippedCount++;
        } else {
          // Найдем продукт в базе данных для получения правильной категории
          const productInDB = PRODUCTS_DB.find(p => p.name === ingredient.name);
          const category = productInDB ? productInDB.category : '🏷️ Прочее';
          
          const cartItem = {
            id: Date.now() + Math.random(),
            name: ingredient.name,
            category: category,
            measure: ingredient.measure,
            quantity: needed,
            note: `для ${recipe.name}`,
            completed: false
          };
          setShoppingItems(prev => [...prev, cartItem]);
          addedCount++;
        }
      }
    });
    
    if (addedCount > 0 && skippedCount > 0) {
      showNotification(`Добавлено ${addedCount} продуктов в корзину, ${skippedCount} уже были в корзине`);
    } else if (addedCount > 0) {
      showNotification(`Добавлено ${addedCount} продуктов в корзину`);
    } else if (skippedCount > 0) {
      showNotification('Все недостающие ингредиенты уже в корзине');
    } else {
      showNotification('Все ингредиенты уже есть в кладовой');
    }
  };

  const moveCompletedItemsToPantry = () => {
    const completedItems = shoppingItems.filter(item => item.completed);
    
    if (completedItems.length === 0) {
      showNotification('Нет отмеченных товаров для переноса');
      return;
    }

    // Переносим каждый купленный товар в кладовую
    completedItems.forEach(item => {
      const productInDB = PRODUCTS_DB.find(p => p.name === item.name);
      const shelfLife = productInDB ? productInDB.shelfLife : 7;
      const expiryDate = new Date(Date.now() + shelfLife * 24 * 60 * 60 * 1000);
      
      // Проверяем, есть ли уже такой продукт в кладовой
      const existingPantryItem = pantryItems.find(pantryItem => pantryItem.name === item.name);
      
      if (existingPantryItem) {
        // Увеличиваем количество существующего продукта — конвертируем меру при необходимости
        const addedQty = convertQuantity(item.quantity, item.measure, existingPantryItem.measure);
        const updatedPantryItems = pantryItems.map(pantryItem =>
          pantryItem.name === item.name
            ? { ...pantryItem, quantity: pantryItem.quantity + addedQty }
            : pantryItem
        );
        setPantryItems(updatedPantryItems);
      } else {
        // Добавляем новый продукт в кладовую
        const newPantryItem = {
          id: Date.now() + Math.random(),
          name: item.name,
          category: item.category,
          measure: item.measure,
          quantity: item.quantity,
          expiryDate: expiryDate,
          addedAt: new Date()
        };
        setPantryItems(prev => [...prev, newPantryItem]);
      }
    });

    // Удаляем отмеченные товары из списка покупок
    setShoppingItems(prev => prev.filter(item => !item.completed));
    
    showNotification(`${completedItems.length} товаров перенесено в кладовую`);
  };

  const deleteCustomRecipe = (recipeId) => {
    const recipe = customRecipes.find(r => r.id === recipeId);
    setDeletingRecipe(recipe);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteRecipe = () => {
    if (deletingRecipe) {
      setCustomRecipes(prev => prev.filter(recipe => recipe.id !== deletingRecipe.id));
      showNotification('Рецепт удален');
      setShowDeleteConfirmModal(false);
      setDeletingRecipe(null);
    }
  };

  const cancelDeleteRecipe = () => {
    setShowDeleteConfirmModal(false);
    setDeletingRecipe(null);
  };

  const addRecipeToMy = (recipe) => {
    // Проверяем, нет ли уже такого рецепта в пользовательских
    const exists = customRecipes.some(custom => custom.name === recipe.name);
    if (exists) {
      showNotification('Рецепт уже добавлен в "Мои рецепты"');
      return;
    }

    const newRecipe = {
      id: Date.now(),
      name: recipe.name,
      ingredients: [...recipe.ingredients],
      difficulty: recipe.difficulty,
      time: recipe.time,
      steps: [...recipe.steps],
      comments: '',
      image: recipe.image
    };
    
    setCustomRecipes(prev => [...prev, newRecipe]);
    showNotification('Рецепт добавлен в "Мои рецепты"');
  };

  const addCustomRecipe = async () => {
    if (editingRecipeId) {
      // Обновляем существующий рецепт
      const updatedRecipe = {
        ...recipeFormData,
        id: editingRecipeId,
        ingredients: recipeFormData.ingredients.filter(ing => ing.name && ing.amount > 0)
      };
      
      setCustomRecipes(prev => prev.map(recipe => 
        recipe.id === editingRecipeId ? updatedRecipe : recipe
      ));
      
      showNotification('Рецепт обновлен');
      setEditingRecipeId(null);
    } else {
      // Добавляем новый рецепт
      // Try to upload images to Supabase (if configured). We'll keep data URLs if upload is not possible.
      const toSave = { ...recipeFormData };
      const uploadBucket = 'recipes';

      const dataURLtoBlob = (dataurl) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
      };

      try {
        // Upload main image if it's a data URL
        if (supabase && toSave.image && toSave.image.startsWith('data:')) {
          const blob = dataURLtoBlob(toSave.image);
          const filePath = `recipe-${Date.now()}-main.png`;
          const { error: uploadError } = await supabase.storage.from(uploadBucket).upload(filePath, blob, { upsert: true });
          if (!uploadError) {
            const { data: pub } = await supabase.storage.from(uploadBucket).getPublicUrl(filePath);
            toSave.image = pub?.publicUrl || toSave.image;
          }
        }

        // Steps images
        if (supabase && Array.isArray(toSave.steps)) {
          for (let i = 0; i < toSave.steps.length; i++) {
            const step = toSave.steps[i];
            if (step && step.image && typeof step.image === 'string' && step.image.startsWith('data:')) {
              const blob = dataURLtoBlob(step.image);
              const filePath = `recipe-${Date.now()}-step-${i}.png`;
              const { error: uploadError } = await supabase.storage.from(uploadBucket).upload(filePath, blob, { upsert: true });
              if (!uploadError) {
                const { data: pub } = await supabase.storage.from(uploadBucket).getPublicUrl(filePath);
                toSave.steps[i] = { ...(toSave.steps[i] || {}), image: pub?.publicUrl || toSave.steps[i].image };
              }
            }
          }
        }
      } catch (err) {
        console.error('Image upload error', err);
        showNotification('Не удалось загрузить изображения — будут сохранены локально.');
      }

      const newRecipe = {
        id: Date.now(),
        ...toSave,
        ingredients: recipeFormData.ingredients.filter(ing => ing.name && ing.amount > 0)
      };
      setCustomRecipes(prev => [...prev, newRecipe]);
      showNotification('Рецепт добавлен');
    }
    
    setRecipeFormData({
      name: '',
      ingredients: [],
      difficulty: 'легкий',
      time: 30,
      steps: [{ text: '', image: '' }],
      comments: '',
      image: ''
    });
    setShowAddRecipeModal(false);
  };

  const editCustomRecipe = (recipe) => {
    setRecipeFormData({
      ...recipe,
      ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : [{ name: '', amount: 1, measure: 'г.' }],
      steps: recipe.steps && recipe.steps.length > 0
        ? recipe.steps.map((s) => (typeof s === 'string' ? { text: s, image: '' } : s))
        : [{ text: '', image: '' }]
    });
    setEditingRecipeId(recipe.id);
    setShowAddRecipeModal(true);
  };

  const getIngredientStatus = (ingredient) => {
    const pantryItem = pantryItems.find(item => item.name === ingredient.name);
    if (!pantryItem) return { status: 'missing', color: 'text-red-500' };
    const availableInIngredientUnit = convertQuantity(pantryItem.quantity, pantryItem.measure, ingredient.measure);
    if (availableInIngredientUnit >= ingredient.amount) return { status: 'available', color: 'text-green-500' };
    return { status: 'partial', color: 'text-yellow-500', available: availableInIngredientUnit };
  };

  const addMissingIngredientsToCart = (recipe) => {
    if (!recipe || !Array.isArray(recipe.ingredients)) {
      showNotification('У рецепта нет ингредиентов');
      return;
    }

    const normalizeName = (s) => {
      try {
        return String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      } catch (e) {
        return String(s).toLowerCase().trim();
      }
    };

    let added = 0;
    recipe.ingredients.forEach(ingredient => {
      if (!ingredient || !ingredient.name) return;
      const status = getIngredientStatus(ingredient);
      const needQuantity = status.status === 'missing' ? ingredient.amount : (status.status === 'partial' ? Math.max(0, ingredient.amount - (status.available || 0)) : 0);
      if (needQuantity <= 0) return;

      // robust product lookup by normalized name (exact or includes)
      const ingNameNorm = normalizeName(ingredient.name);
      let product = PRODUCTS_DB.find(p => normalizeName(p.name) === ingNameNorm);
      if (!product) {
        product = PRODUCTS_DB.find(p => normalizeName(p.name).includes(ingNameNorm) || ingNameNorm.includes(normalizeName(p.name)));
      }

      if (product) {
        // ensure quantity is a number
        const qty = typeof needQuantity === 'number' ? needQuantity : parseFloat(needQuantity) || 0;
        if (qty > 0) {
          addToShopping(product, qty);
          added++;
        }
      } else {
        // fallback: create a minimal product object when not found
        const fallback = { name: ingredient.name, measure: ingredient.measure || 'шт.' };
        addToShopping(fallback, needQuantity);
        added++;
      }
    });

    if (added > 0) {
      showNotification(`Добавлено ${added} ингредиентов в корзину`);
    } else {
      showNotification('Нет недостающих ингредиентов для добавления');
    }
  };

  const hasExpiredItems = pantryItems.some(item => item.expiryDate < new Date());

  // Функция для группировки продуктов по категориям
  const groupItemsByCategory = (items) => {
    return items.reduce((groups, item) => {
      const category = item.category || '🏷️ Прочее';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {});
  };

  // Функция для определения статуса срока годности
  const getExpiryStatus = (expiryDate) => {
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { status: 'expired', color: 'text-red-500', days: Math.abs(diffDays) };
    } else if (diffDays <= 3) {
      return { status: 'expiring', color: 'text-yellow-500', days: diffDays };
    } else {
      return { status: 'fresh', color: 'text-gray-600', days: diffDays };
    }
  };

  // Функция добавления продукта в корзину из кладовой
  const addPantryItemToCart = (item) => {
    const existingItem = shoppingItems.find(shopItem => shopItem.name === item.name && !shopItem.completed);
    if (existingItem) {
      showNotification(`${item.name} уже есть в списке покупок`);
      return;
    }
    
    const cartItem = {
      id: Date.now() + Math.random(),
      name: item.name,
      category: item.category,
      measure: item.measure,
      quantity: item.quantity,
      completed: false,
      addedAt: new Date()
    };
    
    setShoppingItems(prev => [...prev, cartItem]);
    showNotification(`${item.name} добавлен в список покупок`);
  };

  // Функция для получения информации о наличии продукта в кладовой
  const getPantryInfo = (productName) => {
    const pantryItem = pantryItems.find(item => item.name === productName);
    if (!pantryItem) return null;
    
    const expiryStatus = getExpiryStatus(pantryItem.expiryDate);
    return {
      quantity: pantryItem.quantity,
      measure: pantryItem.measure,
      expiryDate: pantryItem.expiryDate,
      expiryStatus,
      autoFilled: pantryItem.autoFilled
    };
  };

  // Функция добавления любимого продукта в корзину
  const addFavoriteProductToCart = (product) => {
    const existingItem = shoppingItems.find(shopItem => shopItem.name === product.name && !shopItem.completed);
    if (existingItem) {
      showNotification(`${product.name} уже есть в списке покупок`);
      return;
    }
    
    const cartItem = {
      id: Date.now() + Math.random(),
      name: product.name,
      category: product.category,
      measure: product.measure,
      quantity: 1,
      completed: false,
      addedAt: new Date()
    };
    
    setShoppingItems(prev => [...prev, cartItem]);
    showNotification(`${product.name} добавлен в список покупок`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isLoadingState && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow">
            <div className="text-gray-700 font-medium">Загрузка данных...</div>
          </div>
        </div>
      )}
      {/* Top Bar */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-center relative">
        <h1 className="text-lg font-semibold capitalize">
          {currentTab === 'pantry' && 'Кладовая'}
          {currentTab === 'favorites' && 'Избранное'}
          {currentTab === 'recipes' && 'Рецепты'}
          {currentTab === 'shopping' && 'Покупки'}
          {hasExpiredItems && currentTab === 'pantry' && (
            <span className="ml-2 text-orange-500">!</span>
          )}
        </h1>
      </div>

  {/* Content */}
  <div className="p-4 pb-28" ref={contentRef}>
        {/* Main Content */}
        <div className="space-y-4">
          {currentTab === 'pantry' && (
            <div>
              
              {pantryItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Кладовая пуста. Добавьте продукты!
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupItemsByCategory(pantryItems)).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {items.map(item => {
                          const expiryStatus = getExpiryStatus(item.expiryDate);
                          return (
                            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                          setEditingItem(item);
                                          setEditFormData({
                                            name: item.name,
                                            quantity: item.quantity,
                                            measure: item.measure,
                                            expiryDate: item.expiryDate.toISOString().split('T')[0]
                                          });
                                          setShowEditModal(true);
                                        }}
                                      className="font-semibold text-gray-900 capitalize hover:text-blue-600 transition-colors"
                                    >
                                      {item.name}
                                    </button>
                                    <button
                                      onClick={() => {
                                          setEditingItem(item);
                                          setEditFormData({
                                            name: item.name,
                                            quantity: item.quantity,
                                            measure: item.measure,
                                            expiryDate: item.expiryDate.toISOString().split('T')[0]
                                          });
                                          setShowEditModal(true);
                                        }}
                                      className="text-gray-400 hover:text-blue-600 transition-colors"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                  </div>
                                  
                                  <div className="text-sm mt-1">
                                    <span className="text-gray-700">
                                      {item.quantity} {item.measure}
                                    </span>
                                    <button
                                      onClick={() => handleDateClick(item)}
                                      className={`ml-3 ${expiryStatus.color} ${item.autoFilled ? 'italic' : ''} hover:underline cursor-pointer transition-all font-medium`}
                                      title="Изменить срок годности"
                                    >
                                      до {item.expiryDate.toLocaleDateString('ru-RU')}
                                    </button>
                                    <span className={`ml-1 ${expiryStatus.color} ${item.autoFilled ? 'italic' : ''}`}>
                                      ({expiryStatus.status === 'expired' 
                                        ? `просрочено ${expiryStatus.days} дн.` 
                                        : `${expiryStatus.days} дн.`})
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 ml-4">
                                  <button
                                    onClick={() => addPantryItemToCart(item)}
                                    className="text-blue-500 hover:text-blue-700 transition-colors"
                                    title="Добавить в покупки"
                                  >
                                    <ShoppingCart size={20} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const product = {
                                        name: item.name,
                                        category: item.category,
                                        measure: item.measure,
                                        shelfLife: item.shelfLife || 7
                                      };
                                      toggleFavoriteProduct(product);
                                    }}
                                    className={`transition-colors ${
                                      favoriteProducts.some(fav => fav.name === item.name) 
                                        ? 'text-red-500 hover:text-red-700' 
                                        : 'text-gray-400 hover:text-red-500'
                                    }`}
                                    title="Добавить в избранное"
                                  >
                                    <Heart size={20} fill={favoriteProducts.some(fav => fav.name === item.name) ? 'currentColor' : 'none'} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setPantryItems(prev => prev.filter(p => p.id !== item.id));
                                      showNotification(`${item.name} удален из кладовой`);
                                    }}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                    title="Удалить продукт"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentTab === 'shopping' && (
            <div>
              
              {/* Панель управления */}
              {shoppingItems.length > 0 && (
                <div className="flex flex-wrap items-stretch gap-3 bg-white rounded-xl p-4 shadow-sm mb-6">
                  <button
                    onClick={() => {
                      if (window.confirm('Удалить все товары из списка покупок?')) {
                        setShoppingItems([]);
                        showNotification('Список покупок очищен');
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-3 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                    Удалить всё
                  </button>
                  <button
                    onClick={moveCompletedItemsToPantry}
                    disabled={!shoppingItems.some(item => item.completed)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors ${
                      shoppingItems.some(item => item.completed)
                        ? 'bg-green-500 text-white hover:bg-green-600 shadow-md'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Check size={18} />
                    Перенести в кладовую
                  </button>
                  <button
                    onClick={() => {
                      const textList = `Закупись:\n${Object.entries(groupItemsByCategory(shoppingItems))
                        .map(([category, items]) => {
                          const categoryItems = items.map(item => 
                            `${item.completed ? '✓' : '•'} ${item.name} (${item.quantity} ${item.measure})${item.note ? ` - ${item.note}` : ''}`
                          ).join('\n');
                          return `${category}:\n${categoryItems}`;
                        }).join('\n\n')}`;
                      navigator.clipboard.writeText(textList).then(() => {
                        showNotification('Список скопирован в буфер обмена');
                      });
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <FileText size={16} />
                    Экспорт
                  </button>
                </div>
              )}

              {shoppingItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Список покупок пуст
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupItemsByCategory(shoppingItems)).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {items.map(item => (
                    <div key={item.id} className={`bg-white rounded-xl p-4 shadow-sm ${item.completed ? 'opacity-50' : ''}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              const updatedItems = shoppingItems.map(shopItem =>
                                shopItem.id === item.id
                                  ? { ...shopItem, completed: !shopItem.completed }
                                  : shopItem
                              );
                              setShoppingItems(updatedItems);
                            }}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                              item.completed 
                                ? 'bg-green-500 border-green-500 text-white shadow-md' 
                                : 'border-gray-300 hover:border-green-400 bg-white'
                            }`}
                            title={item.completed ? 'Отменить покупку' : 'Отметить как купленное'}
                          >
                            {item.completed && <Check size={14} />}
                          </button>
                          <div>
                            <div className={`font-semibold ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                              {item.name}
                              {item.note && (
                                <span className="text-gray-400 font-normal ml-2">
                                  ({item.note})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {item.quantity} {item.measure}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setEditFormData({
                                name: item.name,
                                quantity: item.quantity,
                                measure: item.measure,
                                expiryDate: ''
                              });
                              setShowEditModal(true);
                            }}
                            className="text-blue-500"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setShoppingItems(prev => prev.filter(s => s.id !== item.id));
                              showNotification('Продукт удален');
                            }}
                            className="text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}



          {currentTab === 'favorites' && (
            <div>

              <div className="space-y-6">
                {/* Любимые продукты */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Любимые продукты</h3>
                  {favoriteProducts.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      Нет любимых продуктов
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {favoriteProducts.map(product => {
                        const pantryInfo = getPantryInfo(product.name);
                        return (
                          <div key={product.name} className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 capitalize">
                                  {product.name}
                                </div>
                                
                                {/* Информация о наличии в кладовой */}
                                {pantryInfo ? (
                                  <div className="text-sm text-gray-600 mt-1">
                                    {pantryInfo.quantity} {pantryInfo.measure} • до {pantryInfo.expiryDate.toLocaleDateString('ru-RU')} ({pantryInfo.expiryStatus.days} дн.)
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-500 mt-1">
                                    Нет в кладовой
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 ml-4">
                                <button
                                  onClick={() => addFavoriteProductToCart(product)}
                                  className="text-blue-500 hover:text-blue-700 transition-colors"
                                  title="Добавить в покупки"
                                >
                                  <ShoppingCart size={20} />
                                </button>
                                <button
                                  onClick={() => toggleFavoriteProduct(product)}
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                  title="Удалить из избранного"
                                >
                                  <X size={20} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Любимые рецепты */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Любимые рецепты</h3>
                  {favoriteRecipes.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      Нет любимых рецептов
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {favoriteRecipes.map(recipe => (
                        <div key={recipe.id} className="bg-white rounded-xl p-4 shadow-sm">
                          <div className="flex gap-3">
                            <img 
                              src={recipe.image} 
                              alt={recipe.name}
                              className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                              onClick={() => {
                                setSelectedRecipe(recipe);
                                setShowRecipeModal(true);
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-gray-900">{recipe.name}</div>
                                <button
                                  onClick={() => {
                                    setSelectedRecipe(recipe);
                                    setShowRecipeModal(true);
                                  }}
                                  className="text-gray-500 hover:text-gray-700 transition-colors"
                                  title="Посмотреть рецепт"
                                >
                                  <Edit3 size={16} />
                                </button>
                              </div>
                              <div className="text-sm text-gray-600">{recipe.difficulty} • {recipe.time} мин</div>
                              
                              {/* Статус ингредиентов */}
                              <div className="text-xs text-gray-500 mt-1">
                                {recipe.ingredients.map(ingredient => {
                                  const status = getIngredientStatus(ingredient);
                                  return (
                                    <span key={ingredient.name} className={`mr-2 ${status.color}`}>
                                      {ingredient.name} ({ingredient.amount} {ingredient.measure})
                                      {status.status === 'partial' && ` - есть ${status.available} ${ingredient.measure}`}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => addMissingIngredientsToCart(recipe)}
                                className="text-blue-500 hover:text-blue-700 transition-colors"
                                title="Добавить недостающие ингредиенты в покупки"
                              >
                                <ShoppingCart size={20} />
                              </button>
                              <button
                                onClick={() => toggleFavoriteRecipe(recipe)}
                                className="text-red-500 hover:text-red-700 transition-colors"
                                title="Удалить из избранного"
                              >
                                <X size={20} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentTab === 'recipes' && (
            <div>
              {/* Возможные рецепты */}
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-4">Возможные рецепты</h2>
                <div className="space-y-4">
                  {getAvailableRecipes().map(recipe => (
                    <RecipeCard 
                      key={recipe.id} 
                      recipe={recipe} 
                      pantryItems={pantryItems}
                      isCustom={false}
                      onAddToCart={addRecipeToCart}
                      onToggleFavorite={toggleFavoriteRecipe}
                      onViewDetails={(recipe) => {
                        setSelectedRecipe(recipe);
                        setShowRecipeModal(true);
                      }}
                      onAddToMyRecipes={addRecipeToMy}
                      isFavorite={favoriteRecipes.some(fav => fav.id === recipe.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Мои рецепты */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Мои рецепты</h2>
                  <button
                    onClick={() => setShowAddRecipeModal(true)}
                    className="bg-blue-500 text-white p-3 rounded-full"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  {customRecipes.map(recipe => (
                    <RecipeCard 
                      key={recipe.id} 
                      recipe={recipe} 
                      pantryItems={pantryItems}
                      isCustom={true}
                      onAddToCart={addRecipeToCart}
                      onToggleFavorite={toggleFavoriteRecipe}
                      onViewDetails={(recipe) => {
                        setSelectedRecipe(recipe);
                        setShowRecipeModal(true);
                      }}
                      onEdit={editCustomRecipe}
                      onDelete={deleteCustomRecipe}
                      isFavorite={favoriteRecipes.some(fav => fav.id === recipe.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Add Button */}
      {(currentTab === 'pantry' || currentTab === 'shopping' || currentTab === 'favorites') && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-20 right-4 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-40"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="flex justify-around">
          <button
            onClick={() => setCurrentTab('pantry')}
            className={`flex flex-col items-center gap-1 relative ${currentTab === 'pantry' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <Home size={20} />
            <span className="text-xs">Кладовая</span>
            {hasExpiredItems && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                !
              </div>
            )}
          </button>
          <button
            onClick={() => setCurrentTab('favorites')}
            className={`flex flex-col items-center gap-1 ${currentTab === 'favorites' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <Heart size={20} />
            <span className="text-xs">Избранное</span>
          </button>
          <button
            onClick={() => setCurrentTab('recipes')}
            className={`flex flex-col items-center gap-1 ${currentTab === 'recipes' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <Book size={20} />
            <span className="text-xs">Рецепты</span>
          </button>
          <button
            onClick={() => setCurrentTab('shopping')}
            className={`flex flex-col items-center gap-1 relative ${currentTab === 'shopping' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <ShoppingCart size={20} />
            <span className="text-xs">Покупки</span>
            {shoppingItems.length > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {shoppingItems.length > 99 ? '99+' : shoppingItems.length}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {currentTab === 'pantry' && 'Добавить в кладовую'}
                {currentTab === 'shopping' && 'Добавить в покупки'}
                {currentTab === 'favorites' && 'Добавить в избранное'}
                {currentTab === 'recipes' && 'Добавить рецепт'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название продукта
                </label>
                <AutocompleteInput
                  value={addFormData.name}
                  onChange={(value) => setAddFormData(prev => ({ ...prev, name: value, autoFilled: false }))}
                  onSelect={handleProductSelect}
                  placeholder="Название продукта"
                  products={PRODUCTS_DB}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddFormData(prev => ({ 
                      ...prev, 
                      quantity: adjustQuantity(prev.quantity, prev.measure, false) 
                    }))}
                    className="bg-gray-200 text-gray-700 w-10 h-10 rounded-lg font-semibold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step={getQuantityStep(addFormData.measure)}
                    min={getQuantityStep(addFormData.measure)}
                    value={addFormData.quantity}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="flex-1 p-3 border border-gray-200 rounded-xl text-center"
                  />
                  <button
                    onClick={() => setAddFormData(prev => ({ 
                      ...prev, 
                      quantity: adjustQuantity(prev.quantity, prev.measure, true) 
                    }))}
                    className="bg-gray-200 text-gray-700 w-10 h-10 rounded-lg font-semibold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Мера измерения</label>
                <select
                  value={addFormData.measure}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, measure: e.target.value }))}
                  className={`w-full p-3 border border-gray-200 rounded-xl ${addFormData.autoFilled ? 'italic text-gray-600' : ''}`}
                >
                  <option value="">Выберите меру</option>
                  <option value="кг.">кг.</option>
                  <option value="г.">г.</option>
                  <option value="л.">л.</option>
                  <option value="шт.">шт.</option>
                  <option value="уп.">уп.</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                <select
                  value={addFormData.category}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, category: e.target.value }))}
                  className={`w-full p-3 border border-gray-200 rounded-xl ${addFormData.autoFilled ? 'italic text-gray-600' : ''}`}
                >
                  <option value="">Выберите категорию</option>
                  <option value="🥛 Молочные">🥛 Молочные</option>
                  <option value="🍞 Хлебобулочные">🍞 Хлебобулочные</option>
                  <option value="🥦 Овощи">🥦 Овощи</option>
                  <option value="🍎 Фрукты">🍎 Фрукты</option>
                  <option value="🌾 Крупы">🌾 Крупы</option>
                  <option value="🥩 Мясо">🥩 Мясо</option>
                  <option value="🥚 Яйца">🥚 Яйца</option>
                  <option value="🐟 Рыба">🐟 Рыба</option>
                  <option value="🏷️ Прочее">🏷️ Прочее</option>
                </select>
              </div>

              {currentTab === 'pantry' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Срок годности</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={addFormData.expiryDate}
                      onChange={(e) => setAddFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className={`w-full p-3 border border-gray-200 rounded-xl ${addFormData.autoFilled && !addFormData.expiryDate ? 'italic text-gray-600' : ''}`}
                    />
                  </div>
                  {addFormData.autoFilled && !addFormData.expiryDate && (
                    <div className="text-xs text-gray-500 italic mt-1">
                      Автоматически установится срок годности
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleAddProduct}
                className="w-full bg-blue-500 text-white p-3 rounded-xl font-semibold"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Редактировать продукт</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditFormData(prev => ({ 
                      ...prev, 
                      quantity: adjustQuantity(prev.quantity, prev.measure || editingItem.measure, false) 
                    }))}
                    className="bg-gray-200 text-gray-700 w-10 h-10 rounded-lg font-semibold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step={getQuantityStep(editFormData.measure || editingItem.measure)}
                    min={getQuantityStep(editFormData.measure || editingItem.measure)}
                    value={editFormData.quantity}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="flex-1 p-3 border border-gray-200 rounded-xl text-center"
                  />
                  <button
                    onClick={() => setEditFormData(prev => ({ 
                      ...prev, 
                      quantity: adjustQuantity(prev.quantity, prev.measure || editingItem.measure, true) 
                    }))}
                    className="bg-gray-200 text-gray-700 w-10 h-10 rounded-lg font-semibold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Мера измерения</label>
                <select
                  value={editFormData.measure}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, measure: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                >
                  <option value="">Выберите меру</option>
                  <option value="кг.">кг.</option>
                  <option value="г.">г.</option>
                  <option value="л.">л.</option>
                  <option value="мл.">мл.</option>
                  <option value="шт.">шт.</option>
                  <option value="уп.">уп.</option>
                </select>
              </div>

              {currentTab === 'pantry' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Срок годности</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={editFormData.expiryDate}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className="w-full p-3 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>
              )}

                <button
                onClick={() => {
                  if (currentTab === 'pantry') {
                    setPantryItems(prev => prev.map(item => 
                      item.id === editingItem.id 
                        ? {
                            ...item,
                            name: editFormData.name,
                            quantity: Number(editFormData.quantity) || item.quantity,
                            measure: editFormData.measure || item.measure,
                            expiryDate: new Date(editFormData.expiryDate),
                            autoFilled: false
                          }
                        : item
                    ));
                  } else if (currentTab === 'shopping') {
                    setShoppingItems(prev => prev.map(item => 
                      item.id === editingItem.id 
                        ? {
                            ...item,
                            name: editFormData.name,
                            quantity: Number(editFormData.quantity) || item.quantity,
                            measure: editFormData.measure || item.measure
                          }
                        : item
                    ));
                  }
                  setShowEditModal(false);
                  setEditingItem(null);
                  showNotification('Продукт обновлен');
                }}
                className="w-full bg-blue-500 text-white p-3 rounded-xl font-semibold"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {showRecipeModal && selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedRecipe.name}</h2>
              <button
                onClick={() => setShowRecipeModal(false)}
                className="text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
            
            <img 
              src={selectedRecipe.image} 
              alt={selectedRecipe.name}
              className="w-full h-48 rounded-xl object-cover mb-3"
            />
            
            {selectedRecipe.description && (
              <p className="text-sm text-gray-600 mb-3">
                {selectedRecipe.description}
              </p>
            )}
            
            <div className="space-y-4">
              <div>
                <p className="text-gray-600">Сложность: {selectedRecipe.difficulty}</p>
                <p className="text-gray-600">Время: {selectedRecipe.time} мин</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Тебе понадобится:</h3>
                <div className="space-y-1">
                  {selectedRecipe.ingredients.map(ingredient => {
                    const status = getIngredientStatus(ingredient);
                    return (
                      <div key={ingredient.name} className={`text-sm leading-snug ${status.color}`}>
                        {ingredient.name}: {ingredient.amount} {ingredient.measure}
                        {status.status === 'partial' && ` (есть ${status.available})`}
                        {status.status === 'missing' && ' (нужно купить)'}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    addMissingIngredientsToCart(selectedRecipe);
                    setShowRecipeModal(false);
                  }}
                  className="flex-1 bg-blue-500 text-white p-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} />
                  Добавить недостающие продукты в корзину
                </button>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Приготовление</h3>
                {selectedRecipe.steps.map((step, index) => {
                  const s = typeof step === 'string' ? { text: step, image: '' } : step || {};
                  return (
                    <div key={index} className="mb-3">
                      <div className="flex gap-3 items-start">
                        <div className="w-6 text-right font-semibold">{index + 1}.</div>
                        <div className="flex-1">
                          <div className="text-sm leading-snug">{s.text}</div>
                          {s.image && (
                            <img
                              src={s.image}
                              alt={`Шаг ${index + 1}`}
                              className="mt-2 w-full max-w-xs object-cover rounded-lg border"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Recipe Modal */}
      {showAddRecipeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingRecipeId ? 'Редактировать рецепт' : 'Добавить рецепт'}</h2>
              <button onClick={() => {
                setShowAddRecipeModal(false);
                setEditingRecipeId(null);
                setRecipeFormData({
                  name: '',
                  ingredients: [],
                  difficulty: 'легкий',
                  time: 30,
                  steps: [''],
                  comments: '',
                  image: ''
                });
              }} className="text-gray-500">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Название */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input
                  type="text"
                  value={recipeFormData.name}
                  onChange={(e) => setRecipeFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  placeholder="Введите название рецепта"
                />
              </div>

              {/* Ингредиенты */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ингредиенты *</label>
                <div className="space-y-2">
                  {recipeFormData.ingredients.map((ingredient, index) => (
                    <div key={index} className="flex gap-2">
                      <AutocompleteInput
                        value={ingredient.name || ''}
                        onChange={(value) => {
                          const newIngredients = [...recipeFormData.ingredients];
                          newIngredients[index] = { ...newIngredients[index], name: value };
                          setRecipeFormData(prev => ({ ...prev, ingredients: newIngredients }));
                        }}
                        onSelect={(product) => {
                          const newIngredients = [...recipeFormData.ingredients];
                          newIngredients[index] = { 
                            ...newIngredients[index], 
                            name: product.name,
                            measure: product.measure 
                          };
                          setRecipeFormData(prev => ({ ...prev, ingredients: newIngredients }));
                        }}
                        placeholder="Название продукта"
                        products={PRODUCTS_DB}
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={ingredient.amount || ''}
                        onChange={(e) => {
                          const newIngredients = [...recipeFormData.ingredients];
                          newIngredients[index] = { ...newIngredients[index], amount: parseFloat(e.target.value) || 0 };
                          setRecipeFormData(prev => ({ ...prev, ingredients: newIngredients }));
                        }}
                        className="w-20 p-2 border border-gray-200 rounded-lg text-sm"
                        placeholder="Кол-во"
                      />
                      <input
                        type="text"
                        value={ingredient.measure || ''}
                        onChange={(e) => {
                          const newIngredients = [...recipeFormData.ingredients];
                          newIngredients[index] = { ...newIngredients[index], measure: e.target.value };
                          setRecipeFormData(prev => ({ ...prev, ingredients: newIngredients }));
                        }}
                        className="w-16 p-2 border border-gray-200 rounded-lg text-sm"
                        placeholder="Ед."
                      />
                      <button
                        onClick={() => {
                          const newIngredients = recipeFormData.ingredients.filter((_, i) => i !== index);
                          setRecipeFormData(prev => ({ ...prev, ingredients: newIngredients }));
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setRecipeFormData(prev => ({
                        ...prev,
                        ingredients: [...prev.ingredients, { name: '', amount: 0, measure: '' }]
                      }));
                    }}
                    className="text-blue-500 text-sm flex items-center gap-1"
                  >
                    <Plus size={16} /> Добавить ингредиент
                  </button>
                </div>
              </div>

              {/* Сложность и время */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Сложность</label>
                  <select
                    value={recipeFormData.difficulty}
                    onChange={(e) => setRecipeFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                  >
                    <option value="легкий">Легкий</option>
                    <option value="средний">Средний</option>
                    <option value="сложный">Сложный</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Время (мин)</label>
                  <input
                    type="number"
                    min="1"
                    value={recipeFormData.time}
                    onChange={(e) => setRecipeFormData(prev => ({ ...prev, time: parseInt(e.target.value) || 30 }))}
                    className="w-full p-3 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Этапы */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Этапы приготовления</label>
                <div className="space-y-2">
                  {recipeFormData.steps.map((step, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <span className="text-sm text-gray-500 mt-3">{index + 1}.</span>
                      <div className="flex-1">
                        <textarea
                          value={(step && step.text) || ''}
                          onChange={(e) => {
                            const newSteps = [...recipeFormData.steps];
                            newSteps[index] = { ...(newSteps[index] || {}), text: e.target.value };
                            setRecipeFormData(prev => ({ ...prev, steps: newSteps }));
                          }}
                          className="w-full p-2 border border-gray-200 rounded-lg resize-none"
                          rows="2"
                          placeholder="Описание этапа"
                        />

                        {step && step.image && (
                          <div className="relative mt-2">
                            <img src={step.image} alt={`Шаг ${index + 1}`} className="w-full max-w-xs h-28 object-cover rounded-lg border" />
                            <button
                              onClick={() => {
                                const newSteps = [...recipeFormData.steps];
                                newSteps[index] = { ...(newSteps[index] || {}), image: '' };
                                setRecipeFormData(prev => ({ ...prev, steps: newSteps }));
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                              title="Удалить фото этапа"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}

                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                showNotification('Файл слишком большой. Максимум 5MB.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const newSteps = [...recipeFormData.steps];
                                newSteps[index] = { ...(newSteps[index] || {}), image: event.target.result };
                                setRecipeFormData(prev => ({ ...prev, steps: newSteps }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full mt-2 p-2 border border-gray-200 rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-gray-50"
                        />
                      </div>

                      <button
                        onClick={() => {
                          const newSteps = recipeFormData.steps.filter((_, i) => i !== index);
                          setRecipeFormData(prev => ({ ...prev, steps: newSteps.length ? newSteps : [{ text: '', image: '' }] }));
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setRecipeFormData(prev => ({
                        ...prev,
                        steps: [...prev.steps, '']
                      }));
                    }}
                    className="text-blue-500 text-sm flex items-center gap-1"
                  >
                    <Plus size={16} /> Добавить этап
                  </button>
                </div>
              </div>

              {/* Фото рецепта */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Фото рецепта</label>
                <div className="space-y-3">
                  {recipeFormData.image && (
                    <div className="relative">
                      <img 
                        src={recipeFormData.image} 
                        alt="Фото рецепта" 
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <button
                        onClick={() => setRecipeFormData(prev => ({ ...prev, image: '' }))}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        title="Удалить фото"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          showNotification('Файл слишком большой. Максимум 5MB.');
                          return;
                        }
                        
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setRecipeFormData(prev => ({ ...prev, image: event.target.result }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full p-3 border border-gray-200 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-gray-500">
                    Поддерживаются форматы: JPG, PNG, GIF. Максимум 5MB.
                  </p>
                </div>
              </div>

              {/* Комментарии */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Комментарии</label>
                <textarea
                  value={recipeFormData.comments}
                  onChange={(e) => setRecipeFormData(prev => ({ ...prev, comments: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl resize-none"
                  rows="3"
                  placeholder="Дополнительные комментарии или советы"
                />
              </div>

              {/* Кнопки */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddRecipeModal(false);
                    setEditingRecipeId(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-xl font-semibold"
                >
                  Отмена
                </button>
                <button
                  onClick={addCustomRecipe}
                  disabled={!recipeFormData.name || recipeFormData.ingredients.filter(ing => ing.name && ing.amount > 0).length === 0}
                  className="flex-1 bg-blue-500 text-white p-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  {editingRecipeId ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Edit Modal */}
      {showDateModal && editingDateProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Изменить срок годности</h2>
              <button 
                onClick={() => {
                  setShowDateModal(false);
                  setEditingDateProduct(null);
                }} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                Продукт: <span className="font-medium">{editingDateProduct.name}</span>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Текущий срок: до {editingDateProduct.expiryDate.toLocaleDateString('ru-RU')}
              </p>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Новый срок годности
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                defaultValue={editingDateProduct.expiryDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    updateExpiryDate(e.target.value);
                  }
                }}
                className="w-full p-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>

            <button
              onClick={() => {
                setShowDateModal(false);
                setEditingDateProduct(null);
              }}
              className="w-full bg-gray-200 text-gray-700 p-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && deletingRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-red-600">Удалить рецепт?</h2>
              <button 
                onClick={cancelDeleteRecipe}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">Вы действительно хотите удалить рецепт:</p>
              <p className="font-semibold text-gray-900 whitespace-pre-line">
                {formatTextWithLineBreaks(deletingRecipe.name)}
              </p>
              <p className="text-red-500 text-sm mt-2">Это действие нельзя отменить!</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmDeleteRecipe}
                className="flex-1 bg-red-500 text-white p-3 rounded-xl font-semibold hover:bg-red-600 transition-colors"
              >
                Удалить
              </button>
              <button
                onClick={cancelDeleteRecipe}
                className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Notification */}
      {notification && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                <Check size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-gray-700 font-medium">{notification}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OlivierApp;
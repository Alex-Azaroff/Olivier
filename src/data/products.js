/*
  Каталог продуктов и список категорий для правок без изменения UI-кода:
  src/data/products.json

  Поля:
  - version — номер схемы (при необходимости миграций).
  - categories — порядок категорий в выпадающих списках (значение = строка с эмодзи и названием).
  - products — массив { name, category, measure, shelfLife }.

  После правок перезапустите dev или выполните npm run build.
*/

import productCatalog from './products.json';

const categories = Array.isArray(productCatalog.categories)
  ? [...productCatalog.categories]
  : [];
const products = Array.isArray(productCatalog.products) ? productCatalog.products : [];

/** Все категории из каталога + любые встречающиеся у продуктов, но не занесённые в categories */
const categorySet = new Set(categories);
products.forEach((p) => {
  if (p && p.category) categorySet.add(p.category);
});
const extra = [...categorySet].filter((c) => !categories.includes(c)).sort();

export const PRODUCT_CATEGORIES = [...categories, ...extra];

export const PRODUCTS_DB = products;

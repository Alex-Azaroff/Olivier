import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Home, Book, BookOpen, ShoppingCart, User, Plus, Edit3, Trash2, Calendar, Check, X, Share2, ScanLine, Loader2, Upload, ChevronDown } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { supabase } from './src/supabaseClient';
// recipes.json больше не используется — единый источник Supabase
import { PRODUCTS_DB, PRODUCT_CATEGORIES } from './src/data/products';
import { MEAL_CATEGORIES, MEAL_DEFAULT_DAYS_BY_CATEGORY } from './src/data/meals';

/** Пресет числа порций при добавлении готового блюда (по категории) */
const MEAL_DEFAULT_PORTIONS_BY_CATEGORY = {
  Суп: 4,
  Гарнир: 3,
  Мясо: 3,
  Рыба: 3,
  Салат: 2,
  Десерт: 6
};
const defaultMealPortionsForCategory = (cat) => MEAL_DEFAULT_PORTIONS_BY_CATEGORY[cat] ?? 3;

/** Username бота без @ — для ссылок t.me/.../startapp= (можно задать VITE_TELEGRAM_BOT_USERNAME) */
const TELEGRAM_BOT_USERNAME =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_USERNAME) || 'ZayKypi_Bot';

const buildFridgeInviteTelegramLink = (inviteCode) => {
  const code = String(inviteCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) return '';
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=join_${code}`;
};

// Единицы: масса в г, объём в мл (фактор — во сколько раз умножить количество в этой мере, чтобы получить базу).
// 1 кг = 1000 г; 1 г = 1000 мг; 1 л = 1000 мл; 1 мл = 1 см³.
// Кухня (объём): ч.л. 5 мл, ст.л. 15 мл, стакан 250 мл. Ориентиры массы (г) для воды/муки/сахара — см. recipes.js.
const UNIT_MAP = {
  'мг.': { type: 'mass', factor: 0.001 },
  'г.': { type: 'mass', factor: 1 },
  'кг.': { type: 'mass', factor: 1000 },
  'мл.': { type: 'volume', factor: 1 },
  'л.': { type: 'volume', factor: 1000 },
  'см³.': { type: 'volume', factor: 1 },
  'ч.л.': { type: 'volume', factor: 5 },
  'ст.л.': { type: 'volume', factor: 15 },
  'стакан.': { type: 'volume', factor: 250 },
  'шт.': { type: 'count', factor: 1 }
};

const normalizeMeasure = (m) => {
  if (!m) return '';
  const raw = String(m).trim().toLowerCase();
  const s = raw.replace(/\.$/, '');

  if (s === 'мл' || s === 'ml') return 'мл.';
  if (s === 'л' || s === 'l') return 'л.';
  if (s === 'мг' || s === 'mg') return 'мг.';
  if (s === 'кг' || s === 'kg') return 'кг.';
  if (s === 'г' || s === 'g') return 'г.';
  if (s === 'см³' || s === 'см3' || s === 'cm3' || s === 'cm³') return 'см³.';
  if (s === 'ч.л' || s === 'ч л' || s === 'tl' || s === 'tsp') return 'ч.л.';
  if (s === 'ст.л' || s === 'ст л' || s === 'tbsp') return 'ст.л.';
  if (s === 'стакан') return 'стакан.';
  if (s === 'шт' || s === 'pcs') return 'шт.';
  return raw.endsWith('.') ? raw : raw ? raw + '.' : '';
};

/** Строка inventory (Supabase) → объект для UI кладовой */
const mapInventoryRowToPantryItem = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category || '🏷️ Прочее',
  measure: normalizeMeasure(row.measure) || row.measure || 'шт.',
  quantity: Number(row.quantity) || 0,
  expiryDate: row.expiry_date ? new Date(row.expiry_date) : null,
  shelfLife: row.shelf_life != null ? row.shelf_life : 7,
  autoFilled: Boolean(row.auto_filled),
  addedAt: row.created_at ? new Date(row.created_at) : undefined
});

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
  const u = normalizeMeasure(measure);
  if (u === 'л.') return 0.1;
  if (u === 'мл.' || u === 'см³.') return 50;
  if (u === 'кг.') return 0.1;
  if (u === 'г.') return 10;
  if (u === 'мг.') return 100;
  if (u === 'ч.л.') return 0.5;
  if (u === 'ст.л.') return 0.5;
  if (u === 'стакан.') return 0.25;
  if (u === 'шт.') return 1;
  return 1;
};

// Format quantities for display: choose sensible decimals per measure and trim trailing zeros
const formatQuantityForDisplay = (quantity, measure) => {
  const q = Number(quantity);
  if (!isFinite(q)) return '0';
  const m = normalizeMeasure(measure);
  // For small-unit integer measures show integer
  if (m === 'г.' || m === 'мл.' || m === 'см³.' || m === 'мг.' || m === 'шт.' || m === 'уп.') {
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

// Порция по умолчанию для единицы измерения (если у продукта нет явного поля portion)
const getDefaultPortion = (measure) => {
  const m = normalizeMeasure(measure);
  if (m === 'шт.')     return 1;
  if (m === 'г.')      return 50;
  if (m === 'кг.')     return 0.1;
  if (m === 'мл.')     return 200;
  if (m === 'л.')      return 0.2;
  if (m === 'мг.')     return 1000;
  if (m === 'ч.л.')    return 1;
  if (m === 'ст.л.')   return 1;
  if (m === 'стакан.') return 1;
  return 1;
};


// Компонент для поля с автозаполнением
/**
 * Модальный оверлей со сканером штрихкодов (ZXing, поддерживает EAN-13/UPC/QR).
 * @param {{ onDetected: (code: string) => void, onClose: () => void }} props
 */
const BarcodeScannerModal = ({ onDetected, onClose }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let stopped = false;

    reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      videoRef.current,
      (result, err) => {
        if (stopped) return;
        if (result) {
          stopped = true;
          try { reader.reset(); } catch {}
          onDetected(result.getText());
        } else if (err && !(err instanceof NotFoundException)) {
          setError('Нет доступа к камере. Разрешите доступ и попробуйте снова.');
        }
      }
    ).catch(() => {
      setError('Нет доступа к камере. Разрешите доступ и попробуйте снова.');
    });

    return () => {
      stopped = true;
      try { reader.reset(); } catch {}
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[80]">
      {/* Заголовок */}
      <div className="flex items-center justify-between px-4 py-3 bg-black bg-opacity-70">
        <span className="text-white font-semibold text-sm">Наведите камеру на штрихкод</span>
        <button onClick={onClose} className="text-white p-1">
          <X size={24} />
        </button>
      </div>

      {/* Видео */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" />
        {/* Прицел */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-40 border-2 border-white rounded-xl opacity-80" />
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="px-4 py-3 bg-red-600 text-white text-sm text-center">{error}</div>
      )}
      <div className="px-4 py-3 bg-black bg-opacity-70 text-center">
        <span className="text-gray-300 text-xs">EAN-13 · UPC · QR</span>
      </div>
    </div>
  );
};

const AutocompleteInput = ({ value, onChange, onSelect, placeholder, products }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef(null);
  const safeProducts = Array.isArray(products) ? products : [];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
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

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSuggestions([]);
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && showSuggestions) {
      // Закрыть подсказки и оставить введённый текст (продукт не из базы)
      setShowSuggestions(false);
      setSuggestions([]);
      e.preventDefault();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className="w-full p-3 border border-gray-200 rounded-xl"
      />
      
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-[220px] overflow-y-auto">
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

// Сопоставление ингредиента рецепта с кладовой (точное имя + те же эвристики, что для «возможных рецептов»)
const INGREDIENT_SYNONYMS = {
  цукини: ['кабачки', 'кабачок'],
  кабачки: ['цукини', 'кабачок'],
  кабачок: ['цукини', 'кабачки'],
  'бобы эдамаме': ['эдамаме', 'эдам', 'соевые бобы'],
  эдамаме: ['бобы эдамаме', 'эдам', 'соевые бобы'],
  'апельсиновый фреш': ['апельсиновый сок', 'апельсины', 'апельсин'],
  'жареные тыквенные семечки': ['семечки', 'тыквенные семечки', 'семечки тыквенные'],
  'тыквенные семечки': ['семечки', 'жареные тыквенные семечки'],
  мед: ['мед цветочный', 'мед натуральный', 'мёд', 'мед гречишный'],
  'оливковое масло': ['оливковое масло ev', 'масло оливковое', 'extra virgin olive oil'],
  'огурцы свежие': ['огурцы'],
  томаты: ['помидоры', 'томат'],
  помидоры: ['томаты', 'томат'],
  лук: ['лук репчатый', 'лук белый'],
  'лук репчатый': ['лук', 'лук белый'],
  чеснок: ['чеснок свежий'],
  молоко: ['молоко пастеризованное', 'молоко ультрапастеризованное'],
  'масло сливочное': ['масло сливочное 82.5%', 'масло сливочное 72%'],
  пармезан: ['пармезано реджано', 'сыр пармезан']
};

const normalizeIngredientName = (s) => {
  try {
    return String(s)
      .toLowerCase()
      .normalize('NFC')
      .replace(/ё/g, 'е')
      .replace(/[^а-яa-z0-9]+/gi, ' ')
      .trim();
  } catch {
    return String(s).toLowerCase().trim();
  }
};

const findPantryItemForIngredientInList = (pantryItems, ingredientName) => {
  if (!Array.isArray(pantryItems) || !ingredientName) return null;
  const norm = normalizeIngredientName(ingredientName);
  const ingWords = norm.split(' ').filter((w) => w.length >= 3);

  return (
    pantryItems.find((item) => {
      const itemNorm = normalizeIngredientName(item.name);
      if (itemNorm === norm) return true;
      const minLen = Math.min(itemNorm.length, norm.length);
      if (minLen >= 4 && (itemNorm.includes(norm) || norm.includes(itemNorm))) return true;
      const synonyms = INGREDIENT_SYNONYMS[norm] || [];
      if (synonyms.includes(itemNorm)) return true;
      const reverseSynonyms = INGREDIENT_SYNONYMS[itemNorm] || [];
      if (reverseSynonyms.includes(norm)) return true;
      const pantryWords = itemNorm.split(' ').filter((w) => w.length >= 3);
      return ingWords.some((iw) =>
        pantryWords.some((pw) => {
          if (iw === pw) return true;
          const prefixLen = Math.min(iw.length, pw.length, 5);
          return prefixLen >= 4 && iw.slice(0, prefixLen) === pw.slice(0, prefixLen);
        })
      );
    }) || null
  );
};

/** Единая логика: есть ли в кладовой строка для ингредиента и хватает ли количества */
const getIngredientPantryMatch = (pantryItems, ingredient) => {
  if (!ingredient || !Array.isArray(pantryItems)) return { kind: 'missing' };
  const needAmount = Number(ingredient.amount);
  const need = isFinite(needAmount) ? needAmount : 0;
  const ingMeasure = ingredient.measure || 'шт.';

  const exact = pantryItems.find(
    (item) => item.name === ingredient.name && Number(item.quantity) > 0
  );
  let pantryItem = exact;
  if (!pantryItem) {
    const f = findPantryItemForIngredientInList(pantryItems, ingredient.name);
    if (f && Number(f.quantity) > 0) pantryItem = f;
  }
  if (!pantryItem) return { kind: 'missing' };

  const availableInIngredientUnit = convertQuantity(
    Number(pantryItem.quantity),
    pantryItem.measure,
    ingMeasure
  );
  if (!isFinite(availableInIngredientUnit) || availableInIngredientUnit <= 0) {
    return { kind: 'missing' };
  }
  if (need <= 0 || availableInIngredientUnit >= need) return { kind: 'available' };
  return { kind: 'partial', available: availableInIngredientUnit };
};

// Компонент карточки рецепта
const RecipeCard = ({ recipe, pantryItems, isCustom, onAddToCart, onToggleFavorite, onViewDetails, onDelete, onAddToMyRecipes, onEdit, isFavorite, deleteTitle, prioritizeAvailableIngredients = false }) => {
  const getIngredientStatus = (ingredient) => {
    const m = getIngredientPantryMatch(pantryItems, ingredient);
    if (m.kind === 'missing') {
      return { status: 'missing', color: 'bg-gray-200 text-gray-700' };
    }
    if (m.kind === 'available') {
      return { status: 'available', color: 'bg-green-200 text-green-800' };
    }
    return {
      status: 'partial',
      color: 'bg-orange-200 text-orange-800',
      available: m.available
    };
  };

  const missingIngredients = recipe.ingredients.filter(ingredient => {
    const status = getIngredientStatus(ingredient);
    return status.status === 'missing' || status.status === 'partial';
  });

  const ingredientsForPreview = (() => {
    if (!prioritizeAvailableIngredients) return recipe.ingredients;
    const statusRank = { available: 0, partial: 1, missing: 2 };
    return [...recipe.ingredients].sort((a, b) => {
      const aRank = statusRank[getIngredientStatus(a).status] ?? 99;
      const bRank = statusRank[getIngredientStatus(b).status] ?? 99;
      return aRank - bRank;
    });
  })();

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
         onClick={(e) => {
           // Если клик по кнопкам - не открывать модал
           if (e.target.closest('button')) return;
           onViewDetails && onViewDetails(recipe);
         }}>
      <div className="flex gap-3">
        {/* Картинка */}
        <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
          {recipe.image ? (
            <img
              src={recipe.image}
              alt={recipe.name}
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <span className="text-2xl">🍽️</span>
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

          {/* Ингредиенты (не более 5 в карточке) */}
          {(() => {
            const MAX_VISIBLE = 5;
            const visible = ingredientsForPreview.slice(0, MAX_VISIBLE);
            const hiddenCount = ingredientsForPreview.length - MAX_VISIBLE;
            return (
              <div className="flex flex-wrap gap-1 overflow-hidden max-h-[52px]">
                {visible.map((ingredient, index) => {
                  const status = getIngredientStatus(ingredient);
                  const isLastVisible = index === visible.length - 1;
                  return (
                    <span
                      key={index}
                      className={`text-xs px-2 py-1 rounded-full ${status.color}`}
                    >
                      {ingredient.name} {ingredient.amount}{ingredient.measure}
                      {status.status === 'partial' && (
                        ` (нед: ${formatQuantityForDisplay(Math.max(0, ingredient.amount - (status.available || 0)), ingredient.measure)}${ingredient.measure})`
                      )}
                      {hiddenCount > 0 && isLastVisible && ` и ещё ${hiddenCount}`}
                    </span>
                  );
                })}
              </div>
            );
          })()}
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
          {onDelete && (
            <button
              onClick={() => onDelete(recipe)}
              className="text-gray-400 hover:text-red-500"
              title={deleteTitle || 'Удалить рецепт'}
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

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateInviteCode = () =>
  Array.from({ length: 6 }, () => INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]).join('');

/** Зачёркивание в plain text (как визуально в списке) — комбинирующий штрих после каждого символа */
const U_COMBINING_LONG_STRIKE = '\u0336';
const plainTextStrikethrough = (s) =>
  [...String(s)].map((ch) => (ch === '\n' || ch === '\r' ? ch : ch + U_COMBINING_LONG_STRIKE)).join('');

const formatShoppingExportLine = (item) => {
  const body = `${item.name} (${item.quantity} ${item.measure})${item.note ? ` - ${item.note}` : ''}`;
  const text = item.completed ? plainTextStrikethrough(body) : body;
  return `${item.completed ? '✓' : '•'} ${text}`;
};

const SWIPE_DELETE_MAX_PX = 88;
const SWIPE_DELETE_TRIGGER_PX = 44;

/**
 * Свайп влево — удаление (touch). Вертикальный скролл не блокируется, пока жест не распознан как горизонтальный.
 */
const SwipeToDeleteRow = ({ children, onDelete, disabled = false, className = '' }) => {
  const [tx, setTx] = useState(0);
  const [moving, setMoving] = useState(false);
  const innerRef = useRef(null);
  const txRef = useRef(0);
  const axisRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  useEffect(() => {
    txRef.current = tx;
  }, [tx]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el || disabled) return undefined;

    const onStart = (e) => {
      if (!e.touches?.length) return;
      axisRef.current = null;
      setMoving(true);
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onMove = (e) => {
      if (!e.touches?.length) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - startRef.current.x;
      const dy = y - startRef.current.y;
      if (axisRef.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (axisRef.current === 'h') {
        e.preventDefault();
        const t = Math.min(0, Math.max(-SWIPE_DELETE_MAX_PX, dx));
        txRef.current = t;
        setTx(t);
      }
    };
    const onEnd = () => {
      if (axisRef.current === 'h' && txRef.current <= -SWIPE_DELETE_TRIGGER_PX) {
        onDeleteRef.current?.();
      }
      setMoving(false);
      txRef.current = 0;
      setTx(0);
      axisRef.current = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [disabled]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="absolute inset-y-0 right-0 w-[5.25rem] flex items-center justify-center bg-red-500 text-white text-[11px] font-semibold leading-tight pointer-events-none z-0"
        aria-hidden
      >
        Удалить
      </div>
      <div
        ref={innerRef}
        className="relative z-[1] bg-white shadow-sm rounded-xl select-none"
        style={{
          transform: `translateX(${tx}px)`,
          transition: moving ? 'none' : 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
};

const hydrateAppState = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    pantryItems: (raw.pantryItems || []).map((item) => ({
      ...item,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
    })),
    preparedMeals: (raw.preparedMeals || []).map((meal) => ({
      ...meal,
      preparedDate: meal.preparedDate ? new Date(meal.preparedDate) : null,
      expiresAt: meal.expiresAt ? new Date(meal.expiresAt) : null
    })),
    shoppingItems: raw.shoppingItems || [],
    favoriteProducts: raw.favoriteProducts || [],
    favoriteRecipes: raw.favoriteRecipes || [],
    favoriteMeals: raw.favoriteMeals || [],
    customRecipes: raw.customRecipes || []
  };
};

const OlivierApp = () => {
  const tg = window.Telegram?.WebApp;
  const tgTelegramUserId = tg?.initDataUnsafe?.user?.id?.toString() || null;
  const [webTelegramUserId, setWebTelegramUserId] = useState(null);
  const telegramUserId = tgTelegramUserId || webTelegramUserId;

  const refreshWebAuthUser = useCallback(async () => {
    if (tgTelegramUserId) return;
    try {
      const r = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (j?.telegram_user_id) {
        setWebTelegramUserId(String(j.telegram_user_id));
      }
    } catch {
      /* no-op */
    }
  }, [tgTelegramUserId]);

  useEffect(() => {
    refreshWebAuthUser();
  }, [refreshWebAuthUser]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('auth') !== 'failed') return;
    showNotification('Вход не подтверждён. Попробуйте ещё раз.');
    p.delete('auth');
    const q = p.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** В Telegram — отступ от верха WebView (contentSafeArea / запас); до mount эффекта не оставлять 10px */
  const [telegramHeaderPadPx, setTelegramHeaderPadPx] = useState(() =>
    typeof window !== 'undefined' && window.Telegram?.WebApp ? 46 : 0
  );

  useEffect(() => {
    const w = window.Telegram?.WebApp;
    const sync = () => {
      if (!w) {
        setTelegramHeaderPadPx(0);
        return;
      }
      const c = Number(w.contentSafeAreaInset?.top);
      const s = Number(w.safeAreaInset?.top);
      const fromApi = Math.max(
        Number.isFinite(c) ? c : 0,
        Number.isFinite(s) ? s : 0
      );
      if (fromApi > 0) {
        setTelegramHeaderPadPx(Math.ceil(fromApi) + 6);
        return;
      }
      setTelegramHeaderPadPx(46);
    };
    sync();
    if (!w) return undefined;
    w.onEvent?.('viewportChanged', sync);
    try {
      w.onEvent?.('safeAreaChanged', sync);
      w.onEvent?.('contentSafeAreaChanged', sync);
    } catch (_) {
      /* старые клиенты */
    }
    return () => {
      w.offEvent?.('viewportChanged', sync);
      try {
        w.offEvent?.('safeAreaChanged', sync);
        w.offEvent?.('contentSafeAreaChanged', sync);
      } catch (_) {
        /* */
      }
    };
  }, []);

  const getLocalKey = (userId, fridgeId = null) =>
    fridgeId ? `olivier_state_${userId || 'anon'}_fridge_${fridgeId}` : `olivier_state_${userId || 'anon'}`;

  const loadLocalState = (userId, fridgeId = null) => {
    try {
      const key = getLocalKey(userId, fridgeId);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      if (parsed.pantryItems) {
        parsed.pantryItems = parsed.pantryItems.map((item) => ({
          ...item,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
        }));
      }
      if (parsed.preparedMeals) {
        parsed.preparedMeals = parsed.preparedMeals.map((meal) => ({
          ...meal,
          preparedDate: meal.preparedDate ? new Date(meal.preparedDate) : null,
          expiresAt: meal.expiresAt ? new Date(meal.expiresAt) : null
        }));
      }
      return parsed;
    } catch (e) {
      console.error('Error loading local state', e);
      return null;
    }
  };

  const saveLocalState = (stateObj, userId, fridgeId = null) => {
    try {
      const key = getLocalKey(userId, fridgeId);
      const toSave = JSON.parse(JSON.stringify(stateObj));
      if (toSave.pantryItems) {
        toSave.pantryItems = toSave.pantryItems.map((item) => ({
          ...item,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null
        }));
      }
      if (toSave.preparedMeals) {
        toSave.preparedMeals = toSave.preparedMeals.map((meal) => ({
          ...meal,
          preparedDate: meal.preparedDate ? new Date(meal.preparedDate).toISOString() : null,
          expiresAt: meal.expiresAt ? new Date(meal.expiresAt).toISOString() : null
        }));
      }
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.error('Error saving local state', e);
    }
  };

  const getLinkedSharedKey = (userId) => `olivier_linked_shared_${userId || 'anon'}`;
  const loadLinkedSharedFridgeId = (userId) => {
    try {
      if (!userId) return null;
      return localStorage.getItem(getLinkedSharedKey(userId)) || null;
    } catch {
      return null;
    }
  };
  const persistLinkedSharedFridgeId = (userId, fridgeId) => {
    try {
      if (!userId) return;
      const k = getLinkedSharedKey(userId);
      if (fridgeId) localStorage.setItem(k, fridgeId);
      else localStorage.removeItem(k);
    } catch (e) {
      console.error('persist linked shared', e);
    }
  };

  const [currentTab, setCurrentTab] = useState('pantry');
  const [pantrySubTab, setPantrySubTab] = useState('products'); // 'products' | 'meals'
  const contentRef = useRef(null);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [stateError, setStateError] = useState(null);
  const [pantryItems, setPantryItems] = useState([]);
  const [preparedMeals, setPreparedMeals] = useState([]);
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
  const [favoriteMeals, setFavoriteMeals] = useState([]);
  const [customRecipes, setCustomRecipes] = useState([]);
  const [showRecipeLibrary, setShowRecipeLibrary] = useState(false);
  const [recipeLibraryLoading, setRecipeLibraryLoading] = useState(false);
  const [recipeLibraryQuery, setRecipeLibraryQuery] = useState('');
  const [recipeLibrary, setRecipeLibrary] = useState([]);
  const [libraryFavoriteIds, setLibraryFavoriteIds] = useState(new Set());
  const [myLibraryFavorites, setMyLibraryFavorites] = useState([]);
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
  const [showEditMealModal, setShowEditMealModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [editMealFormData, setEditMealFormData] = useState({ name: '', category: 'Суп', portions: 3, preparedDate: '', expiresAt: '' });

  const [sharedFridgeId, setSharedFridgeId] = useState(null);
  const [sharedInviteCode, setSharedInviteCode] = useState(null);
  /** Отображаемое имя текущего холодильника (личный или семейный) */
  const [fridgeDisplayName, setFridgeDisplayName] = useState('');
  const [fridgeIsPersonal, setFridgeIsPersonal] = useState(false);
  /** Имя при создании семейной кладовой */
  const [createFridgeNameDraft, setCreateFridgeNameDraft] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  /** id → { id, invite_code, name, is_personal } для ЛК */
  const [cabinetFridgeGroups, setCabinetFridgeGroups] = useState({});
  /** Приглашение по ссылке t.me/...?startapp=join_CODE */
  const [deeplinkJoinCode, setDeeplinkJoinCode] = useState(null);
  const tgLoginWidgetHostRef = useRef(null);
  const [joinCodeDraft, setJoinCodeDraft] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  /** Личная группа пользователя (для переключателя кладовых) */
  const [personalFridgeRow, setPersonalFridgeRow] = useState(null);
  /** Последняя известная общая кладовая — можно вернуться без кода */
  const [linkedSharedFridgeId, setLinkedSharedFridgeId] = useState(null);
  const [linkedSharedFridgeName, setLinkedSharedFridgeName] = useState('');
  const [fridgeSwitchOpen, setFridgeSwitchOpen] = useState(false);
  const [fridgeSwitchBusy, setFridgeSwitchBusy] = useState(false);
  const lastFridgeRemoteAtRef = useRef(null);
  const skipNextFridgePollRef = useRef(false);

  const [addFormData, setAddFormData] = useState({
    name: '',
    category: '',
    measure: '',
    quantity: 1,
    expiryDate: '',
    autoFilled: false
  });
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState(''); // баркод, привязанный к текущей форме
  const [barcodeScanTarget, setBarcodeScanTarget] = useState('form');

  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [mealFormData, setMealFormData] = useState({
    name: '',
    category: 'Суп',
    preparedDate: new Date().toISOString().split('T')[0],
    portions: defaultMealPortionsForCategory('Суп')
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    quantity: 1,
    measure: '',
    category: '',
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

  /** Кладовая в Supabase: только таблица inventory, не JSON в state */
  const usesCloudInventory = Boolean(supabase && telegramUserId && sharedFridgeId);

  useEffect(() => {
    let cancelled = false;
    if (!linkedSharedFridgeId || !supabase) {
      setLinkedSharedFridgeName('');
      return undefined;
    }
    (async () => {
      const { data } = await supabase
        .from('fridge_groups')
        .select('name')
        .eq('id', linkedSharedFridgeId)
        .maybeSingle();
      if (!cancelled) setLinkedSharedFridgeName(data?.name || 'Семейная кладовая');
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedSharedFridgeId, supabase]);

  useEffect(() => {
    if (!showAccountModal || !supabase) {
      if (!showAccountModal) setCabinetFridgeGroups({});
      return undefined;
    }
    const ids = [...new Set([personalFridgeRow?.id, linkedSharedFridgeId, sharedFridgeId].filter(Boolean))];
    if (ids.length === 0) {
      setCabinetFridgeGroups({});
      return undefined;
    }
    let cancelled = false;
    supabase
      .from('fridge_groups')
      .select('id, invite_code, name, is_personal')
      .in('id', ids)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const m = {};
        (data || []).forEach((r) => {
          m[r.id] = r;
        });
        setCabinetFridgeGroups(m);
      });
    return () => {
      cancelled = true;
    };
  }, [showAccountModal, supabase, personalFridgeRow?.id, linkedSharedFridgeId, sharedFridgeId]);

  const fetchPantryInventory = async (fridgeId) => {
    if (!supabase || !fridgeId) return [];
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('fridge_id', fridgeId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('inventory fetch', error);
      return [];
    }
    return (data || []).map(mapInventoryRowToPantryItem);
  };

  const insertInventoryRow = async (fridgeId, payload) => {
    if (!supabase || !fridgeId) return { data: null, error: new Error('no supabase') };
    const row = {
      fridge_id: fridgeId,
      name: payload.name,
      category: payload.category || '🏷️ Прочее',
      measure: normalizeMeasure(payload.measure) || payload.measure || 'шт.',
      quantity: payload.quantity,
      expiry_date: payload.expiryDate ? payload.expiryDate.toISOString() : null,
      shelf_life: payload.shelfLife != null ? payload.shelfLife : 7,
      auto_filled: Boolean(payload.autoFilled),
      created_by_telegram_id: telegramUserId,
      updated_at: new Date().toISOString()
    };
    return supabase.from('inventory').insert(row).select().single();
  };

  const updateInventoryRow = async (id, patch) => {
    if (!supabase || !id) return { error: new Error('no id') };
    const dbPatch = { updated_at: new Date().toISOString() };
    if (patch.name != null) dbPatch.name = patch.name;
    if (patch.category != null) dbPatch.category = patch.category;
    if (patch.measure != null) dbPatch.measure = normalizeMeasure(patch.measure) || patch.measure;
    if (patch.quantity != null) dbPatch.quantity = patch.quantity;
    if (patch.expiryDate !== undefined) {
      dbPatch.expiry_date = patch.expiryDate ? patch.expiryDate.toISOString() : null;
    }
    if (patch.shelfLife != null) dbPatch.shelf_life = patch.shelfLife;
    if (patch.autoFilled != null) dbPatch.auto_filled = patch.autoFilled;
    return supabase.from('inventory').update(dbPatch).eq('id', id).select().single();
  };

  const deleteInventoryRow = async (id) => {
    if (!supabase || !id) return { error: new Error('no id') };
    return supabase.from('inventory').delete().eq('id', id);
  };

  /** Создаёт личную группу + пустой fridge_states + membership (один пользователь) */
  const ensurePersonalFridge = async () => {
    if (!supabase || !telegramUserId) return null;
    let lastErr = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = generateInviteCode();
      const { data: grp, error: e1 } = await supabase
        .from('fridge_groups')
        .insert({
          invite_code: code,
          created_by_telegram_id: telegramUserId,
          name: 'Личная кладовая',
          is_personal: true
        })
        .select('id, invite_code, name, is_personal')
        .single();
      if (e1) {
        lastErr = e1;
        continue;
      }
      const nowIso = new Date().toISOString();
      const { error: e2 } = await supabase.from('fridge_states').insert({
        fridge_id: grp.id,
        state: {},
        updated_at: nowIso
      });
      if (e2) {
        await supabase.from('fridge_groups').delete().eq('id', grp.id);
        lastErr = e2;
        continue;
      }
      const { error: e3 } = await supabase.from('fridge_members').insert({
        fridge_id: grp.id,
        telegram_user_id: telegramUserId
      });
      if (e3) {
        await supabase.from('fridge_groups').delete().eq('id', grp.id);
        lastErr = e3;
        return null;
      }
      return grp;
    }
    console.error('ensurePersonalFridge', lastErr);
    return null;
  };

  // Загрузка: общий холодильник (fridge_*) или личный user_states + localStorage
  useEffect(() => {
    let cancelled = false;

    const applyLocalBundle = (local) => {
      if (!local) return;
      if (local.pantryItems) setPantryItems(local.pantryItems);
      if (local.preparedMeals) setPreparedMeals(local.preparedMeals);
      if (local.shoppingItems) setShoppingItems(local.shoppingItems);
      if (local.favoriteProducts) setFavoriteProducts(local.favoriteProducts);
      if (local.favoriteRecipes) setFavoriteRecipes(local.favoriteRecipes);
      if (local.favoriteMeals) setFavoriteMeals(local.favoriteMeals);
      if (local.customRecipes) setCustomRecipes(local.customRecipes);
    };

    const loadState = async () => {
      setSharedFridgeId(null);
      setSharedInviteCode(null);
      lastFridgeRemoteAtRef.current = null;

      if (!supabase || !telegramUserId) {
        const local = loadLocalState(telegramUserId, null);
        applyLocalBundle(local);
        if (!local?.pantryItems) setPantryItems([]);
        setIsLoadingState(false);
        return;
      }

      try {
        const [{ data: membership, error: memErr }, { data: personalGrpEarly }] = await Promise.all([
          supabase.from('fridge_members').select('fridge_id').eq('telegram_user_id', telegramUserId).maybeSingle(),
          supabase
            .from('fridge_groups')
            .select('id, name')
            .eq('created_by_telegram_id', telegramUserId)
            .eq('is_personal', true)
            .maybeSingle()
        ]);
        const { data: usEarly } = await supabase
          .from('user_states')
          .select('state')
          .eq('telegram_user_id', telegramUserId)
          .maybeSingle();

        if (memErr) console.error('fridge_members load', memErr);

        if (cancelled) return;

        if (personalGrpEarly?.id && !cancelled) {
          setPersonalFridgeRow({
            id: personalGrpEarly.id,
            name: personalGrpEarly.name || 'Личная кладовая'
          });
        }
        const storedLinked =
          usEarly?.state && typeof usEarly.state === 'object' ? usEarly.state.linked_shared_fridge_id : null;
        const linkedFallback =
          loadLinkedSharedFridgeId(telegramUserId) ||
          (typeof storedLinked === 'string' && storedLinked ? storedLinked : null);

        const applyNonPantryFromHydrate = (h) => {
          if (!h) return;
          setPreparedMeals(h.preparedMeals || []);
          setShoppingItems(h.shoppingItems || []);
          setFavoriteProducts(h.favoriteProducts || []);
          setFavoriteRecipes(h.favoriteRecipes || []);
          if (h.favoriteMeals) setFavoriteMeals(h.favoriteMeals);
          setCustomRecipes(h.customRecipes || []);
        };

        const migrateLegacyPantryRows = async (fridgeId, legacyItems) => {
          if (!legacyItems?.length) return;
          for (const item of legacyItems) {
            const { error: insErr } = await insertInventoryRow(fridgeId, {
              name: item.name,
              category: item.category,
              measure: item.measure,
              quantity: item.quantity,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              shelfLife: item.shelfLife ?? 7,
              autoFilled: item.autoFilled ?? false
            });
            if (insErr) console.error('migrate pantry row', insErr);
          }
        };

        if (membership?.fridge_id) {
          const fid = membership.fridge_id;
          setSharedFridgeId(fid);

          const { data: grp } = await supabase
            .from('fridge_groups')
            .select('invite_code, name, is_personal')
            .eq('id', fid)
            .maybeSingle();
          if (!cancelled) {
            setSharedInviteCode(grp?.invite_code || null);
            setFridgeDisplayName(grp?.name || 'Кладовая');
            setFridgeIsPersonal(Boolean(grp?.is_personal));
            if (!grp?.is_personal) {
              setLinkedSharedFridgeId(fid);
              persistLinkedSharedFridgeId(telegramUserId, fid);
            } else if (linkedFallback) {
              setLinkedSharedFridgeId(linkedFallback);
            }
          }

          const { data: fsRow, error: fsErr } = await supabase
            .from('fridge_states')
            .select('state, updated_at')
            .eq('fridge_id', fid)
            .maybeSingle();

          if (fsErr) console.error('fridge_states load', fsErr);

          if (cancelled) return;

          const rawState = fsRow?.state && typeof fsRow.state === 'object' ? fsRow.state : {};
          const stateKeys = Object.keys(rawState);
          const h = stateKeys.length > 0 ? hydrateAppState(rawState) : null;
          if (h && stateKeys.length > 0) {
            applyNonPantryFromHydrate(h);
          } else {
            const lf = loadLocalState(telegramUserId, fid);
            if (lf) {
              if (lf.preparedMeals) setPreparedMeals(lf.preparedMeals);
              if (lf.shoppingItems) setShoppingItems(lf.shoppingItems);
              if (lf.favoriteProducts) setFavoriteProducts(lf.favoriteProducts);
              if (lf.favoriteRecipes) setFavoriteRecipes(lf.favoriteRecipes);
              if (lf.favoriteMeals) setFavoriteMeals(lf.favoriteMeals);
              if (lf.customRecipes) setCustomRecipes(lf.customRecipes);
            }
          }
          if (fsRow?.updated_at) lastFridgeRemoteAtRef.current = fsRow.updated_at;

          let inv = await fetchPantryInventory(fid);
          if (inv.length === 0 && h?.pantryItems?.length) {
            await migrateLegacyPantryRows(fid, h.pantryItems);
            const stripped = { ...rawState, pantryItems: [] };
            const nowIso = new Date().toISOString();
            await supabase.from('fridge_states').upsert(
              { fridge_id: fid, state: stripped, updated_at: nowIso },
              { onConflict: 'fridge_id' }
            );
            lastFridgeRemoteAtRef.current = nowIso;
            inv = await fetchPantryInventory(fid);
          }
          if (!cancelled) setPantryItems(inv);
        } else {
          const local = loadLocalState(telegramUserId, null);
          if (local) {
            if (local.preparedMeals) setPreparedMeals(local.preparedMeals);
            if (local.shoppingItems) setShoppingItems(local.shoppingItems);
            if (local.favoriteProducts) setFavoriteProducts(local.favoriteProducts);
            if (local.favoriteRecipes) setFavoriteRecipes(local.favoriteRecipes);
            if (local.favoriteMeals) setFavoriteMeals(local.favoriteMeals);
            if (local.customRecipes) setCustomRecipes(local.customRecipes);
          }

          const { data, error } = await supabase
            .from('user_states')
            .select('state')
            .eq('telegram_user_id', telegramUserId)
            .maybeSingle();

          if (error) {
            console.error('Error loading state', error);
            setStateError('Не удалось загрузить данные');
          }

          if (cancelled) return;

          const state = data?.state && typeof data.state === 'object' ? data.state : {};

          if (state.shoppingItems) setShoppingItems(state.shoppingItems);
          if (state.favoriteProducts) setFavoriteProducts(state.favoriteProducts);
          if (state.favoriteRecipes) setFavoriteRecipes(state.favoriteRecipes);
          if (state.favoriteMeals) setFavoriteMeals(state.favoriteMeals);
          if (state.customRecipes) setCustomRecipes(state.customRecipes);
          if (state.preparedMeals) {
            setPreparedMeals(
              state.preparedMeals.map((meal) => ({
                ...meal,
                preparedDate: meal.preparedDate ? new Date(meal.preparedDate) : null,
                expiresAt: meal.expiresAt ? new Date(meal.expiresAt) : null
              }))
            );
          }

          const pantryFromState = Array.isArray(state.pantryItems) ? state.pantryItems : null;
          const legacyPantry = (pantryFromState && pantryFromState.length
            ? pantryFromState
            : local?.pantryItems || []
          ).map((item) => ({
            ...item,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
          }));

          const personalGrp = await ensurePersonalFridge();
          if (cancelled || !personalGrp?.id) {
            if (!cancelled && !personalGrp) {
              setStateError('Не удалось создать личную кладовую');
              setPantryItems([]);
            }
          } else {
            setSharedFridgeId(personalGrp.id);
            setSharedInviteCode(personalGrp.invite_code || null);
            setFridgeDisplayName(personalGrp.name || 'Личная кладовая');
            setFridgeIsPersonal(true);
            setPersonalFridgeRow({
              id: personalGrp.id,
              name: personalGrp.name || 'Личная кладовая'
            });
            if (linkedFallback) {
              setLinkedSharedFridgeId(linkedFallback);
            }

            if (legacyPantry.length) {
              await migrateLegacyPantryRows(personalGrp.id, legacyPantry);
              const nextState = { ...state, pantryItems: [] };
              await supabase.from('user_states').upsert(
                { telegram_user_id: telegramUserId, state: nextState },
                { onConflict: 'telegram_user_id' }
              );
            }

            const inv = await fetchPantryInventory(personalGrp.id);
            if (!cancelled) setPantryItems(inv);

            const { data: fsNew } = await supabase
              .from('fridge_states')
              .select('state, updated_at')
              .eq('fridge_id', personalGrp.id)
              .maybeSingle();
            const h2 = fsNew?.state ? hydrateAppState(fsNew.state) : null;
            if (h2) applyNonPantryFromHydrate(h2);
            if (fsNew?.updated_at) lastFridgeRemoteAtRef.current = fsNew.updated_at;
          }
        }
      } catch (e) {
        console.error(e);
        setStateError('Не удалось загрузить данные');
      } finally {
        if (!cancelled) setIsLoadingState(false);
      }
    };

    loadState();
    return () => {
      cancelled = true;
    };
  }, [telegramUserId]);

  // Сохранение в облако: JSON кладовой (без списка продуктов — они в inventory).
  // Отдельно от эффекта с pantryItems, иначе каждое удаление/редактирование продукта
  // вызывало тяжёлый upsert fridge_states и ощущалось как «задержка UI».
  useEffect(() => {
    if (isLoadingState) return;
    if (!sharedFridgeId || !supabase || !telegramUserId) return;

    const saveState = async () => {
      try {
        const stateToSave = {
          preparedMeals: preparedMeals.map((meal) => ({
            ...meal,
            preparedDate: meal.preparedDate ? meal.preparedDate.toISOString() : null,
            expiresAt: meal.expiresAt ? meal.expiresAt.toISOString() : null
          })),
          shoppingItems,
          favoriteProducts,
          favoriteRecipes,
          favoriteMeals,
          customRecipes,
          pantryItems: []
        };
        saveLocalState(stateToSave, telegramUserId, sharedFridgeId);
        const nowIso = new Date().toISOString();
        await supabase.from('fridge_states').upsert(
          {
            fridge_id: sharedFridgeId,
            state: stateToSave,
            updated_at: nowIso
          },
          { onConflict: 'fridge_id' }
        );
        lastFridgeRemoteAtRef.current = nowIso;
        skipNextFridgePollRef.current = true;
      } catch (e) {
        console.error('Error saving fridge_states', e);
      }
    };

    saveState();
  }, [
    telegramUserId,
    isLoadingState,
    sharedFridgeId,
    supabase,
    shoppingItems,
    favoriteProducts,
    favoriteRecipes,
    favoriteMeals,
    customRecipes,
    preparedMeals
  ]);

  // Локальное + user_states (в т.ч. pantry в JSON), когда нет полного облачного режима
  useEffect(() => {
    if (isLoadingState) return;
    if (sharedFridgeId && supabase && telegramUserId) return;

    const saveState = async () => {
      try {
        const cloudInv = Boolean(supabase && telegramUserId && sharedFridgeId);
        const stateToSave = {
          preparedMeals: preparedMeals.map((meal) => ({
            ...meal,
            preparedDate: meal.preparedDate ? meal.preparedDate.toISOString() : null,
            expiresAt: meal.expiresAt ? meal.expiresAt.toISOString() : null
          })),
          shoppingItems,
          favoriteProducts,
          favoriteRecipes,
          favoriteMeals,
          customRecipes
        };
        if (!cloudInv) {
          stateToSave.pantryItems = pantryItems.map((item) => ({
            ...item,
            expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null
          }));
        } else {
          stateToSave.pantryItems = [];
        }

        if (sharedFridgeId) {
          saveLocalState(stateToSave, telegramUserId, sharedFridgeId);
          return;
        }

        saveLocalState(stateToSave, telegramUserId, null);

        if (supabase && telegramUserId) {
          stateToSave.linked_shared_fridge_id = linkedSharedFridgeId ?? null;
          await supabase.from('user_states').upsert(
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
  }, [
    telegramUserId,
    isLoadingState,
    sharedFridgeId,
    supabase,
    pantryItems,
    shoppingItems,
    favoriteProducts,
    favoriteRecipes,
    favoriteMeals,
    customRecipes,
    preparedMeals,
    linkedSharedFridgeId
  ]);

  /** Слияние JSON из fridge_states (блюда, покупки, избранное) с защитой по updated_at */
  const applyRemoteFridgeJson = useCallback((rawState, updatedAt) => {
    if (!rawState || typeof rawState !== 'object') return;
    if (
      lastFridgeRemoteAtRef.current &&
      updatedAt &&
      updatedAt <= lastFridgeRemoteAtRef.current
    ) {
      return;
    }
    const h = hydrateAppState(rawState);
    if (!h) return;
    // Не затирать список покупок / блюда, если в JSON ключа нет (частичное тело или {})
    if (Object.prototype.hasOwnProperty.call(rawState, 'preparedMeals')) {
      setPreparedMeals(h.preparedMeals || []);
    }
    if (Object.prototype.hasOwnProperty.call(rawState, 'shoppingItems')) {
      setShoppingItems(Array.isArray(h.shoppingItems) ? h.shoppingItems : []);
    }
    if (Object.prototype.hasOwnProperty.call(rawState, 'favoriteProducts')) {
      setFavoriteProducts(h.favoriteProducts || []);
    }
    if (Object.prototype.hasOwnProperty.call(rawState, 'favoriteRecipes')) {
      setFavoriteRecipes(h.favoriteRecipes || []);
    }
    if (Object.prototype.hasOwnProperty.call(rawState, 'favoriteMeals')) {
      setFavoriteMeals(h.favoriteMeals || []);
    }
    if (Object.prototype.hasOwnProperty.call(rawState, 'customRecipes')) {
      setCustomRecipes(h.customRecipes || []);
    }
    lastFridgeRemoteAtRef.current = updatedAt;
  }, []);

  // Подтягиваем изменения от других членов семьи (опрос раз в 20 с и при возврате на вкладку)
  useEffect(() => {
    if (!supabase || !telegramUserId || !sharedFridgeId || isLoadingState) return;

    const pullRemote = async () => {
      if (skipNextFridgePollRef.current) {
        skipNextFridgePollRef.current = false;
        return;
      }
      try {
        const { data, error } = await supabase
          .from('fridge_states')
          .select('state, updated_at')
          .eq('fridge_id', sharedFridgeId)
          .maybeSingle();
        if (error) {
          const inv = await fetchPantryInventory(sharedFridgeId);
          setPantryItems(inv);
          return;
        }
        const inv = await fetchPantryInventory(sharedFridgeId);
        setPantryItems(inv);
        if (data?.state && data.updated_at) {
          applyRemoteFridgeJson(data.state, data.updated_at);
        }
      } catch (e) {
        console.error('fridge poll', e);
      }
    };

    const id = setInterval(pullRemote, 20000);
    const onVis = () => {
      if (document.visibilityState === 'visible') pullRemote();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [supabase, telegramUserId, sharedFridgeId, isLoadingState, applyRemoteFridgeJson]);

  // Realtime: кладовая из таблицы inventory (другой участник меняет продукты)
  useEffect(() => {
    if (!supabase || !sharedFridgeId || !telegramUserId || isLoadingState) return;
    const fid = sharedFridgeId;
    const channel = supabase
      .channel(`inventory_rt_${fid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory', filter: `fridge_id=eq.${fid}` },
        async () => {
          const inv = await fetchPantryInventory(fid);
          setPantryItems(inv);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, telegramUserId, sharedFridgeId, isLoadingState]);

  // Realtime: fridge_states (готовые блюда, списки и т.д. — то же, что в JSON, не в inventory)
  useEffect(() => {
    if (!supabase || !sharedFridgeId || !telegramUserId || isLoadingState) return;
    const fid = sharedFridgeId;
    const channel = supabase
      .channel(`fridge_states_rt_${fid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fridge_states',
          filter: `fridge_id=eq.${fid}`
        },
        (payload) => {
          const row = payload.new;
          if (!row || typeof row !== 'object') return;
          if (row.state && row.updated_at) {
            applyRemoteFridgeJson(row.state, row.updated_at);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, telegramUserId, sharedFridgeId, isLoadingState, applyRemoteFridgeJson]);

  const showNotification = (message, durationMs = 1000) => {
    setNotification(message);
    setTimeout(() => setNotification(''), durationMs);
  };

  const switchToFridgeId = async (targetId) => {
    if (!supabase || !telegramUserId || !targetId) return;
    const fid = String(targetId).trim();
    if (!fid || fid === sharedFridgeId) {
      setFridgeSwitchOpen(false);
      return;
    }
    const previousFridgeId = sharedFridgeId;
    setFridgeSwitchBusy(true);
    try {
      const { error: uErr } = await supabase.from('fridge_members').upsert(
        { telegram_user_id: telegramUserId, fridge_id: fid },
        { onConflict: 'telegram_user_id' }
      );
      if (uErr) {
        console.error('fridge_members upsert', uErr);
        showNotification('Не удалось переключить кладовую');
        return;
      }
      const { data: grp, error: gErr } = await supabase
        .from('fridge_groups')
        .select('id, invite_code, name, is_personal')
        .eq('id', fid)
        .maybeSingle();
      if (gErr) {
        console.error('fridge_groups select', gErr);
      }
      // Проверять grp, а не grp.id: в select раньше не было id — строка «существует», но id в объекте не было.
      if (!grp) {
        if (previousFridgeId) {
          const { error: revErr } = await supabase.from('fridge_members').upsert(
            { telegram_user_id: telegramUserId, fridge_id: previousFridgeId },
            { onConflict: 'telegram_user_id' }
          );
          if (revErr) console.error('fridge_members revert', revErr);
        }
        showNotification(
          'Кладовая не найдена (возможно удалена). Обновите приложение или вступите в семью по коду.'
        );
        return;
      }
      setSharedFridgeId(fid);
      setSharedInviteCode(grp.invite_code || null);
      setFridgeDisplayName(grp.name || 'Кладовая');
      setFridgeIsPersonal(Boolean(grp.is_personal));

      const { data: fsRow, error: fsErr } = await supabase
        .from('fridge_states')
        .select('state, updated_at')
        .eq('fridge_id', fid)
        .maybeSingle();
      if (fsErr) console.error('fridge_states load', fsErr);
      const rawState = fsRow?.state && typeof fsRow.state === 'object' ? fsRow.state : {};
      const stateKeys = Object.keys(rawState);
      const h = stateKeys.length > 0 ? hydrateAppState(rawState) : null;
      if (h && stateKeys.length > 0) {
        setPreparedMeals(h.preparedMeals || []);
        setShoppingItems(h.shoppingItems || []);
        setFavoriteProducts(h.favoriteProducts || []);
        setFavoriteRecipes(h.favoriteRecipes || []);
        if (h.favoriteMeals) setFavoriteMeals(h.favoriteMeals);
        setCustomRecipes(h.customRecipes || []);
      } else {
        const lf = loadLocalState(telegramUserId, fid);
        if (lf) {
          if (lf.preparedMeals) setPreparedMeals(lf.preparedMeals);
          if (lf.shoppingItems) setShoppingItems(lf.shoppingItems);
          if (lf.favoriteProducts) setFavoriteProducts(lf.favoriteProducts);
          if (lf.favoriteRecipes) setFavoriteRecipes(lf.favoriteRecipes);
          if (lf.favoriteMeals) setFavoriteMeals(lf.favoriteMeals);
          if (lf.customRecipes) setCustomRecipes(lf.customRecipes);
        }
      }
      if (fsRow?.updated_at) lastFridgeRemoteAtRef.current = fsRow.updated_at;

      const inv = await fetchPantryInventory(fid);
      setPantryItems(inv);

      if (!grp.is_personal) {
        setLinkedSharedFridgeId(fid);
        persistLinkedSharedFridgeId(telegramUserId, fid);
      }
      skipNextFridgePollRef.current = true;
      setFridgeSwitchOpen(false);
      showNotification(grp.name || (grp.is_personal ? 'Личная кладовая' : 'Общая кладовая'));
    } finally {
      setFridgeSwitchBusy(false);
    }
  };

  const createSharedFridge = async () => {
    if (!supabase || !telegramUserId) {
      showNotification('Доступно в Telegram при подключённом Supabase');
      return;
    }
    setShareBusy(true);
    try {
      const { data: existing } = await supabase
        .from('fridge_members')
        .select('fridge_id')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();
      if (!existing?.fridge_id) {
        showNotification('Нет активной кладовой');
        return;
      }
      const oldFid = existing.fridge_id;
      const { data: gRow } = await supabase
        .from('fridge_groups')
        .select('is_personal')
        .eq('id', oldFid)
        .maybeSingle();
      if (!gRow?.is_personal) {
        showNotification('Вы уже в общей кладовой');
        return;
      }

      const displayName = (createFridgeNameDraft || '').trim() || 'Наша кладовая';
      const stateToSave = {
        pantryItems: [],
        preparedMeals: preparedMeals.map((meal) => ({
          ...meal,
          preparedDate: meal.preparedDate ? meal.preparedDate.toISOString() : null,
          expiresAt: meal.expiresAt ? meal.expiresAt.toISOString() : null
        })),
        shoppingItems,
        favoriteProducts,
        favoriteRecipes,
        favoriteMeals,
        customRecipes
      };

      const { data: invRows } = await supabase.from('inventory').select('*').eq('fridge_id', oldFid);

      let lastErr = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateInviteCode();
        const { data: grp, error: e1 } = await supabase
          .from('fridge_groups')
          .insert({
            invite_code: code,
            created_by_telegram_id: telegramUserId,
            name: displayName,
            is_personal: false
          })
          .select('id, invite_code, name, is_personal')
          .single();
        if (e1) {
          lastErr = e1;
          continue;
        }
        const newId = grp.id;
        const nowIso = new Date().toISOString();
        const { error: e2 } = await supabase.from('fridge_states').insert({
          fridge_id: newId,
          state: stateToSave,
          updated_at: nowIso
        });
        if (e2) {
          await supabase.from('fridge_groups').delete().eq('id', newId);
          lastErr = e2;
          showNotification('Не удалось создать общую кладовую');
          return;
        }

        const copyRows = (invRows || []).map((r) => ({
          fridge_id: newId,
          name: r.name,
          category: r.category,
          measure: r.measure,
          quantity: r.quantity,
          expiry_date: r.expiry_date,
          shelf_life: r.shelf_life,
          auto_filled: r.auto_filled,
          created_by_telegram_id: r.created_by_telegram_id,
          updated_at: nowIso
        }));
        if (copyRows.length) {
          const { error: eInv } = await supabase.from('inventory').insert(copyRows);
          if (eInv) {
            await supabase.from('fridge_groups').delete().eq('id', newId);
            showNotification('Не удалось перенести продукты');
            return;
          }
        }

        const { error: eUp } = await supabase
          .from('fridge_members')
          .update({ fridge_id: newId })
          .eq('telegram_user_id', telegramUserId);
        if (eUp) {
          await supabase.from('fridge_groups').delete().eq('id', newId);
          showNotification('Не удалось переключить кладовую');
          return;
        }

        setSharedFridgeId(newId);
        setSharedInviteCode(code);
        setFridgeDisplayName(displayName);
        setFridgeIsPersonal(false);
        lastFridgeRemoteAtRef.current = nowIso;
        skipNextFridgePollRef.current = true;
        const inv = await fetchPantryInventory(newId);
        setPantryItems(inv);
        setLinkedSharedFridgeId(newId);
        persistLinkedSharedFridgeId(telegramUserId, newId);
        setCreateFridgeNameDraft('');
        showNotification('Создан код приглашения — отправьте его семье');
        return;
      }
      console.error(lastErr);
      showNotification('Не удалось создать код, попробуйте позже');
    } finally {
      setShareBusy(false);
    }
  };

  const joinSharedFridgeWithCode = async (codeRaw) => {
    const code = String(codeRaw ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) {
      showNotification('Введите код приглашения');
      return;
    }
    if (!supabase || !telegramUserId) return;
    setShareBusy(true);
    try {
      const { data: existing } = await supabase
        .from('fridge_members')
        .select('fridge_id')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();
      if (existing?.fridge_id) {
        const { data: curG } = await supabase
          .from('fridge_groups')
          .select('is_personal')
          .eq('id', existing.fridge_id)
          .maybeSingle();
        if (!curG?.is_personal) {
          showNotification('Сначала выйдите из текущей общей кладовой');
          return;
        }
      }
      const { data: group, error: gErr } = await supabase
        .from('fridge_groups')
        .select('id')
        .eq('invite_code', code)
        .maybeSingle();
      if (gErr || !group) {
        showNotification('Код не найден');
        return;
      }
      const { error: mErr } = existing?.fridge_id
        ? await supabase
            .from('fridge_members')
            .update({ fridge_id: group.id })
            .eq('telegram_user_id', telegramUserId)
        : await supabase.from('fridge_members').insert({
            fridge_id: group.id,
            telegram_user_id: telegramUserId
          });
      if (mErr) {
        showNotification('Не удалось присоединиться');
        return;
      }
      const { data: fsRow } = await supabase
        .from('fridge_states')
        .select('state, updated_at')
        .eq('fridge_id', group.id)
        .maybeSingle();
      if (fsRow?.state) {
        const h = hydrateAppState(fsRow.state);
        if (h) {
          setPreparedMeals(h.preparedMeals || []);
          setShoppingItems(h.shoppingItems || []);
          setFavoriteProducts(h.favoriteProducts);
          setFavoriteRecipes(h.favoriteRecipes);
          if (h.favoriteMeals) setFavoriteMeals(h.favoriteMeals);
          setCustomRecipes(h.customRecipes);
        }
        lastFridgeRemoteAtRef.current = fsRow.updated_at;
      }
      const { data: gMeta } = await supabase
        .from('fridge_groups')
        .select('name, is_personal')
        .eq('id', group.id)
        .maybeSingle();
      const invJoined = await fetchPantryInventory(group.id);
      setPantryItems(invJoined);
      setSharedFridgeId(group.id);
      setSharedInviteCode(code);
      setFridgeDisplayName(gMeta?.name || 'Кладовая');
      setFridgeIsPersonal(false);
      setLinkedSharedFridgeId(group.id);
      persistLinkedSharedFridgeId(telegramUserId, group.id);
      setJoinCodeDraft('');
      showNotification('Вы присоединились к общей кладовой');
    } finally {
      setShareBusy(false);
    }
  };

  const joinSharedFridge = async () => {
    await joinSharedFridgeWithCode(joinCodeDraft);
  };

  useEffect(() => {
    const sp = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (!sp?.startsWith('join_')) return;
    const code = sp
      .slice(5)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (code.length >= 4) setDeeplinkJoinCode(code);
  }, []);

  useEffect(() => {
    if (!deeplinkJoinCode || isLoadingState || !telegramUserId || !supabase) return;
    const code = deeplinkJoinCode;
    setDeeplinkJoinCode(null);
    joinSharedFridgeWithCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- разовый ввод по ссылке после загрузки состояния
  }, [deeplinkJoinCode, isLoadingState, telegramUserId, supabase]);

  useEffect(() => {
    if (!showShareModal || telegramUserId || !supabase) return;
    const host = tgLoginWidgetHostRef.current;
    if (!host) return;
    host.innerHTML = '';
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    const nextPath = window.location.pathname + window.location.search;
    const authUrl = `${window.location.origin}/api/auth/telegram/callback?next=${encodeURIComponent(nextPath)}`;
    script.setAttribute('data-auth-url', authUrl);
    host.appendChild(script);
  }, [showShareModal, telegramUserId, supabase]);

  useEffect(() => {
    if (tgTelegramUserId || webTelegramUserId) return;
    // Подхватываем сессию после возврата из Telegram auth (popup/переключение вкладки).
    const onFocus = () => {
      refreshWebAuthUser();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshWebAuthUser();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tgTelegramUserId, webTelegramUserId, refreshWebAuthUser]);

  useEffect(() => {
    if (tgTelegramUserId || webTelegramUserId) return;
    // Фоновая проверка cookie-сессии даже если модалка закрылась автоматически.
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      await refreshWebAuthUser();
      if (tries >= 40 || tgTelegramUserId || webTelegramUserId) clearInterval(id);
    }, 1500);
    return () => clearInterval(id);
  }, [tgTelegramUserId, webTelegramUserId, refreshWebAuthUser]);

  const leaveSharedFridge = async () => {
    if (!supabase || !telegramUserId || !sharedFridgeId) return;
    if (fridgeIsPersonal) {
      showNotification('Это личная кладовая — покидать нечего. Создайте приглашение или вступите по коду.');
      setShowShareModal(false);
      return;
    }
    if (!window.confirm('Покинуть семейную кладовую и вернуться в личную?')) {
      return;
    }
    setShareBusy(true);
    const fid = sharedFridgeId;
    try {
      persistLinkedSharedFridgeId(telegramUserId, fid);
      setLinkedSharedFridgeId(fid);
      await supabase.from('fridge_members').delete().eq('telegram_user_id', telegramUserId);
      const { count, error: cErr } = await supabase
        .from('fridge_members')
        .select('*', { count: 'exact', head: true })
        .eq('fridge_id', fid);
      if (!cErr && count === 0) {
        await supabase.from('fridge_groups').delete().eq('id', fid);
      }
      setSharedFridgeId(null);
      setSharedInviteCode(null);
      setFridgeDisplayName('');
      setFridgeIsPersonal(false);
      lastFridgeRemoteAtRef.current = null;

      const { data: pers } = await supabase
        .from('user_states')
        .select('state')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();
      if (pers?.state) {
        const st = pers.state;
        if (st.shoppingItems) setShoppingItems(st.shoppingItems);
        if (st.favoriteProducts) setFavoriteProducts(st.favoriteProducts);
        if (st.favoriteRecipes) setFavoriteRecipes(st.favoriteRecipes);
        if (st.favoriteMeals) setFavoriteMeals(st.favoriteMeals);
        if (st.customRecipes) setCustomRecipes(st.customRecipes);
      } else {
        const local = loadLocalState(telegramUserId, null);
        if (local) {
          if (local.shoppingItems) setShoppingItems(local.shoppingItems);
          if (local.favoriteProducts) setFavoriteProducts(local.favoriteProducts);
          if (local.favoriteRecipes) setFavoriteRecipes(local.favoriteRecipes);
          if (local.favoriteMeals) setFavoriteMeals(local.favoriteMeals);
          if (local.customRecipes) setCustomRecipes(local.customRecipes);
        }
      }

      let personalGrp = null;
      const { data: personalRows } = await supabase
        .from('fridge_groups')
        .select('id, invite_code, name, is_personal')
        .eq('created_by_telegram_id', telegramUserId)
        .eq('is_personal', true)
        .limit(1);
      if (Array.isArray(personalRows) && personalRows.length > 0) {
        personalGrp = personalRows[0];
      } else {
        personalGrp = await ensurePersonalFridge();
      }
      if (personalGrp?.id) {
        const { error: mBackErr } = await supabase.from('fridge_members').insert({
          fridge_id: personalGrp.id,
          telegram_user_id: telegramUserId
        });
        if (mBackErr) {
          showNotification('Не удалось вернуться в личную кладовую');
          return;
        }
        setSharedFridgeId(personalGrp.id);
        setSharedInviteCode(personalGrp.invite_code || null);
        setFridgeDisplayName(personalGrp.name || 'Личная кладовая');
        setFridgeIsPersonal(true);
        const inv = await fetchPantryInventory(personalGrp.id);
        setPantryItems(inv);
      } else {
        setPantryItems([]);
      }
      showNotification('Вы вышли из общей кладовой');
    } finally {
      setShareBusy(false);
      setShowShareModal(false);
    }
  };

  const copySharedInviteCode = async () => {
    if (!sharedInviteCode) return;
    try {
      await navigator.clipboard.writeText(sharedInviteCode);
      showNotification('Код скопирован');
    } catch {
      showNotification(sharedInviteCode);
    }
  };

  const handleDateClick = (item) => {
    setEditingDateProduct(item);
    setShowDateModal(true);
  };

  const handleKus = async (item) => {
    const catalogProduct = PRODUCTS_DB.find(
      p => p.name.toLowerCase() === item.name.toLowerCase()
    );

    let portion, portionMeasure;
    if (catalogProduct && catalogProduct.portion != null) {
      portion = catalogProduct.portion;
      portionMeasure = catalogProduct.measure;
    } else {
      portion = getDefaultPortion(item.measure);
      portionMeasure = item.measure;
    }

    const portionInItemMeasure = convertQuantity(portion, portionMeasure, item.measure);
    const step = getQuantityStep(item.measure);
    const newQty = roundToStep(Number(item.quantity) - portionInItemMeasure, step);

    if (usesCloudInventory && item.id) {
      if (newQty <= 0) {
        const id = item.id;
        const snap = { ...item };
        setPantryItems((prev) => prev.filter((p) => p.id !== id));
        showNotification(`${item.name} закончился 🪹`);
        deleteInventoryRow(id).then(({ error }) => {
          if (error) {
            setPantryItems((prev) => [...prev, snap]);
            showNotification('Не удалось обновить кладовую');
          }
        });
      } else {
        const { data, error } = await updateInventoryRow(item.id, { quantity: newQty });
        if (error || !data) {
          showNotification('Не удалось обновить кладовую');
          return;
        }
        const mapped = mapInventoryRowToPantryItem(data);
        setPantryItems((prev) => prev.map((p) => (p.id === item.id ? mapped : p)));
        showNotification(`Кусь! −${formatQuantityForDisplay(portionInItemMeasure, item.measure)} ${item.measure} ${item.name}`);
      }
      return;
    }

    if (newQty <= 0) {
      setPantryItems((prev) => prev.filter((p) => p.id !== item.id));
      showNotification(`${item.name} закончился 🪹`);
    } else {
      setPantryItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, quantity: newQty } : p))
      );
      showNotification(`Кусь! −${formatQuantityForDisplay(portionInItemMeasure, item.measure)} ${item.measure} ${item.name}`);
    }
  };


  const handleMealKus = (meal) => {
    const newPortions = (meal.portions ?? 1) - 1;
    if (newPortions <= 0) {
      setPreparedMeals(prev => prev.filter(m => m.id !== meal.id));
      showNotification(`${meal.name} съедено полностью 🪹`);
    } else {
      setPreparedMeals(prev =>
        prev.map(m => m.id === meal.id ? { ...m, portions: newPortions } : m)
      );
      showNotification(`Кусь! Осталось порций: ${newPortions} — ${meal.name}`);
    }
  };

  const toggleFavoriteMeal = (meal) => {
    const isFav = favoriteMeals.some(m => m.id === meal.id);
    if (isFav) {
      setFavoriteMeals(prev => prev.filter(m => m.id !== meal.id));
      showNotification(`${meal.name} удалено из избранного`);
    } else {
      setFavoriteMeals(prev => [...prev, meal]);
      showNotification(`${meal.name} добавлено в избранное`);
    }
  };

  const updateExpiryDate = async (newDate) => {
    if (editingDateProduct && newDate) {
      const d = new Date(newDate);
      if (usesCloudInventory && editingDateProduct.id) {
        const { data, error } = await updateInventoryRow(editingDateProduct.id, { expiryDate: d, autoFilled: false });
        if (error || !data) {
          showNotification('Не удалось сохранить срок');
          return;
        }
        const mapped = mapInventoryRowToPantryItem(data);
        setPantryItems((prevItems) => prevItems.map((item) => (item.id === editingDateProduct.id ? mapped : item)));
      } else {
        setPantryItems((prevItems) =>
          prevItems.map((item) =>
            item.id === editingDateProduct.id ? { ...item, expiryDate: d } : item
          )
        );
      }
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

  /**
   * Парсит строку количества из Open Food Facts (напр. "500 g", "1 l", "250 мл")
   * и возвращает { quantity: number, measure: string }
   * @param {string|undefined} qStr
   */
  const parseOFFQuantity = (qStr) => {
    if (!qStr) return { quantity: 1, measure: 'шт.' };
    const s = qStr.toLowerCase().trim();
    let measure = 'шт.';
    if (/кг|kg/.test(s))                          measure = 'кг.';
    else if (/мл|ml/.test(s))                     measure = 'мл.';
    else if (/\d\s*г\b|\d\s*g\b/.test(s))         measure = 'г.';
    else if (/\bл\b|\bl\b/.test(s))               measure = 'л.';
    const numMatch = s.match(/(\d+[.,]?\d*)/);
    const quantity = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 1;
    return { quantity: isFinite(quantity) && quantity > 0 ? quantity : 1, measure };
  };

  /**
   * Грубое сопоставление тегов категорий Open Food Facts с нашими категориями
   * @param {string[]|undefined} tags
   */
  const mapOFFCategory = (tags) => {
    if (!Array.isArray(tags)) return '🏷️ Прочее';
    const t = tags.join(' ').toLowerCase();
    if (/milk|dairy|lait/.test(t))          return '🥛 Молочные';
    if (/yogurt|kefir|ferment/.test(t))     return '🥛 Кисломолочные';
    if (/cheese/.test(t))                   return '🧀 Сыры твердые';
    if (/butter|margarine/.test(t))         return '🧈 Масло';
    if (/egg/.test(t))                      return '🥚 Яйца';
    if (/meat|beef|pork|chicken/.test(t))   return '🥩 Мясо';
    if (/fish|seafood/.test(t))             return '🐟 Рыба свежая';
    if (/vegetable|овощ/.test(t))           return '🥦 Овощи';
    if (/fruit|фрукт/.test(t))              return '🍎 Фрукты';
    if (/bread|выпечка/.test(t))            return '🍞 Хлеб';
    if (/pasta|макарон/.test(t))            return '🍝 Макароны';
    if (/cereal|grain|крупа/.test(t))       return '🌾 Крупы';
    if (/sauce|кетчуп|соус/.test(t))        return '🍯 Соусы';
    if (/water|вода/.test(t))               return '💧 Вода';
    if (/juice|сок/.test(t))               return '🧃 Соки';
    if (/chocolate|candy|sweet/.test(t))    return '🍫 Сладости';
    if (/snack|chips|снек/.test(t))         return '🍿 Снеки';
    if (/coffee|кофе/.test(t))              return '☕ Кофе';
    if (/tea|чай/.test(t))                  return '☕ Чай';
    return '🏷️ Прочее';
  };

  /** Запрос к Open Food Facts по штрихкоду */
  /** Применяет найденный продукт к форме добавления */
  const applyBarcodeResult = (data, sourceLabel, target = 'form') => {
    const fullName = data.name && data.brand &&
      !data.name.toLowerCase().includes(data.brand.toLowerCase())
      ? `${data.name} (${data.brand})`
      : data.name || '';

    if (target === 'shopping') {
      const productForShopping = {
        name: fullName || data.name || 'Неизвестный товар',
        category: data.category || '🏷️ Прочее',
        measure: data.measure || 'шт.'
      };
      const qty = Number(data.quantity) > 0 ? Number(data.quantity) : 1;
      addToShopping(productForShopping, qty);
      return;
    }

    setAddFormData(prev => ({
      ...prev,
      name:      fullName || prev.name,
      measure:   data.measure   || prev.measure,
      quantity:  data.quantity  || prev.quantity,
      category:  data.category  || prev.category,
      autoFilled: !!fullName
    }));
    showNotification(fullName
      ? `${sourceLabel}: ${fullName}`
      : `${sourceLabel} — уточните название`);
  };

  /** Сохраняет продукт в Supabase products_cache (тихо, без блокировки) */
  const saveToBarcodeCache = async (data) => {
    if (!supabase) return;
    try {
      await supabase.from('products_cache').upsert(
        { ...data, updated_at: new Date().toISOString() },
        { onConflict: 'barcode' }
      );
    } catch { /* кэширование некритично */ }
  };

  /**
   * Каскадный поиск продукта по штрихкоду:
   * 1. Supabase products_cache
   * 2. Open Food Facts
   * 3. UPC Item DB (бесплатный fallback)
   * 4. EAN-DB (через /api/barcode — ключ на сервере)
   * 5. Ручной ввод
   */
  const fetchByBarcode = async (code, target = 'form') => {
    setBarcodeLoading(true);
    setPendingBarcode(code); // запоминаем баркод сразу — пригодится при ручном вводе
    try {
      // ── 1. Supabase cache ──────────────────────────────────────────────────
      if (supabase) {
        try {
          const { data } = await supabase
            .from('products_cache')
            .select('name,brand,category,measure,quantity,image_url,source')
            .eq('barcode', code)
            .maybeSingle();
          if (data?.name) {
            const label = data.source === 'manual'
              ? '👥 Из базы пользователей'
              : '📦 Из кэша';
            applyBarcodeResult(data, label, target);
            return;
          }
        } catch { /* продолжаем каскад */ }
      }

      // ── 2. Open Food Facts ─────────────────────────────────────────────────
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${code}` +
          `?fields=product_name,product_name_ru,brands,quantity,categories_tags,image_front_url`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.status === 1 && json.product) {
            const p = json.product;
            const name  = (p.product_name_ru || p.product_name || '').trim();
            const brand = (p.brands || '').split(',')[0].trim();
            const { quantity, measure } = parseOFFQuantity(p.quantity);
            const category  = mapOFFCategory(p.categories_tags);
            const image_url = p.image_front_url || '';
            if (name || brand) {
              const result = { barcode: code, name, brand, category, measure, quantity, image_url, source: 'off' };
              saveToBarcodeCache(result);
              applyBarcodeResult(result, '🌍 Open Food Facts', target);
              return;
            }
          }
        }
      } catch { /* продолжаем */ }

      // ── 3. UPC Item DB (бесплатный, без ключа) ────────────────────────────
      try {
        const res = await fetch(
          `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`
        );
        if (res.ok) {
          const json = await res.json();
          const item = json.items?.[0];
          if (item?.title) {
            const result = {
              barcode:   code,
              name:      item.title,
              brand:     item.brand || '',
              category:  item.category || '',
              measure:   'шт.',
              quantity:  1,
              image_url: item.images?.[0] || '',
              source:    'upcitemdb'
            };
            saveToBarcodeCache(result);
            applyBarcodeResult(result, '🔍 UPC Item DB', target);
            return;
          }
        }
      } catch { /* продолжаем */ }

      // ── 4. EAN-DB (через серверный прокси /api/barcode) ───────────────────
      try {
        const res = await fetch(`/api/barcode?code=${code}`);
        if (res.ok) {
          const json = await res.json();
          if (json.found && json.name) {
            const result = {
              barcode:   code,
              name:      json.name,
              brand:     json.brand  || '',
              category:  json.category || '',
              measure:   'шт.',
              quantity:  1,
              image_url: json.image_url || '',
              source:    'eandb'
            };
            saveToBarcodeCache(result);
            applyBarcodeResult(result, '📗 EAN-DB', target);
            return;
          }
        }
      } catch { /* продолжаем */ }

      // ── 5. Не найден ──────────────────────────────────────────────────────
      showNotification('Штрихкод не найден — введите данные вручную');
      if (target === 'shopping') {
        setShowAddModal(true);
      }

    } finally {
      setBarcodeLoading(false);
    }
  };

  /** Открывает встроенный сканер штрихкодов (ZXing, поддерживает EAN-13/UPC/QR) */
  const handleBarcodeScan = (target = 'form') => {
    setBarcodeScanTarget(target);
    setShowBarcodeScanner(true);
  };

  const handleBarcodeDetected = useCallback((code) => {
    setShowBarcodeScanner(false);
    if (barcodeScanTarget === 'shopping') {
      fetchByBarcode(code.trim(), 'shopping');
      return;
    }
    setShowAddModal(true); // открываем форму добавления (если ещё не открыта)
    fetchByBarcode(code.trim(), 'form');
  }, [barcodeScanTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToPantry = async (product, quantity = 1, expiryDate = null) => {
    const normPantryName = (n) => String(n || '').trim().toLowerCase();
    const key = normPantryName(product.name);
    const existingItem = pantryItems.find((item) => normPantryName(item.name) === key);

    const shelfLife = product.shelfLife != null ? product.shelfLife : 7;
    const defaultExpiry = expiryDate || new Date(Date.now() + shelfLife * 24 * 60 * 60 * 1000);
    const incomingMeasure = normalizeMeasure(product.measure) || product.measure || 'шт.';
    const payload = {
      name: product.name,
      category: product.category || '🏷️ Прочее',
      measure: incomingMeasure,
      quantity,
      expiryDate: defaultExpiry,
      shelfLife,
      autoFilled: !expiryDate
    };

    if (existingItem) {
      const addedQty = convertQuantity(quantity, incomingMeasure, existingItem.measure);
      const newQ = roundToStep(Number(existingItem.quantity) + addedQty, getQuantityStep(existingItem.measure));
      const ex = existingItem.expiryDate;
      const ne = defaultExpiry;
      let mergedExpiry = null;
      if (ex && ne) mergedExpiry = ex.getTime() <= ne.getTime() ? ex : ne;
      else mergedExpiry = ex || ne;
      const mergedAutoFilled = Boolean(existingItem.autoFilled) && !expiryDate;

      if (usesCloudInventory && existingItem.id) {
        const { data, error } = await updateInventoryRow(existingItem.id, {
          quantity: newQ,
          expiryDate: mergedExpiry,
          autoFilled: mergedAutoFilled
        });
        if (error || !data) {
          console.error('merge inventory', error);
          showNotification('Не удалось обновить количество');
          return;
        }
        const mapped = mapInventoryRowToPantryItem(data);
        setPantryItems((prev) => prev.map((p) => (p.id === existingItem.id ? mapped : p)));
      } else {
        setPantryItems((prev) =>
          prev.map((p) =>
            normPantryName(p.name) === key
              ? {
                  ...p,
                  quantity: newQ,
                  expiryDate: mergedExpiry,
                  autoFilled: mergedAutoFilled
                }
              : p
          )
        );
      }
      showNotification(
        `${product.name}: +${formatQuantityForDisplay(quantity, incomingMeasure)} ${incomingMeasure} → всего ${formatQuantityForDisplay(newQ, existingItem.measure)} ${existingItem.measure}`
      );
    } else if (usesCloudInventory) {
      const { data, error } = await insertInventoryRow(sharedFridgeId, payload);
      if (error) {
        console.error('insert inventory', error);
        showNotification('Не удалось добавить в кладовую');
        return;
      }
      setPantryItems((prev) => [...prev, mapInventoryRowToPantryItem(data)]);
      showNotification(`${product.name} добавлен в кладовую`);
    } else {
      const newItem = {
        id: Date.now(),
        ...product,
        measure: payload.measure,
        quantity,
        expiryDate: defaultExpiry,
        autoFilled: !expiryDate
      };
      setPantryItems((prev) => [...prev, newItem]);
      showNotification(`${product.name} добавлен в кладовую`);
    }
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
      void addToPantry(productToUse, qtyToStore, expiryDate);
    } else if (currentTab === 'shopping') {
      addToShopping(productToUse, qtyToStore);
    } else if (currentTab === 'favorites') {
      toggleFavoriteProduct(selectedProduct);
    }

    // Если есть привязанный баркод — сохраняем продукт в кэш
    if (pendingBarcode) {
      saveToBarcodeCache({
        barcode:  pendingBarcode,
        name:     selectedProduct.name,
        brand:    '',
        category: selectedProduct.category || '🏷️ Прочее',
        measure:  measureToStore,
        quantity: qtyToStore,
        source:   'manual'
      });
    }

    setShowAddModal(false);
    setPendingBarcode('');
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

  const normalizeSearch = (s) => {
    if (!s) return '';
    try {
      return String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    } catch {
      return String(s).toLowerCase().trim();
    }
  };

  const openRecipeLibrary = () => {
    setShowRecipeLibrary(true);
  };

  const closeRecipeLibrary = () => {
    setShowRecipeLibrary(false);
    setRecipeLibraryQuery('');
  };

  const loadRecipeLibrary = useCallback(async () => {
    if (!supabase) {
      showNotification('Supabase не подключён к этой сборке');
      return;
    }
    setRecipeLibraryLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id,name,tags,image,description,time,difficulty,ingredients,steps')
        .order('name', { ascending: true });
      if (error) {
        console.error('recipes load', error);
        showNotification('Не удалось загрузить библиотеку');
        return;
      }
      setRecipeLibrary(Array.isArray(data) ? data : []);

      if (telegramUserId) {
        const { data: favRows } = await supabase
          .from('user_favorites')
          .select('recipe_id')
          .eq('telegram_user_id', telegramUserId);
        const s = new Set((favRows || []).map((r) => r.recipe_id));
        setLibraryFavoriteIds(s);
      } else {
        setLibraryFavoriteIds(new Set());
      }
    } finally {
      setRecipeLibraryLoading(false);
    }
  }, [telegramUserId]);

  useEffect(() => {
    if (!showRecipeLibrary && currentTab !== 'recipes') return;
    loadRecipeLibrary();
  }, [showRecipeLibrary, currentTab, loadRecipeLibrary]);

  // Загрузка рецептов при старте приложения (до входа на вкладку рецептов)
  useEffect(() => {
    if (!supabase) return;
    loadRecipeLibrary();
  }, [loadRecipeLibrary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Импорт рецепта по Telegram deep link (start_param=recipe_UUID)
  useEffect(() => {
    const startParam = tg?.initDataUnsafe?.start_param;
    if (!startParam?.startsWith('recipe_')) return;
    const recipeId = startParam.replace('recipe_', '');
    if (!supabase || !recipeId) return;

    supabase
      .from('recipes')
      .select('id,name,description,time,difficulty,image,ingredients,steps,tags')
      .eq('id', recipeId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        const normalized = {
          id: data.id,
          name: data.name,
          description: data.description || '',
          time: data.time || 0,
          difficulty: data.difficulty || '',
          image: data.image || '',
          ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
          steps: Array.isArray(data.steps) ? data.steps : [],
          tags: data.tags || [],
        };
        setSelectedRecipe(normalized);
        setShowRecipeModal(true);
        setCurrentTab('recipes');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // одноразово при монтировании

  const toggleLibraryFavorite = async (recipe) => {
    if (!supabase || !telegramUserId) {
      showNotification('Избранное доступно в Telegram при подключённом Supabase');
      return;
    }
    const id = recipe?.id;
    if (!id) return;

    const has = libraryFavoriteIds.has(id);
    try {
      if (has) {
        await supabase
          .from('user_favorites')
          .delete()
          .eq('telegram_user_id', telegramUserId)
          .eq('recipe_id', id);
        setLibraryFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showNotification('Удалено из избранного');
        loadMyLibraryFavorites();
      } else {
        await supabase
          .from('user_favorites')
          .upsert(
            { telegram_user_id: telegramUserId, recipe_id: id },
            { onConflict: 'telegram_user_id,recipe_id' }
          );
        setLibraryFavoriteIds((prev) => new Set(prev).add(id));
        showNotification('Добавлено в избранное');
        loadMyLibraryFavorites();
      }
    } catch (e) {
      console.error('favorite toggle', e);
      showNotification('Не удалось обновить избранное');
    }
  };

  const loadMyLibraryFavorites = useCallback(async () => {
    if (!supabase || !telegramUserId) {
      setMyLibraryFavorites([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('recipe_id, recipes ( id, name, tags, image, description, time, difficulty, ingredients, steps )')
        .eq('telegram_user_id', telegramUserId);
      if (error) {
        console.error('user_favorites load', error);
        return;
      }
      const recipes = (data || [])
        .map((row) => row.recipes)
        .filter(Boolean)
        .map((r) => ({
          id: r.id,
          name: r.name,
          tags: r.tags,
          image: r.image || '',
          description: r.description || '',
          time: r.time || 0,
          difficulty: r.difficulty || '',
          ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
          steps: Array.isArray(r.steps) ? r.steps : []
        }));
      setMyLibraryFavorites(recipes);
    } catch (e) {
      console.error('loadMyLibraryFavorites', e);
    }
  }, [telegramUserId]);

  // myLibraryFavorites теперь деривируется из recipeLibrary — отдельная загрузка не нужна

  // Функции для работы с рецептами
  const getAvailableRecipes = () => {
    // Единый источник: все рецепты из Supabase + пользовательские рецепты
    const catalogRecipes = recipeLibrary;
    const allRecipes = [...catalogRecipes, ...customRecipes];

    // дедупликация по id
    const seen = new Set();
    const unique = allRecipes.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return unique.filter((recipe) => {
      if (!Array.isArray(recipe.ingredients)) return false;
      const availableCount = recipe.ingredients.filter((ingredient) => {
        const m = getIngredientPantryMatch(pantryItems, ingredient);
        return m.kind === 'available' || m.kind === 'partial';
      }).length;
      return availableCount >= 2;
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

  const moveCompletedItemsToPantry = async () => {
    const completedItems = shoppingItems.filter((item) => item.completed);

    if (completedItems.length === 0) {
      showNotification('Нет отмеченных товаров для переноса');
      return;
    }

    let localPantry = [...pantryItems];
    for (const item of completedItems) {
      const productInDB = PRODUCTS_DB.find((p) => p.name === item.name);
      const shelfLife = productInDB ? productInDB.shelfLife : 7;
      const expiryDate = new Date(Date.now() + shelfLife * 24 * 60 * 60 * 1000);
      const existingPantryItem = localPantry.find((pantryItem) => pantryItem.name === item.name);

      if (usesCloudInventory) {
        if (existingPantryItem) {
          const addedQty = convertQuantity(item.quantity, item.measure, existingPantryItem.measure);
          const newQ = roundToStep(Number(existingPantryItem.quantity) + addedQty, getQuantityStep(existingPantryItem.measure));
          const { data, error } = await updateInventoryRow(existingPantryItem.id, { quantity: newQ });
          if (error || !data) {
            showNotification(`Не удалось перенести: ${item.name}`);
            continue;
          }
          const mapped = mapInventoryRowToPantryItem(data);
          localPantry = localPantry.map((p) => (p.id === existingPantryItem.id ? mapped : p));
        } else {
          const { data, error } = await insertInventoryRow(sharedFridgeId, {
            name: item.name,
            category: item.category || '🏷️ Прочее',
            measure: item.measure,
            quantity: item.quantity,
            expiryDate,
            shelfLife,
            autoFilled: true
          });
          if (error || !data) {
            showNotification(`Не удалось перенести: ${item.name}`);
            continue;
          }
          localPantry = [...localPantry, mapInventoryRowToPantryItem(data)];
        }
      } else if (existingPantryItem) {
        const addedQty = convertQuantity(item.quantity, item.measure, existingPantryItem.measure);
        localPantry = localPantry.map((pantryItem) =>
          pantryItem.name === item.name
            ? { ...pantryItem, quantity: pantryItem.quantity + addedQty }
            : pantryItem
        );
      } else {
        const newPantryItem = {
          id: Date.now() + Math.random(),
          name: item.name,
          category: item.category,
          measure: item.measure,
          quantity: item.quantity,
          expiryDate,
          addedAt: new Date()
        };
        localPantry = [...localPantry, newPantryItem];
      }
    }

    setPantryItems(localPantry);

    setShoppingItems((prev) => prev.filter((item) => !item.completed));
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
    const m = getIngredientPantryMatch(pantryItems, ingredient);
    if (m.kind === 'missing') return { status: 'missing', color: 'text-red-500' };
    if (m.kind === 'available') return { status: 'available', color: 'text-green-500' };
    return { status: 'partial', color: 'text-yellow-500', available: m.available };
  };

  const addMissingIngredientsToCart = (recipe) => {
    if (!recipe || !Array.isArray(recipe.ingredients)) {
      showNotification('У рецепта нет ингредиентов');
      return;
    }

    const normalizeName = (s) => {
      try {
        return String(s).toLowerCase().normalize('NFC').replace(/[^а-яёa-z0-9]+/gi, ' ').trim();
      } catch (e) {
        return String(s).toLowerCase().trim();
      }
    };

    const itemsToAdd = [];

    recipe.ingredients.forEach(ingredient => {
      if (!ingredient || !ingredient.name) return;
      const status = getIngredientStatus(ingredient);
      const needQuantity = status.status === 'missing'
        ? ingredient.amount
        : status.status === 'partial'
          ? Math.max(0, ingredient.amount - (status.available || 0))
          : 0;
      if (needQuantity <= 0) return;

      const ingNameNorm = normalizeName(ingredient.name);
      let product = PRODUCTS_DB.find(p => normalizeName(p.name) === ingNameNorm);
      if (!product) {
        product = PRODUCTS_DB.find(p => {
          const pn = normalizeName(p.name);
          return pn.includes(ingNameNorm) || ingNameNorm.includes(pn);
        });
      }

      const qty = parseFloat(needQuantity) || 1;
      itemsToAdd.push({
        id: Date.now() + Math.random(),
        name: ingredient.name,
        category: product?.category || '🏷️ Прочее',
        measure: ingredient.measure || product?.measure || 'шт.',
        quantity: qty,
        completed: false,
        addedAt: new Date(),
        note: `для ${recipe.name}`
      });
    });

    if (itemsToAdd.length === 0) {
      showNotification('Нет недостающих ингредиентов для добавления');
      return;
    }

    // Единое обновление корзины — без stale closure
    setShoppingItems(prev => {
      let updated = [...prev];
      itemsToAdd.forEach(newItem => {
        const existing = updated.find(i => i.name === newItem.name && !i.completed);
        if (existing) {
          updated = updated.map(i =>
            i.id === existing.id ? { ...i, quantity: i.quantity + newItem.quantity } : i
          );
        } else {
          updated.push(newItem);
        }
      });
      return updated;
    });

    showNotification(`Добавлено ${itemsToAdd.length} ингредиентов в корзину`);
  };

  const hasExpiredItems = pantryItems.some(item => item.expiryDate < new Date());
  const [sortByExpiry, setSortByExpiry] = useState(false);

  // Функция для группировки продуктов по категориям
  const groupItemsByCategory = (items) => {
    if (!Array.isArray(items)) return {};
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

  const getLocalDayKey = (d) => {
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const notifiedExpiryRef = useRef(new Set());
  const lastExpiryDayKeyRef = useRef(null);

  // Ассистентские уведомления: сегодня вечером (после 17:00) для продуктов,
  // срок годности которых заканчивается сегодня.
  useEffect(() => {
    const check = () => {
      const now = new Date();
      if (now.getHours() < 17) return;

      const todayKey = getLocalDayKey(now);
      if (lastExpiryDayKeyRef.current !== todayKey) {
        lastExpiryDayKeyRef.current = todayKey;
        notifiedExpiryRef.current = new Set();
      }

      const candidates = pantryItems
        .map((item) => ({ item, expiry: item?.expiryDate ? new Date(item.expiryDate) : null }))
        .filter(({ item, expiry }) => {
          if (!item || !expiry) return false;
          if (expiry <= now) return false;
          return getLocalDayKey(expiry) === todayKey;
        })
        .sort((a, b) => a.expiry - b.expiry);

      const chosen = candidates[0];
      if (!chosen) return;

      const notifyKey = `${chosen.item.id}_${todayKey}`;
      if (notifiedExpiryRef.current.has(notifyKey)) return;

      notifiedExpiryRef.current.add(notifyKey);
      showNotification(
        `Срок годности '${chosen.item.name}' истекает сегодня вечером. Не забудьте поужинать!`,
        3500
      );
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [pantryItems]);

  const toLocalDate = (dateStr) => {
    // Дата из input type="date" приходит как YYYY-MM-DD.
    // Добавляем "T00:00:00", чтобы парсинг не уезжал из-за таймзоны.
    try {
      return new Date(`${dateStr}T00:00:00`);
    } catch {
      return new Date();
    }
  };

  const calcMealExpiresAt = (preparedDate, category) => {
    const base = preparedDate instanceof Date ? preparedDate : new Date(preparedDate);
    const days = MEAL_DEFAULT_DAYS_BY_CATEGORY[category] ?? 1;
    return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  };

  const formatHoursLeft = (expiresAt) => {
    if (!expiresAt) return '';
    const diffMs = expiresAt - new Date();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffHours >= 0) return `${diffHours} ч осталось`;
    return `${Math.abs(diffHours)} ч просрочено`;
  };

  const handleAddPreparedMeal = () => {
    const name = mealFormData.name.trim();
    const category = mealFormData.category;
    const preparedDateStr = mealFormData.preparedDate;

    if (!name) {
      showNotification('Введите название блюда');
      return;
    }
    if (!category) {
      showNotification('Выберите категорию');
      return;
    }
    if (!preparedDateStr) {
      showNotification('Выберите дату приготовления');
      return;
    }

    const preparedDate = toLocalDate(preparedDateStr);
    const expiresAt = calcMealExpiresAt(preparedDate, category);

    const portions = Math.max(
      1,
      Math.floor(Number(mealFormData.portions)) || defaultMealPortionsForCategory(category)
    );
    const newMeal = {
      id: Date.now(),
      name,
      category,
      preparedDate,
      expiresAt,
      portions
    };

    setPreparedMeals((prev) => [newMeal, ...prev]);
    showNotification('Готовое блюдо добавлено');

    setShowAddMealModal(false);
    setMealFormData({
      name: '',
      category: 'Суп',
      preparedDate: new Date().toISOString().split('T')[0],
      portions: defaultMealPortionsForCategory('Суп')
    });
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

  const canQuickSwitchFridge = Boolean(
    supabase &&
      telegramUserId &&
      personalFridgeRow?.id &&
      linkedSharedFridgeId &&
      linkedSharedFridgeId !== personalFridgeRow.id
  );

  const copyAccountLine = async (text, doneMsg = 'Скопировано') => {
    if (text == null || text === '') return;
    const s = String(text);
    try {
      await navigator.clipboard.writeText(s);
      showNotification(doneMsg);
    } catch {
      showNotification(s);
    }
  };

  const cabinetFridgeIdsOrdered = [
    ...new Set([sharedFridgeId, personalFridgeRow?.id, linkedSharedFridgeId].filter(Boolean))
  ];

  return (
    <div className="min-h-screen bg-gray-50 relative isolate">
      {isLoadingState && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow">
            <div className="text-gray-700 font-medium">Загрузка данных...</div>
          </div>
        </div>
      )}
      {/* Top Bar: иконки в одном ряду с заголовком, без absolute — ниже выреза/notch */}
      <div
        className="bg-white shadow-sm px-2 pb-2 flex flex-col gap-0.5"
        style={{
          /* В Telegram не суммируем env(safe-area) с contentSafeAreaInset — иначе огромный зазор под «Закрыть» */
          paddingTop: tg
            ? `${Math.max(telegramHeaderPadPx + 25, 10)}px`
            : 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))'
        }}
      >
        <div className="flex items-center gap-1 min-h-[48px]">
          <div className="shrink-0 w-12 flex items-center justify-center">
            {currentTab === 'pantry' && pantrySubTab === 'products' ? (
              <button
                type="button"
                onClick={() => setSortByExpiry(prev => !prev)}
                className={`p-2 rounded-xl transition-colors ${
                  sortByExpiry ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:bg-gray-50'
                }`}
                title={sortByExpiry ? 'Сортировка по сроку: вкл.' : 'Сортировать по сроку годности'}
                aria-label="Сортировать по сроку годности"
              >
                <Calendar size={22} />
              </button>
            ) : currentTab === 'recipes' ? (
              <button
                type="button"
                onClick={openRecipeLibrary}
                className="p-2 rounded-xl transition-colors text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                title="Книга рецептов"
                aria-label="Открыть библиотеку рецептов"
              >
                <BookOpen size={22} />
              </button>
            ) : null}
          </div>
          {currentTab === 'pantry' && canQuickSwitchFridge ? (
            <button
              type="button"
              onClick={() => setFridgeSwitchOpen(true)}
              className="flex-1 min-w-0 flex items-center justify-center gap-0.5 text-lg font-semibold leading-tight px-1 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
              aria-haspopup="dialog"
              aria-expanded={fridgeSwitchOpen}
              aria-label="Выбрать кладовую"
            >
              <span className="truncate capitalize">{fridgeDisplayName || 'Кладовая'}</span>
              {hasExpiredItems && <span className="text-orange-500 shrink-0">!</span>}
              <ChevronDown className="shrink-0 w-5 h-5 text-gray-500" strokeWidth={2.5} aria-hidden />
            </button>
          ) : (
            <h1 className="flex-1 min-w-0 text-center text-lg font-semibold capitalize leading-tight px-1 truncate">
              {currentTab === 'pantry' && (fridgeDisplayName || 'Кладовая')}
              {currentTab === 'favorites' && 'Избранное'}
              {currentTab === 'recipes' && 'Рецепты'}
              {currentTab === 'shopping' && 'Покупки'}
              {hasExpiredItems && currentTab === 'pantry' && (
                <span className="ml-2 text-orange-500">!</span>
              )}
            </h1>
          )}
          <div className="shrink-0 flex items-center justify-center gap-0.5">
            {currentTab === 'pantry' && (
              <button
                type="button"
                onClick={() => setShowAccountModal(true)}
                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                title="Личный кабинет"
                aria-label="Личный кабинет"
              >
                <User size={22} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className={`p-2 rounded-xl hover:bg-blue-50 ${
                supabase && telegramUserId ? 'text-blue-500' : 'text-gray-400'
              }`}
              title={
                !telegramUserId
                  ? 'Семейный холодильник — откройте из Telegram'
                  : !supabase
                    ? 'Нужны переменные Supabase в сборке (Vercel)'
                    : 'Семейный холодильник'
              }
              aria-label="Поделиться кладовой"
            >
              <Share2 size={22} />
            </button>
          </div>
        </div>
      </div>

      {fridgeSwitchOpen && canQuickSwitchFridge && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[58] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !fridgeSwitchBusy && setFridgeSwitchOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Кладовые"
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold">Кладовая</h2>
              <button
                type="button"
                className="text-gray-500 p-1"
                onClick={() => !fridgeSwitchBusy && setFridgeSwitchOpen(false)}
                aria-label="Закрыть"
              >
                <X size={22} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Быстрое переключение между личной и общей</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={fridgeSwitchBusy}
                onClick={() => switchToFridgeId(personalFridgeRow.id)}
                className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-2 transition-colors ${
                  sharedFridgeId === personalFridgeRow.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                } ${fridgeSwitchBusy ? 'opacity-60' : ''}`}
              >
                <span className="text-lg" aria-hidden>
                  🏠
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium block truncate">{personalFridgeRow.name}</span>
                  <span className="text-xs text-gray-500">Личная</span>
                </span>
                {sharedFridgeId === personalFridgeRow.id && (
                  <Check className="shrink-0 text-blue-500" size={20} />
                )}
              </button>
              <button
                type="button"
                disabled={fridgeSwitchBusy}
                onClick={() => switchToFridgeId(linkedSharedFridgeId)}
                className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-2 transition-colors ${
                  sharedFridgeId === linkedSharedFridgeId
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                } ${fridgeSwitchBusy ? 'opacity-60' : ''}`}
              >
                <span className="text-lg" aria-hidden>
                  👨‍👩‍👧
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium block truncate">
                    {linkedSharedFridgeName || 'Семейная кладовая'}
                  </span>
                  <span className="text-xs text-gray-500">Общая</span>
                </span>
                {sharedFridgeId === linkedSharedFridgeId && (
                  <Check className="shrink-0 text-blue-500" size={20} />
                )}
              </button>
            </div>
            {fridgeSwitchBusy && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-600">
                <Loader2 className="animate-spin" size={18} />
                Переключение…
              </div>
            )}
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold pr-8">Семейный холодильник</h2>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-gray-500 shrink-0"
                aria-label="Закрыть"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Продукты в кладовой хранятся в облаке (таблица inventory): видны всем в группе. Изменения приходят в реальном времени и дублируются опросом ~20 с при возврате в приложение.
            </p>
            {!supabase || !telegramUserId ? (
              <div className="space-y-3 text-sm text-orange-700 bg-orange-50 rounded-xl p-4">
                {!telegramUserId && (
                  <>
                    <p>
                      <span className="font-semibold">Нет авторизации.</span> В Telegram Mini App ID берётся автоматически.
                      В обычном браузере войдите через Telegram, чтобы работала общая кладовая.
                    </p>
                    <div className="bg-white rounded-xl p-3 border border-orange-200">
                      <div ref={tgLoginWidgetHostRef} />
                      <p className="text-xs text-gray-500 mt-2">
                        Если кнопка не появилась — проверьте в Vercel переменную <code className="text-[11px] bg-white px-1 rounded">VITE_TELEGRAM_BOT_USERNAME</code>.
                      </p>
                    </div>
                  </>
                )}
                {telegramUserId && !supabase && (
                  <p>
                    <span className="font-semibold">Supabase не подключён к этой сборке.</span> В Vercel → Project → Settings → Environment Variables для <strong>Production</strong> задайте{' '}
                    <code className="text-xs bg-white px-1 rounded">VITE_SUPABASE_URL</code> и{' '}
                    <code className="text-xs bg-white px-1 rounded">VITE_SUPABASE_ANON_KEY</code>, затем сделайте redeploy.
                  </p>
                )}
                {!telegramUserId && supabase && (
                  <p className="text-gray-600">После открытия из Telegram кнопка станет синей — можно создавать код или вводить код семьи.</p>
                )}
              </div>
            ) : sharedFridgeId && !fridgeIsPersonal ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Вы в <span className="font-medium text-gray-800">семейной</span> кладовой{fridgeDisplayName ? ` «${fridgeDisplayName}»` : ''}. Поделитесь кодом или покиньте группу.
                </p>
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Код приглашения</div>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 text-center text-lg font-mono tracking-widest bg-gray-100 rounded-xl py-3 px-2">
                      {sharedInviteCode || '—'}
                    </code>
                    <button
                      type="button"
                      onClick={copySharedInviteCode}
                      disabled={!sharedInviteCode}
                      className="bg-gray-200 text-gray-800 px-4 py-3 rounded-xl font-medium disabled:opacity-50"
                    >
                      Копировать
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={leaveSharedFridge}
                  disabled={shareBusy}
                  className="w-full border border-red-200 text-red-600 py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  {shareBusy ? '…' : 'Покинуть общую кладовую'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sharedFridgeId && fridgeIsPersonal && (
                  <p className="text-sm text-gray-600 bg-blue-50 rounded-xl p-3 border border-blue-100">
                    Сейчас у вас <span className="font-medium">личная кладовая</span>. Создайте приглашение (продукты станут общими) или введите код семьи ниже.
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Название холодильника для семьи</label>
                  <input
                    type="text"
                    value={createFridgeNameDraft}
                    onChange={(e) => setCreateFridgeNameDraft(e.target.value)}
                    placeholder="Например: Дом на Мира"
                    className="w-full p-3 border border-gray-200 rounded-xl"
                    maxLength={80}
                  />
                  <p className="text-xs text-gray-500 mt-1">Будет видно всем, кто вошёл по коду. Можно оставить пустым — тогда «Наша кладовая».</p>
                </div>
                <button
                  type="button"
                  onClick={createSharedFridge}
                  disabled={shareBusy}
                  className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  {shareBusy ? 'Подождите…' : 'Создать приглашение (текущие данные станут общими)'}
                </button>
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">или</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Код от семьи</label>
                  <input
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    value={joinCodeDraft}
                    onChange={(e) => setJoinCodeDraft(e.target.value.toUpperCase())}
                    placeholder="Например AB12CD"
                    className="w-full p-3 border border-gray-200 rounded-xl font-mono tracking-wide uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={joinSharedFridge}
                  disabled={shareBusy}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  {shareBusy ? 'Подождите…' : 'Присоединиться по коду'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAccountModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]"
          onClick={() => setShowAccountModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold pr-8">Личный кабинет</h2>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="text-gray-500 shrink-0"
                aria-label="Закрыть"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Учётная запись и кладовые. Ссылку-приглашение можно отправить в Telegram — по ней откроется мини-приложение
              и вступление в общую кладовую (нужен бот с тем же username, что в ссылке).
            </p>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                <div className="text-xs font-medium text-gray-500 mb-1">Telegram user id</div>
                <div className="flex items-start gap-2">
                  <code className="text-xs break-all flex-1 text-gray-800">
                    {telegramUserId || 'Неизвестно — откройте приложение из Telegram'}
                  </code>
                  {telegramUserId ? (
                    <button
                      type="button"
                      onClick={() => copyAccountLine(telegramUserId)}
                      className="shrink-0 text-xs text-blue-600 font-medium"
                    >
                      Копировать
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Кладовые</div>
              {cabinetFridgeIdsOrdered.map((fid) => {
                const meta = cabinetFridgeGroups[fid];
                const isCurrent = fid === sharedFridgeId;
                const title =
                  meta?.name ||
                  (fid === personalFridgeRow?.id ? personalFridgeRow?.name : null) ||
                  (fid === linkedSharedFridgeId ? linkedSharedFridgeName : null) ||
                  (isCurrent ? fridgeDisplayName : null) ||
                  'Кладовая';
                const isPersonal =
                  meta?.is_personal != null ? Boolean(meta.is_personal) : fid === personalFridgeRow?.id;
                const inviteCode =
                  meta?.invite_code ||
                  (isCurrent && !fridgeIsPersonal ? sharedInviteCode : null) ||
                  null;
                const inviteLink = !isPersonal && inviteCode ? buildFridgeInviteTelegramLink(inviteCode) : '';
                const canSwitch = Boolean(supabase && telegramUserId && fid && !isCurrent);
                return (
                  <div key={fid} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{title}</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {isPersonal ? 'Личная' : 'Общая'}
                          {isCurrent ? ' · сейчас открыта' : ''}
                          {!isPersonal && inviteCode ? ` · код ${inviteCode}` : ''}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0 items-stretch">
                        <button
                          type="button"
                          disabled={!canSwitch || fridgeSwitchBusy}
                          onClick={async () => {
                            await switchToFridgeId(fid);
                            setShowAccountModal(false);
                          }}
                          className="text-xs font-medium px-3 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-40 disabled:pointer-events-none"
                        >
                          {isCurrent ? 'Открыта' : 'Открыть'}
                        </button>
                        {isPersonal ? (
                          <span className="text-[10px] text-gray-500 text-center px-1">
                            Ссылка только для общей кладовой
                          </span>
                        ) : inviteLink ? (
                          <button
                            type="button"
                            onClick={() =>
                              copyAccountLine(inviteLink, 'Ссылка скопирована — отправьте в Telegram')
                            }
                            className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 flex items-center justify-center gap-1"
                          >
                            <Share2 size={14} aria-hidden />
                            Ссылка-приглашение
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500 text-center">Загрузка кода…</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 pt-1 border-t border-gray-200/80">
                      <code className="text-[10px] break-all flex-1 text-gray-600">{fid}</code>
                      <button
                        type="button"
                        onClick={() => copyAccountLine(fid, 'ID кладовой скопирован')}
                        className="shrink-0 text-[10px] text-blue-600 font-medium"
                      >
                        Копировать
                      </button>
                    </div>
                  </div>
                );
              })}
              {cabinetFridgeIdsOrdered.length === 0 ? (
                <p className="text-sm text-gray-500">Кладовые ещё не загружены.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

  {/* Content */}
  <div
    className="px-4 pt-2 relative z-0 pb-[max(9rem,calc(7rem+env(safe-area-inset-bottom,0px)))]"
    ref={contentRef}
  >
        {/* Main Content */}
        <div className="space-y-4">
          {currentTab === 'pantry' && (
            <div>

              <div className="flex gap-2 bg-white rounded-xl p-1 shadow-sm mb-4">
                <button
                  type="button"
                  onClick={() => setPantrySubTab('products')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    pantrySubTab === 'products' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Продукты
                </button>
                <button
                  type="button"
                  onClick={() => setPantrySubTab('meals')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    pantrySubTab === 'meals' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Готовые блюда
                </button>
              </div>

              {pantrySubTab === 'products' && (pantryItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Кладовая пуста. Добавьте продукты!
                </div>
              ) : (() => {
                const renderItem = (item, showCategory = false) => {
                  const expiryStatus = getExpiryStatus(item.expiryDate);
                  const removePantryItem = () => {
                    if (usesCloudInventory && item.id) {
                      const id = item.id;
                      const snap = { ...item };
                      setPantryItems((prev) => prev.filter((p) => p.id !== id));
                      showNotification(`${item.name} удален из кладовой`);
                      deleteInventoryRow(id).then(({ error }) => {
                        if (error) {
                          setPantryItems((prev) => [...prev, snap]);
                          showNotification('Не удалось удалить продукт');
                        }
                      });
                      return;
                    }
                    setPantryItems((prev) => prev.filter((p) => p.id !== item.id));
                    showNotification(`${item.name} удален из кладовой`);
                  };
                  return (
                    <SwipeToDeleteRow key={item.id} className="rounded-xl" onDelete={removePantryItem}>
                      <div className="p-4">
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
                                  expiryDate: item.expiryDate.toISOString().split('T')[0],
                                  category: item.category || '🏷️ Прочее'
                                });
                                setShowEditModal(true);
                              }}
                              className="block max-w-full text-left text-sm font-semibold leading-snug text-gray-900 hover:text-blue-600 transition-colors"
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
                                  expiryDate: item.expiryDate.toISOString().split('T')[0],
                                  category: item.category || '🏷️ Прочее'
                                });
                                setShowEditModal(true);
                              }}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit3 size={16} />
                            </button>
                          </div>
                          {showCategory && (
                            <div className="text-xs text-gray-400 mt-0.5">{item.category || '🏷️ Прочее'}</div>
                          )}
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
                            onClick={() => handleKus(item)}
                            className="text-xs bg-orange-100 text-orange-600 hover:bg-orange-200 active:bg-orange-300 rounded-full px-2 py-1 transition-colors font-semibold leading-tight"
                            title="Съесть одну порцию"
                          >
                            🍴&nbsp;Кусь!
                          </button>
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
                            type="button"
                            onClick={removePantryItem}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            title="Удалить продукт"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                      </div>
                    </SwipeToDeleteRow>
                  );
                };

                if (sortByExpiry) {
                  const sorted = [...pantryItems].sort(
                    (a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)
                  );
                  return (
                    <div className="space-y-2">
                      {sorted.map(item => renderItem(item, true))}
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {Object.entries(groupItemsByCategory(pantryItems)).map(([category, items]) => (
                      <div key={category}>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          {category}
                        </h3>
                        <div className="space-y-2">
                          {items.map(item => renderItem(item, false))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })())}
            </div>
          )}

          {currentTab === 'pantry' && pantrySubTab === 'meals' && (
            <div className="space-y-3">
              {preparedMeals.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Пока нет готовых блюд. Добавьте первое!
                </div>
              ) : (
                [...preparedMeals]
                  .sort((a, b) => a.expiresAt - b.expiresAt)
                  .map((meal) => (
                    <div
                      key={meal.id}
                      className="bg-orange-50 border border-orange-100 rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingMeal(meal);
                                setEditMealFormData({
                                  name: meal.name,
                                  category: meal.category,
                                  portions: meal.portions ?? 3,
                                  preparedDate: meal.preparedDate ? meal.preparedDate.toISOString().split('T')[0] : '',
                                  expiresAt: meal.expiresAt ? meal.expiresAt.toISOString().split('T')[0] : ''
                                });
                                setShowEditMealModal(true);
                              }}
                              className="font-semibold text-gray-900 text-left hover:text-blue-600 transition-colors"
                              title="Редактировать блюдо"
                            >
                              {meal.name}
                            </button>
                            <button
                              onClick={() => {
                                setEditingMeal(meal);
                                setEditMealFormData({
                                  name: meal.name,
                                  category: meal.category,
                                  portions: meal.portions ?? 3,
                                  preparedDate: meal.preparedDate ? meal.preparedDate.toISOString().split('T')[0] : '',
                                  expiresAt: meal.expiresAt ? meal.expiresAt.toISOString().split('T')[0] : ''
                                });
                                setShowEditMealModal(true);
                              }}
                              className="text-gray-400 hover:text-blue-500 transition-colors"
                              title="Редактировать блюдо"
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {meal.category}
                          </div>
                          {meal.portions != null && (
                            <div className="text-xs text-orange-600 font-semibold mt-1">
                              Порций осталось: {meal.portions}
                            </div>
                          )}
                          {meal.expiresAt && (() => {
                            const mealExpiry = getExpiryStatus(meal.expiresAt);
                            return (
                              <div className="text-sm mt-1">
                                <span className={`${mealExpiry.color} font-medium`}>
                                  до {meal.expiresAt.toLocaleDateString('ru-RU')}
                                </span>
                                <span className={`ml-1 ${mealExpiry.color}`}>
                                  ({mealExpiry.status === 'expired'
                                    ? `просрочено ${mealExpiry.days} дн.`
                                    : `${mealExpiry.days} дн.`})
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleMealKus(meal)}
                              className="text-xs bg-orange-100 text-orange-600 hover:bg-orange-200 active:bg-orange-300 rounded-full px-2 py-1 transition-colors font-semibold leading-tight"
                              title="Съесть одну порцию"
                            >
                              🍴&nbsp;Кусь!
                            </button>
                            <button
                              onClick={() => toggleFavoriteMeal(meal)}
                              className={`transition-colors ${
                                favoriteMeals.some(m => m.id === meal.id)
                                  ? 'text-red-500 hover:text-red-700'
                                  : 'text-gray-400 hover:text-red-500'
                              }`}
                              title="В избранное"
                            >
                              <Heart size={20} fill={favoriteMeals.some(m => m.id === meal.id) ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              onClick={() => {
                                setPreparedMeals(prev => prev.filter(m => m.id !== meal.id));
                                showNotification(`${meal.name} удалено`);
                              }}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Удалить блюдо"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {currentTab === 'shopping' && (
            <div>
              
              {/* Панель управления */}
              {shoppingItems.length > 0 && (
                <div className="flex flex-nowrap items-stretch gap-2 bg-white rounded-xl p-3 shadow-sm mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Удалить все товары из списка покупок?')) {
                        setShoppingItems([]);
                        showNotification('Список покупок очищен');
                      }
                    }}
                    className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-red-500 text-white px-2 py-2.5 rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
                  >
                    <Trash2 size={15} className="shrink-0" />
                    <span className="truncate">Удалить всё</span>
                  </button>
                  <button
                    type="button"
                    onClick={moveCompletedItemsToPantry}
                    disabled={!shoppingItems.some(item => item.completed)}
                    className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      shoppingItems.some(item => item.completed)
                        ? 'bg-green-500 text-white hover:bg-green-600 shadow-md'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Check size={16} className="shrink-0" />
                    <span className="truncate">В кладовую</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textList = `Закупись:\n${Object.entries(groupItemsByCategory(shoppingItems))
                        .map(([category, items]) => {
                          const categoryItems = items.map((item) => formatShoppingExportLine(item)).join('\n');
                          return `${category}:\n${categoryItems}`;
                        }).join('\n\n')}`;
                      navigator.clipboard.writeText(textList).then(() => {
                        showNotification('Список скопирован в буфер обмена');
                      });
                    }}
                    className="shrink-0 w-11 h-11 self-center flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm"
                    title="Экспорт: скопировать список"
                    aria-label="Экспорт списка в буфер обмена"
                  >
                    <Upload size={18} strokeWidth={2.25} />
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
                        {items.map((item) => {
                          const removeShoppingItem = () => {
                            setShoppingItems((prev) => prev.filter((s) => s.id !== item.id));
                            showNotification('Продукт удален');
                          };
                          return (
                            <SwipeToDeleteRow key={item.id} className="rounded-xl" onDelete={removeShoppingItem}>
                              <div className={`p-4 ${item.completed ? 'opacity-50' : ''}`}>
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedItems = shoppingItems.map((shopItem) =>
                                          shopItem.id === item.id
                                            ? { ...shopItem, completed: !shopItem.completed }
                                            : shopItem
                                        );
                                        setShoppingItems(updatedItems);
                                      }}
                                      className={`w-6 h-6 min-w-6 min-h-6 shrink-0 aspect-square rounded-full border-2 p-0 appearance-none flex items-center justify-center transition-all duration-200 ${
                                        item.completed
                                          ? 'bg-green-500 border-green-500 text-white shadow-md'
                                          : 'border-gray-300 hover:border-green-400 bg-white'
                                      }`}
                                      title={item.completed ? 'Отменить покупку' : 'Отметить как купленное'}
                                    >
                                      {item.completed && <Check size={14} />}
                                    </button>
                                    <div>
                                      <div
                                        className={`font-semibold ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                                      >
                                        {item.name}
                                        {item.note && (
                                          <span className="text-gray-400 font-normal ml-2">({item.note})</span>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {item.quantity} {item.measure}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingItem(item);
                                        setEditFormData({
                                          name: item.name,
                                          quantity: item.quantity,
                                          measure: item.measure,
                                          expiryDate: '',
                                          category: item.category || '🏷️ Прочее'
                                        });
                                        setShowEditModal(true);
                                      }}
                                      className="text-blue-500"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button type="button" onClick={removeShoppingItem} className="text-red-500">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </SwipeToDeleteRow>
                          );
                        })}
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
                <h2 className="text-xl font-bold mb-4">
                  Возможные рецепты
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    (кладовая: {pantryItems.length} пр., каталог: {recipeLibrary.length} рец.)
                  </span>
                </h2>
                {(() => {
                  const available = getAvailableRecipes();
                  if (available.length === 0) {
                    return (
                      <div className="text-center text-gray-400 py-6 text-sm">
                        {pantryItems.length === 0
                          ? 'Добавьте продукты в кладовую — здесь появятся подходящие рецепты'
                          : 'Нет рецептов, для которых уже есть 2+ продукта в кладовой'}
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      {available.map(recipe => (
                        <RecipeCard
                          key={recipe.id}
                          recipe={recipe}
                          pantryItems={pantryItems}
                          isCustom={false}
                          prioritizeAvailableIngredients={true}
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
                  );
                })()}
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
                  {recipeLibrary.filter(r => libraryFavoriteIds.has(r.id)).map((recipe) => (
                    <RecipeCard
                      key={`fav-${recipe.id}`}
                      recipe={recipe}
                      pantryItems={pantryItems}
                      isCustom={false}
                      onAddToCart={addRecipeToCart}
                      onToggleFavorite={toggleLibraryFavorite}
                      onViewDetails={(r) => {
                        setSelectedRecipe(r);
                        setShowRecipeModal(true);
                      }}
                      onDelete={(r) => toggleLibraryFavorite(r)}
                      deleteTitle="Убрать из моей книги"
                      isFavorite={true}
                    />
                  ))}
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
                      onDelete={(r) => deleteCustomRecipe(r.id)}
                      deleteTitle="Удалить рецепт"
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
        <>
          <button
            onClick={() => {
              if (currentTab === 'pantry' && pantrySubTab === 'meals') {
                setShowAddMealModal(true);
              } else {
                setShowAddModal(true);
              }
            }}
            className="fixed bottom-20 right-4 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-[60]"
          >
            <Plus size={24} />
          </button>

          {((currentTab === 'pantry' && pantrySubTab === 'products') || currentTab === 'shopping') && (
            <button
              onClick={() => handleBarcodeScan(currentTab === 'shopping' ? 'shopping' : 'form')}
              className="fixed bottom-20 right-20 bg-gray-700 text-white p-4 rounded-full shadow-lg hover:bg-gray-800 transition-colors z-[60]"
              title="Сканировать штрихкод"
            >
              <ScanLine size={24} />
            </button>
          )}
        </>
      )}

      {/* Bottom Navigation — z-50 выше контента со transform (свайп), иначе карточки перекрывают бар */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-[0_-4px_16px_rgba(0,0,0,0.07)]">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => { setShowAddModal(false); setPendingBarcode(''); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {currentTab === 'pantry' && 'Добавить в кладовую'}
                {currentTab === 'shopping' && 'Добавить в покупки'}
                {currentTab === 'favorites' && 'Добавить в избранное'}
                {currentTab === 'recipes' && 'Добавить рецепт'}
              </h2>
              <button
                onClick={() => { setShowAddModal(false); setPendingBarcode(''); }}
                className="text-gray-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Название продукта</label>
                  <button
                    type="button"
                    onClick={handleBarcodeScan}
                    disabled={barcodeLoading}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                    title="Сканировать штрихкод"
                  >
                    {barcodeLoading
                      ? <Loader2 size={15} className="animate-spin" />
                      : <ScanLine size={15} />}
                    {barcodeLoading ? 'Загрузка...' : 'Штрихкод'}
                  </button>
                </div>
                <AutocompleteInput
                  value={addFormData.name}
                  onChange={(value) => setAddFormData(prev => ({ ...prev, name: value, autoFilled: false }))}
                  onSelect={handleProductSelect}
                  placeholder="Название продукта"
                  products={PRODUCTS_DB}
                />
                {pendingBarcode && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600">
                    <ScanLine size={12} />
                    <span>Штрихкод <span className="font-mono">{pendingBarcode}</span> будет сохранён</span>
                  </div>
                )}
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
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
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

      {/* Add Prepared Meal Modal */}
      {showAddMealModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setShowAddMealModal(false);
            setMealFormData({
              name: '',
              category: 'Суп',
              preparedDate: new Date().toISOString().split('T')[0],
              portions: defaultMealPortionsForCategory('Суп')
            });
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Добавить готовое блюдо</h2>
              <button
                onClick={() => {
                  setShowAddMealModal(false);
                  setMealFormData({
                    name: '',
                    category: 'Суп',
                    preparedDate: new Date().toISOString().split('T')[0],
                    portions: defaultMealPortionsForCategory('Суп')
                  });
                }}
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
                  value={mealFormData.name}
                  onChange={(e) => setMealFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  placeholder="Например Борщ"
                />
              </div>

              <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Количество порций в заготовке
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMealFormData((prev) => ({
                        ...prev,
                        portions: Math.max(1, (Number(prev.portions) || 1) - 1)
                      }))
                    }
                    className="bg-white border border-gray-200 text-gray-700 w-10 h-10 rounded-lg font-semibold shrink-0"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={mealFormData.portions}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setMealFormData((prev) => ({ ...prev, portions: '' }));
                        return;
                      }
                      const n = parseInt(raw, 10);
                      setMealFormData((prev) => ({
                        ...prev,
                        portions: Number.isFinite(n) && n >= 1 ? n : 1
                      }));
                    }}
                    onBlur={() =>
                      setMealFormData((prev) => ({
                        ...prev,
                        portions:
                          Math.max(1, Math.floor(Number(prev.portions))) ||
                          defaultMealPortionsForCategory(prev.category)
                      }))
                    }
                    className="flex-1 min-w-0 p-3 border border-gray-200 rounded-xl text-center bg-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setMealFormData((prev) => ({
                        ...prev,
                        portions: (Number(prev.portions) || 1) + 1
                      }))
                    }
                    className="bg-white border border-gray-200 text-gray-700 w-10 h-10 rounded-lg font-semibold shrink-0"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Сколько порций в этой кастрюле / форме. После смены категории ниже подставляется норма — при необходимости поправьте число.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                <select
                  value={mealFormData.category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setMealFormData((prev) => ({
                      ...prev,
                      category: cat,
                      portions: defaultMealPortionsForCategory(cat)
                    }));
                  }}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                >
                  {MEAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата приготовления</label>
                <input
                  type="date"
                  value={mealFormData.preparedDate}
                  onChange={(e) => setMealFormData(prev => ({ ...prev, preparedDate: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>

              <button
                type="button"
                onClick={handleAddPreparedMeal}
                className="w-full bg-orange-500 text-white p-3 rounded-xl font-semibold"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Library (Global) */}
      {showRecipeLibrary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4" onClick={closeRecipeLibrary}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-gray-700" />
                <h2 className="text-lg font-bold">Книга рецептов</h2>
              </div>
              <button onClick={closeRecipeLibrary} className="text-gray-500">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <input
                  type="text"
                  value={recipeLibraryQuery}
                  onChange={(e) => setRecipeLibraryQuery(e.target.value)}
                  placeholder="Поиск по названию и тегам…"
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Ищем по названию и тегам во всей базе Supabase
                </div>
              </div>

              {recipeLibraryLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-gray-100 rounded-xl p-4 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                  ))}
                </div>
              ) : (() => {
                const q = normalizeSearch(recipeLibraryQuery);
                const filtered = recipeLibrary.filter((r) => {
                  if (!q) return true;
                  const name = normalizeSearch(r?.name || '');
                  const tags = Array.isArray(r?.tags) ? normalizeSearch(r.tags.join(' ')) : normalizeSearch(r?.tags || '');
                  return name.includes(q) || tags.includes(q);
                });

                if (filtered.length === 0) {
                  return <div className="text-center text-gray-500 py-8">Ничего не найдено</div>;
                }

                return (
                  <div className="space-y-3">
                    {filtered.map((r) => {
                      const isFav = libraryFavoriteIds.has(r.id);
                      return (
                        <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            {/* Картинка */}
                            <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                              {r.image ? (
                                <img
                                  src={r.image}
                                  alt={r.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🍽️</div>
                              )}
                            </div>

                            {/* Название и теги */}
                            <button
                              className="flex-1 text-left min-w-0"
                              onClick={() => {
                                const normalized = {
                                  id: r.id,
                                  name: r.name,
                                  description: r.description || '',
                                  time: r.time || 0,
                                  difficulty: r.difficulty || '',
                                  image: r.image || '',
                                  ingredients: Array.isArray(r.ingredients) ? r.ingredients : (r.ingredients?.ingredients || []),
                                  steps: Array.isArray(r.steps) ? r.steps : (r.steps?.steps || [])
                                };
                                closeRecipeLibrary();
                                setSelectedRecipe(normalized);
                                setShowRecipeModal(true);
                              }}
                            >
                              <div className="font-semibold text-gray-900 truncate">{r.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {r.difficulty && `${r.difficulty}`}{r.time ? ` • ${r.time} мин` : ''}
                              </div>
                              {Array.isArray(r.tags) && r.tags.length > 0 && (
                                <div className="text-xs text-gray-400 mt-0.5 truncate">
                                  {r.tags.slice(0, 4).join(' • ')}
                                </div>
                              )}
                            </button>

                            {/* Сердечко */}
                            <button
                              type="button"
                              onClick={() => toggleLibraryFavorite(r)}
                              className={`p-2 rounded-xl transition-colors flex-shrink-0 ${isFav ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:bg-gray-50 hover:text-red-500'}`}
                              title={isFav ? 'Убрать из избранного' : 'В избранное'}
                            >
                              <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                >
                  <option value="">Выберите категорию</option>
                  {PRODUCT_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
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
                onClick={async () => {
                  if (currentTab === 'pantry') {
                    const expRaw = editFormData.expiryDate ? new Date(editFormData.expiryDate) : null;
                    const exp = expRaw && !Number.isNaN(expRaw.getTime()) ? expRaw : null;
                    if (usesCloudInventory && editingItem?.id) {
                      const { data, error } = await updateInventoryRow(editingItem.id, {
                        name: editFormData.name,
                        quantity: Number(editFormData.quantity) || editingItem.quantity,
                        measure: editFormData.measure || editingItem.measure,
                        category: editFormData.category || editingItem.category || '🏷️ Прочее',
                        expiryDate: exp,
                        autoFilled: false
                      });
                      if (error || !data) {
                        showNotification('Не удалось сохранить');
                        return;
                      }
                      const mapped = mapInventoryRowToPantryItem(data);
                      setPantryItems((prev) => prev.map((item) => (item.id === editingItem.id ? mapped : item)));
                    } else {
                      setPantryItems((prev) => prev.map((item) =>
                        item.id === editingItem.id
                          ? {
                              ...item,
                              name: editFormData.name,
                              quantity: Number(editFormData.quantity) || item.quantity,
                              measure: editFormData.measure || item.measure,
                              category: editFormData.category || item.category || '🏷️ Прочее',
                              expiryDate: exp ?? item.expiryDate,
                              autoFilled: false
                            }
                          : item
                      ));
                    }
                  } else if (currentTab === 'shopping') {
                    setShoppingItems(prev => prev.map(item => 
                      item.id === editingItem.id 
                        ? {
                            ...item,
                            name: editFormData.name,
                            quantity: Number(editFormData.quantity) || item.quantity,
                            measure: editFormData.measure || item.measure,
                            category: editFormData.category || item.category || '🏷️ Прочее'
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[80]" onClick={() => setShowRecipeModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex-1 mr-2">{selectedRecipe.name}</h2>
              <div className="flex items-center gap-1">
                {/* Поделиться */}
                <button
                  type="button"
                  title="Поделиться рецептом"
                  className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                  onClick={() => {
                    const isSupabaseRecipe = typeof selectedRecipe.id === 'string';
                    const link = isSupabaseRecipe
                      ? `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=recipe_${selectedRecipe.id}`
                      : `https://t.me/${TELEGRAM_BOT_USERNAME}`;
                    const shortIngredients = (selectedRecipe.ingredients || [])
                      .slice(0, 8)
                      .map((ing) => `${ing.name} ${ing.amount}${ing.measure}`)
                      .join(', ');
                    const text = isSupabaseRecipe
                      ? `Посмотри мой рецепт: ${selectedRecipe.name}`
                      : `Рецепт: ${selectedRecipe.name}${shortIngredients ? `\nИнгредиенты: ${shortIngredients}` : ''}`;

                    if (isSupabaseRecipe && tg?.switchInlineQuery) {
                      try {
                        tg.switchInlineQuery(`recipe_${selectedRecipe.id}`, ['users', 'groups', 'channels']);
                        return;
                      } catch (_) { /* fallback */ }
                    }
                    if (tg?.openTelegramLink) {
                      tg.openTelegramLink(
                        `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
                      );
                    } else {
                      navigator.clipboard?.writeText(`${text}\n${link}`)
                        .then(() => showNotification('Рецепт скопирован для отправки'))
                        .catch(() => showNotification(link));
                    }
                  }}
                >
                  <Share2 size={20} />
                </button>

                {/* Избранное */}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof selectedRecipe.id === 'string') {
                      toggleLibraryFavorite(selectedRecipe);
                    } else {
                      toggleFavoriteRecipe(selectedRecipe);
                    }
                  }}
                  className={`p-2 rounded-xl transition-colors ${
                    (typeof selectedRecipe.id === 'string' && libraryFavoriteIds.has(selectedRecipe.id)) ||
                    favoriteRecipes.some((fav) => fav.id === selectedRecipe.id)
                      ? 'text-red-500 bg-red-50'
                      : 'text-gray-400 hover:bg-gray-50 hover:text-red-500'
                  }`}
                  title="В избранное"
                >
                  <Heart
                    size={20}
                    fill={
                      (typeof selectedRecipe.id === 'string' && libraryFavoriteIds.has(selectedRecipe.id)) ||
                      favoriteRecipes.some((fav) => fav.id === selectedRecipe.id)
                        ? 'currentColor'
                        : 'none'
                    }
                  />
                </button>

                <button onClick={() => setShowRecipeModal(false)} className="p-2 text-gray-500">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Кнопка "Добавить в мою книгу" (для рецептов открытых по шерингу) */}
            {typeof selectedRecipe.id === 'string' && !libraryFavoriteIds.has(selectedRecipe.id) && (
              <button
                onClick={() => toggleLibraryFavorite(selectedRecipe)}
                className="w-full mb-3 bg-green-500 text-white p-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <BookOpen size={18} />
                Добавить в мою книгу
              </button>
            )}

            {/* Картинка рецепта с фолбэком */}
            {selectedRecipe.image ? (
              <img
                src={selectedRecipe.image}
                alt={selectedRecipe.name}
                className="w-full h-48 rounded-xl object-cover mb-3"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-32 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-5xl mb-3">🍽️</div>
            )}
            
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
                  Добавить в корзину
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => { setShowAddRecipeModal(false); setEditingRecipeId(null); setRecipeFormData({ name: '', ingredients: [], difficulty: 'легкий', time: 30, steps: [''], comments: '', image: '' }); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

      {/* Edit Meal Modal */}
      {showEditMealModal && editingMeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowEditMealModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Редактировать блюдо</h2>
              <button onClick={() => setShowEditMealModal(false)} className="text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  type="text"
                  value={editMealFormData.name}
                  onChange={(e) => setEditMealFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                <select
                  value={editMealFormData.category}
                  onChange={(e) => setEditMealFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                >
                  {['Суп', 'Гарнир', 'Мясо', 'Рыба', 'Салат', 'Десерт', 'Другое'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Порций осталось</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditMealFormData(prev => ({ ...prev, portions: Math.max(1, prev.portions - 1) }))}
                    className="bg-gray-200 text-gray-700 w-10 h-10 rounded-lg font-semibold"
                  >-</button>
                  <input
                    type="number"
                    min="1"
                    value={editMealFormData.portions}
                    onChange={(e) => setEditMealFormData(prev => ({ ...prev, portions: Number(e.target.value) || 1 }))}
                    className="flex-1 p-3 border border-gray-200 rounded-xl text-center"
                  />
                  <button
                    onClick={() => setEditMealFormData(prev => ({ ...prev, portions: prev.portions + 1 }))}
                    className="bg-gray-200 text-gray-700 w-10 h-10 rounded-lg font-semibold"
                  >+</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата приготовления</label>
                <input
                  type="date"
                  value={editMealFormData.preparedDate}
                  onChange={(e) => setEditMealFormData(prev => ({ ...prev, preparedDate: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Хранится до</label>
                <input
                  type="date"
                  value={editMealFormData.expiresAt}
                  onChange={(e) => setEditMealFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>
              <button
                onClick={() => {
                  setPreparedMeals(prev => prev.map(m =>
                    m.id === editingMeal.id
                      ? {
                          ...m,
                          name: editMealFormData.name || m.name,
                          category: editMealFormData.category,
                          portions: Number(editMealFormData.portions) || m.portions,
                          preparedDate: editMealFormData.preparedDate ? new Date(editMealFormData.preparedDate) : m.preparedDate,
                          expiresAt: editMealFormData.expiresAt ? new Date(editMealFormData.expiresAt) : m.expiresAt
                        }
                      : m
                  ));
                  setShowEditMealModal(false);
                  setEditingMeal(null);
                  showNotification('Блюдо обновлено');
                }}
                className="w-full bg-blue-500 text-white p-3 rounded-xl font-semibold"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Edit Modal */}
      {showDateModal && editingDateProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => { setShowDateModal(false); setEditingDateProduct(null); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={cancelDeleteRecipe}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
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

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <BarcodeScannerModal
          onDetected={handleBarcodeDetected}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Modal Notification */}
      {notification && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-[70]">
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
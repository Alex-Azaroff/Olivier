import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Home, Book, ShoppingCart, User, Plus, Edit3, Trash2, Calendar, Check, X, FileText } from 'lucide-react';
import { supabase } from './src/supabaseClient';
import { RECIPES_DB } from './src/data/recipes';

// Sample product database (1000 products simulated with 50 for demo)
const PRODUCTS_DB = [
  { name: 'Молоко', category: '🥛 Молочные', measure: 'л.', shelfLife: 7 },
  { name: 'Масло сливочное', category: '🥛 Молочные', measure: 'г.', shelfLife: 30 },
  { name: 'Йогурт', category: '🥛 Молочные', measure: 'шт.', shelfLife: 14 },
  { name: 'Творог', category: '🥛 Молочные', measure: 'г.', shelfLife: 10 },
  { name: 'Сыр', category: '🥛 Молочные', measure: 'г.', shelfLife: 21 },
  { name: 'Хлеб', category: '🍞 Хлебобулочные', measure: 'шт.', shelfLife: 3 },
  { name: 'Батон', category: '🍞 Хлебобулочные', measure: 'шт.', shelfLife: 2 },
  { name: 'Помидоры', category: '🥦 Овощи', measure: 'кг.', shelfLife: 7 },
  { name: 'Огурцы', category: '🥦 Овощи', measure: 'кг.', shelfLife: 5 },
  { name: 'Лук', category: '🥦 Овощи', measure: 'кг.', shelfLife: 30 },
  { name: 'Морковь', category: '🥦 Овощи', measure: 'кг.', shelfLife: 14 },
  { name: 'Картофель', category: '🥦 Овощи', measure: 'кг.', shelfLife: 60 },
  { name: 'Яблоки', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 14 },
  { name: 'Бананы', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 5 },
  { name: 'Апельсины', category: '🍎 Фрукты', measure: 'кг.', shelfLife: 10 },
  { name: 'Рис', category: '🌾 Крупы', measure: 'кг.', shelfLife: 365 },
  { name: 'Гречка', category: '🌾 Крупы', measure: 'г.', shelfLife: 365 },
  { name: 'Макароны', category: '🌾 Крупы', measure: 'г.', shelfLife: 730 },
  { name: 'Мука', category: '🌾 Крупы', measure: 'г.', shelfLife: 180 },
  { name: 'Сахар', category: '🌾 Крупы', measure: 'г.', shelfLife: 1095 },
  { name: 'Куриная грудка', category: '🥩 Мясо', measure: 'кг.', shelfLife: 3 },
  { name: 'Говядина', category: '🥩 Мясо', measure: 'кг.', shelfLife: 3 },
  { name: 'Свинина', category: '🥩 Мясо', measure: 'кг.', shelfLife: 3 },
  { name: 'Яйца', category: '🥚 Яйца', measure: 'шт.', shelfLife: 21 },
  { name: 'Рыба', category: '🐟 Рыба', measure: 'кг.', shelfLife: 2 }
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
  
  const handleChange = (e) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    
    if (inputValue.length > 0) {
      const filtered = products
        .filter(product => product.name.toLowerCase().includes(inputValue.toLowerCase()))
        .slice(0, 4);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
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
    steps: [''],
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

  const addCustomRecipe = () => {
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
      const newRecipe = {
        id: Date.now(),
        ...recipeFormData,
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
      steps: [''],
      comments: '',
      image: ''
    });
    setShowAddRecipeModal(false);
  };

  const editCustomRecipe = (recipe) => {
    setRecipeFormData({
      ...recipe,
      ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : [{ name: '', amount: 1, measure: 'г.' }],
      steps: recipe.steps.length > 0 ? recipe.steps : ['']
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
    let added = 0;
    recipe.ingredients.forEach(ingredient => {
      const status = getIngredientStatus(ingredient);
      if (status.status === 'missing') {
        const product = PRODUCTS_DB.find(p => p.name === ingredient.name);
        if (product) {
          addToShopping(product, ingredient.amount);
          added++;
        }
      } else if (status.status === 'partial') {
        const needed = ingredient.amount - status.available;
        const product = PRODUCTS_DB.find(p => p.name === ingredient.name);
        if (product) {
          addToShopping(product, needed);
          added++;
        }
      }
    });
    if (added > 0) {
      showNotification(`Добавлено ${added} ингредиентов в корзину`);
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
                  Добавить в покупки все недостающие ингредиенты
                </button>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Приготовление</h3>
                {selectedRecipe.steps.map((step, index) => (
                  <div key={index} className="mb-2">
                    <span className="font-semibold">{index + 1}. </span>
                    {step}
                  </div>
                ))}
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
                    <div key={index} className="flex gap-2">
                      <span className="text-sm text-gray-500 mt-3">{index + 1}.</span>
                      <textarea
                        value={step}
                        onChange={(e) => {
                          const newSteps = [...recipeFormData.steps];
                          newSteps[index] = e.target.value;
                          setRecipeFormData(prev => ({ ...prev, steps: newSteps }));
                        }}
                        className="flex-1 p-2 border border-gray-200 rounded-lg resize-none"
                        rows="2"
                        placeholder="Описание этапа"
                      />
                      <button
                        onClick={() => {
                          const newSteps = recipeFormData.steps.filter((_, i) => i !== index);
                          setRecipeFormData(prev => ({ ...prev, steps: newSteps.length ? newSteps : [''] }));
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
Vercel deployment notes

Project: Olivier

## Стабильные версии

| Версия | Git тег | Описание |
|--------|---------|----------|
| **Текущая stable** | **`v3.5-stable`**, `v-stable` | Кладовая в Supabase (`inventory`), имя холодильника, realtime, без демо-продуктов из PRODUCTS_DB |
| Архив | `v3.4-stable`, `v3-stable`, … | Предыдущие отметки |

Чтобы получить код текущей стабильной версии:
```
git fetch origin && git checkout v3.5-stable
```
(или `git checkout v-stable` — тот же коммит.)

Перед деплоем примените SQL-миграцию `supabase/migrations/20260328120000_inventory_and_fridge_name.sql` и при необходимости включите Realtime для таблицы `inventory` в Supabase.

---

Deployed URLs:
- Production alias: https://olivier-orcin.vercel.app

Notes:
- Git автодеплой **отключён** (vercel git disconnect). Деплой только вручную: `vercel --prod --yes`
- The project is linked to a Vercel project named `olivier` under the account/org `alex-azaroffs-projects`.
- Environment variables for development are in `.env.local` (gitignored).

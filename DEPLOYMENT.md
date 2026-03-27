Vercel deployment notes

Project: Olivier

## Стабильные версии

| Версия | Git тег | Vercel деплой | Описание |
|--------|---------|---------------|----------|
| **v3 (stable)** | `v3-stable` | https://olivier-34m079s6g-alex-azaroffs-projects.vercel.app | ✅ Текущая рабочая версия |

Чтобы вернуть v3 в продакшн:
```
vercel promote olivier-34m079s6g-alex-azaroffs-projects.vercel.app --yes
```

Чтобы получить код v3:
```
git checkout v3-stable
```

---

Deployed URLs:
- Production alias: https://olivier-orcin.vercel.app

Notes:
- Git автодеплой **отключён** (vercel git disconnect). Деплой только вручную: `vercel --prod --yes`
- The project is linked to a Vercel project named `olivier` under the account/org `alex-azaroffs-projects`.
- Environment variables for development are in `.env.local` (gitignored).

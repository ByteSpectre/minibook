# Тестовый деплой: Vercel + Supabase

Пошаговый гайд: **Postgres на Supabase**, **API и Mini App на Vercel** (два отдельных проекта из одного репо).

Боевой VPS: [vps-setup.md](./vps-setup.md). Локально: [local-telegram-bot.md](./local-telegram-bot.md).

---

## Архитектура

```
Telegram Mini App
        │
        ▼
┌────────────────────────────┐
│  Vercel project: web       │  apps/web (Vite SPA)
│  https://glow-web.vercel.app
└────────────┬───────────────┘
             │  VITE_API_URL
             ▼
┌────────────────────────────┐
│  Vercel project: api       │  apps/api (Express → serverless)
│  https://glow-api.vercel.app
└────────────┬───────────────┘
             │  DATABASE_URL (Transaction pooler)
             ▼
┌────────────────────────────┐
│  Supabase Postgres         │
└────────────────────────────┘
```

### Ограничения на Vercel (важно)

| Фича               | Поведение                                                                           |
| ------------------ | ----------------------------------------------------------------------------------- |
| Bot                | Только **webhook** (`BOT_MODE` принудительно `webhook` при `VERCEL=1`)              |
| Cron / напоминания | **Выключены** in-process. Для тестов UX без автонапоминаний ок; позже — Vercel Cron |
| Uploads `local`    | Эфемерны (пропадут). Для фото лучше `STORAGE_DRIVER=r2`                             |
| Cold start         | Первый запрос после простоя медленнее                                               |

---

## 1. Supabase

1. [Dashboard](https://supabase.com/dashboard) → **New project** (лучше EU, напр. Frankfurt).
2. **Connect** → connection strings:

| Назначение        | Режим                                 | Пример                                                                                        |
| ----------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Runtime на Vercel | **Transaction** pooler, порт **6543** | `postgresql://postgres.[REF]:[PASS]@aws-0-….pooler.supabase.com:6543/postgres?pgbouncer=true` |
| Миграции локально | **Direct**, порт **5432**             | `postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres`                             |

3. Локально один раз:

```powershell
$env:DATABASE_URL="postgresql://postgres:PASS@db.REF.supabase.co:5432/postgres"
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

---

## 2. Vercel — API (`apps/api`)

На экране «Multiple applications detected»:

→ у **api** (Express) нажмите **Import single project**  
→ **не** выбирайте Services / web на этом шаге.

### Settings

| Поле           | Значение                            |
| -------------- | ----------------------------------- |
| Root Directory | `apps/api`                          |
| Framework      | Other (или Express, если предложит) |

В репо уже есть `apps/api/vercel.json` (install из корня монорепо + `prisma generate`).

### Environment Variables (API)

```dotenv
NODE_ENV=production
TRUST_PROXY=1
LOG_LEVEL=info

# После первого деплоя подставьте реальный URL API и Redeploy
PUBLIC_API_URL=https://ВАШ-api.vercel.app
WEB_APP_URL=https://ВАШ-web.vercel.app
CORS_ORIGINS=https://ВАШ-web.vercel.app

DATABASE_URL=postgresql://postgres.REF:PASS@….pooler.supabase.com:6543/postgres?pgbouncer=true

BOT_TOKEN=...
BOT_USERNAME=...
BOT_MODE=webhook
BOT_WEBHOOK_SECRET=<openssl rand -hex 24>
PLATFORM_OWNER_TELEGRAM_ID=...
PLATFORM_TIMEZONE=Europe/Moscow

JWT_SECRET=<длинный секрет, ≥16 символов>
JWT_TTL=7d
DEV_AUTH_ENABLED=false

CRON_ENABLED=false
STORAGE_DRIVER=local
UPLOAD_DIR=/tmp/uploads

YANDEX_MAPS_API_KEY=
YANDEX_SUGGEST_API_KEY=
```

> `PUBLIC_API_URL` сначала можно поставить placeholder, задеплоить, скопировать `*.vercel.app`, обновить переменную и **Redeploy**.

### Проверка

```powershell
curl.exe -fsS https://ВАШ-api.vercel.app/api/health
```

Ожидается JSON с `"ok": true`.

---

## 3. Vercel — Web (`apps/web`)

Снова **Add New Project** → тот же репозиторий → у **web** (Vite) → **Import single project**.

| Поле             | Значение                                                                          |
| ---------------- | --------------------------------------------------------------------------------- |
| Root Directory   | `apps/web`                                                                        |
| Framework        | Vite                                                                              |
| Build Command    | `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @nail-crm/web build` |
| Output Directory | `dist`                                                                            |
| Install Command  | `cd ../.. && pnpm install --frozen-lockfile`                                      |

### Environment Variables (Web, Build)

```dotenv
VITE_API_URL=https://ВАШ-api.vercel.app
VITE_BOT_USERNAME=ваш_бот
VITE_DEV_AUTH=false
VITE_DEFAULT_LANGUAGE=ru
VITE_YANDEX_MAPS_API_KEY=
VITE_YANDEX_SUGGEST_API_KEY=
```

После деплоя web:

1. В **API** проекте обновите `WEB_APP_URL` и `CORS_ORIGINS` = URL web → Redeploy API
2. В **API** `PUBLIC_API_URL` = URL api (если ещё не) → Redeploy

---

## 4. BotFather

1. Mini App URL = **web** `https://….vercel.app`
2. Webhook выставит сам API на `https://….vercel.app/api/bot/webhook` при старте
3. Остановите локальный `pnpm dev` с тем же `BOT_TOKEN`
4. Напишите боту `/start`

---

## 5. Чек-лист

- [ ] Supabase: migrate + seed
- [ ] Vercel API: `/api/health` ok
- [ ] Vercel Web открывается
- [ ] `VITE_API_URL` = API URL, CORS = Web URL
- [ ] BotFather → web URL
- [ ] Нет второго процесса с тем же ботом

---

## 6. Если билд API падает

| Лог                                   | Что сделать                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `Invalid environment` / `JWT_SECRET`  | Не заданы env в Vercel → Variables                                                      |
| Prisma / `DATABASE_URL`               | Transaction pooler `:6543?pgbouncer=true`, пароль URL-encoded                           |
| `Cannot find module @nail-crm/shared` | Root = `apps/api`, `installCommand` должен идти в корень монорепо (как в `vercel.json`) |
| Bundle / sharp слишком большой        | Пока ок на Hobby; при лимите — Large Functions или убрать sharp с cold path             |
| 504 на холодном старте                | Повторить запрос; `maxDuration` уже 60s в `vercel.json`                                 |

---

## 7. Railway / Render (опционально)

Если нужен **always-on** API с рабочим `node-cron`, можно держать API на Railway/Render, а на Vercel только web. См. историю файла / git. Для большинства тестов достаточно двух проектов на Vercel.

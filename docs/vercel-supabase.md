# Тестовый деплой: Vercel + Supabase

Пошаговый гайд, как поднять Glow для тестов на **Supabase (Postgres)** и **Vercel (Mini App)**.

> **Важно:** этот репозиторий **не готов** к «весь стек на Vercel» из коробки. API — долгоживущий Express-процесс с `node-cron`, grammY (polling/webhook) и локальными `uploads`. На serverless Vercel это ломается без доработок.
>
> Для тестов рабочая схема:
>
> | Часть                 | Куда                                                        |
> | --------------------- | ----------------------------------------------------------- |
> | PostgreSQL            | **Supabase**                                                |
> | Mini App (`apps/web`) | **Vercel**                                                  |
> | API (`apps/api`)      | **Railway / Render / Fly.io** (или VPS) — один Node-процесс |
>
> Ниже — полный путь. В конце — что нужно, если всё же хотите API тоже на Vercel.

Боевой VPS-вариант: [vps-setup.md](./vps-setup.md). Локальная разработка: [local-telegram-bot.md](./local-telegram-bot.md).

---

## 0. Что понадобится

- Аккаунт [Supabase](https://supabase.com/)
- Аккаунт [Vercel](https://vercel.com/)
- Аккаунт [Railway](https://railway.app/) / [Render](https://render.com/) / [Fly.io](https://fly.io/) (для API)
- Репозиторий на GitHub (Vercel/Railway удобнее тянуть из git)
- Telegram-бот (токен + username)
- Домены не обязательны: хватит `*.vercel.app` и `*.up.railway.app` / `*.onrender.com`

Минимальный «тестовый» режим можно без ЮKassa и без Яндекс Карт (будет mock-оплата и схематичная карта).

---

## 1. Архитектура тестового стенда

```
Telegram Mini App
        │
        ▼
┌───────────────────────┐
│  Vercel (static SPA)  │  apps/web/dist
│  https://glow-xxx.vercel.app
└───────────┬───────────┘
            │  VITE_API_URL → API
            ▼
┌───────────────────────┐
│  Railway / Render     │  apps/api (Express + bot + cron)
│  https://glow-api.xxx │
└───────────┬───────────┘
            │  DATABASE_URL
            ▼
┌───────────────────────┐
│  Supabase Postgres    │
└───────────────────────┘
```

Один публичный URL Mini App (Vercel) + один публичный URL API (Railway). BotFather указывает на Vercel. CORS и `WEB_APP_URL` / `PUBLIC_API_URL` должны совпадать с этими URL.

---

## 2. Supabase — база данных

### 2.1. Создать проект

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Регион ближе к себе / к хосту API (например `Frankfurt` / `eu-central-1`)
3. Задайте сильный DB password → сохраните

### 2.2. Взять connection strings

**Project Settings → Database → Connection string** (или кнопка **Connect**).

Нужны **два** варианта:

| Назначение                       | Режим              | Порт                       | Куда                        |
| -------------------------------- | ------------------ | -------------------------- | --------------------------- |
| Runtime API (Prisma + `pg`)      | **Session** pooler | `5432` (через pooler host) | `DATABASE_URL` на API-хосте |
| Миграции `prisma migrate deploy` | **Direct**         | `5432`                     | локально / CI при миграциях |

Для **долгоживущего** Node (Railway/Render) берите **Session mode** pooler (IPv4-friendly):

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

Для **serverless Vercel** (если позже перенесёте API) — **Transaction** mode, порт `6543` + `?pgbouncer=true`. Сейчас для Express на Railway это не нужно.

Direct (миграции):

```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

> Пароль в URL должен быть **URL-encoded** (`@` → `%40`, `#` → `%23` и т.д.).

### 2.3. Auth / RLS / Storage Supabase

Glow **не использует** Supabase Auth и клиентский Data API. Доступ к данным только через ваш Express + Prisma.

- Таблицы создаёт Prisma migrate — не рисуйте схему руками в Table Editor.
- RLS на `public` для anon можно не трогать, если Data API не открываете наружу; для спокойствия можно оставить RLS включённым по умолчанию — Prisma ходит под ролью `postgres` / connection user и RLS её не режет так же, как anon.
- **Supabase Storage** сейчас не подключён: в коде `STORAGE_DRIVER=local|r2`. Для тестов оставьте `local` на Railway (эфемерно) или сразу R2.

### 2.4. Применить миграции и seed

Локально (из корня репо), один раз:

```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres"

# лучше для migrate — direct:
$env:DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

Проверка в Supabase → **Table Editor**: должны появиться `User`, `Category`, `Country`, `City`, …

---

## 3. API на Railway (рекомендуется для тестов)

Express + cron + bot остаются как есть. Альтернативы: Render Web Service, Fly.io Machines, маленький VPS.

### 3.1. Новый сервис из GitHub

1. Railway → **New Project** → **Deploy from GitHub repo**
2. Root Directory: **корень монорепо** (или настройте build из корня)
3. Добавьте сервис с такими командами:

**Build:**

```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter @nail-crm/api build
```

**Start:**

```bash
pnpm --filter @nail-crm/api start
```

Или через Nixpacks / Dockerfile позже. Node **≥ 22** (см. `engines` в корневом `package.json`).

Generate public domain: `https://glow-api-production.up.railway.app` (пример).

### 3.2. Переменные окружения API

Скопируйте из `apps/api/.env.example` и выставьте минимум:

```dotenv
NODE_ENV=production
PORT=4420
TRUST_PROXY=1
LOG_LEVEL=info

# Публичный URL ЭТОГО API (Railway)
PUBLIC_API_URL=https://glow-api-production.up.railway.app

# URL Mini App на Vercel (после деплоя web — обновите!)
WEB_APP_URL=https://glow-web.vercel.app
CORS_ORIGINS=https://glow-web.vercel.app

DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres

BOT_TOKEN=...
BOT_USERNAME=your_bot
BOT_MODE=webhook
BOT_WEBHOOK_SECRET=<openssl rand -hex 24>
PLATFORM_OWNER_TELEGRAM_ID=...
PLATFORM_TIMEZONE=Europe/Moscow

JWT_SECRET=<openssl rand -hex 32>
JWT_TTL=7d
DEV_AUTH_ENABLED=true
# ↑ для тестов вне Telegram удобно true; перед «боевыми» тестами с реальными юзерами — false

CRON_ENABLED=true
RATE_LIMIT_ENABLED=true

STORAGE_DRIVER=local
UPLOAD_DIR=./uploads

# ЮKassa / Яндекс — по желанию
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
YOOKASSA_WEBHOOK_SECRET=change-me
YOOKASSA_SKIP_IP_CHECK=true
YANDEX_MAPS_API_KEY=
YANDEX_SUGGEST_API_KEY=
```

> **`BOT_MODE=webhook`** — обязательно на любом облачном хосте. Polling на нескольких репликах и при рестартах конфликтует.

### 3.3. Проверка API

```bash
curl.exe -fsS https://glow-api-production.up.railway.app/api/health
```

Ожидается JSON с `"ok": true`. В логах Railway после старта: `Telegram webhook registered`.

---

## 4. Mini App на Vercel

### 4.1. Импорт проекта

1. Vercel → **Add New… → Project** → ваш GitHub-репозиторий
2. Настройки:

| Setting          | Value                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Framework Preset | Vite                                                                                                                      |
| Root Directory   | `apps/web`                                                                                                                |
| Build Command    | `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @nail-crm/shared build && pnpm --filter @nail-crm/web build` |
| Output Directory | `dist`                                                                                                                    |
| Install Command  | `cd ../.. && pnpm install --frozen-lockfile`                                                                              |
| Node.js Version  | `22.x`                                                                                                                    |

Если Vercel ругается на workspace из `apps/web`, проще завести проект с **Root Directory = `.` (корень)** и указать:

| Setting          | Value                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Framework        | Other                                                                                                         |
| Build Command    | `pnpm install --frozen-lockfile && pnpm --filter @nail-crm/shared build && pnpm --filter @nail-crm/web build` |
| Output Directory | `apps/web/dist`                                                                                               |
| Install Command  | `pnpm install --frozen-lockfile`                                                                              |

### 4.2. `vercel.json` для SPA

В корне репо или в `apps/web/` (в зависимости от Root Directory) нужен rewrite на `index.html`:

```json
{
  "rewrites": [{ "source":="/((?!api/).*)", "destination": "/index.html" }]
}
```

Если Root = `apps/web`, достаточно:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

> API на Vercel в этой схеме **не** хостится — фронт ходит на Railway по абсолютному `VITE_API_URL`.

### 4.3. Env для web (Build-time!)

`VITE_*` вшиваются **на этапе сборки**. После смены — Redeploy.

```dotenv
VITE_API_URL=https://glow-api-production.up.railway.app
VITE_BOT_USERNAME=your_bot
VITE_MINI_APP_SHORT_NAME=
VITE_YANDEX_MAPS_API_KEY=
VITE_YANDEX_SUGGEST_API_KEY=
VITE_DEFAULT_LANGUAGE=ru
VITE_DEV_AUTH=true
```

`VITE_API_URL` — без завершающего `/`. Фронт будет звать `${VITE_API_URL}/api/...`.

### 4.4. Deploy

Push в git или `vercel --prod`. Получите URL вида `https://glow-xxx.vercel.app`.

### 4.5. Синхронизировать URL с API

В Railway обновите:

```dotenv
WEB_APP_URL=https://glow-xxx.vercel.app
CORS_ORIGINS=https://glow-xxx.vercel.app
```

Рестарт API. Без этого CORS и кнопки `web_app` в боте сломаются.

---

## 5. Telegram BotFather

1. `/mybots` → бот → **Bot Settings → Configure Mini App → Enable**
2. URL: `https://glow-xxx.vercel.app` (именно Vercel, не API)
3. При `BOT_MODE=webhook` API сам делает `setWebhook` на  
   `https://glow-api..../api/bot/webhook`
4. Напишите боту `/start`

Проверка Mini App: кнопка меню / web_app должна открыть Vercel-URL внутри Telegram.

---

## 6. Яндекс Карты на тестовом стенде

В кабинете Яндекса у ключа **HTTP Referer**:

```
localhost
vercel.app
trycloudflare.com
```

(для `*.vercel.app` достаточно родительского `vercel.app`). Подождите ~15 минут, пересоберите web на Vercel.

Подробности и проверка ключа: [local-telegram-bot.md](./local-telegram-bot.md) § «Яндекс Карты».

---

## 7. Фото / uploads

На Railway с `STORAGE_DRIVER=local` файлы живут на диске инстанса и **пропадают при редеплое**. Для нормальных тестов загрузок:

```dotenv
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=...
R2_PUBLIC_URL=https://cdn.example.com
```

(Cloudflare R2, S3-совместимый.)

---

## 8. Чек-лист «стенд жив»

- [ ] Supabase: таблицы после `db:deploy` + `db:seed`
- [ ] `GET {API}/api/health` → ok
- [ ] `GET {WEB}/` открывает Glow
- [ ] В Network фронта запросы идут на Railway (`VITE_API_URL`), не 404 на Vercel
- [ ] CORS: в API указан точный origin Vercel
- [ ] BotFather Mini App = Vercel URL
- [ ] `/start` в боте отвечает
- [ ] Webhook: нет второго процесса с тем же `BOT_TOKEN` (локальный `pnpm dev` остановить)
- [ ] Для тестов вне Telegram: `DEV_AUTH_ENABLED=true` + `VITE_DEV_AUTH=true`

---

## 9. Обновление кода

```text
git push → Vercel пересобирает web
       → Railway пересобирает api
```

Миграции после изменений схемы:

```bash
$env:DATABASE_URL="postgresql://...direct..."
pnpm db:deploy
# при необходимости pnpm db:seed
```

---

## 10. Почему не «весь Glow на Vercel»

| Компонент                                    | На Vercel serverless                                      |
| -------------------------------------------- | --------------------------------------------------------- |
| Vite SPA                                     | ✅ Отлично                                                |
| Express API                                  | ⚠️ Нужен serverless/container entry, без `listen()`       |
| `node-cron`                                  | ❌ Не работает в scale-to-zero → нужны Vercel Cron → HTTP |
| Bot `polling`                                | ❌ Нельзя → только `webhook`                              |
| `STORAGE_DRIVER=local`                       | ❌ Эфемерная FS → R2                                      |
| Prisma `pg` pool `max: 20`                   | ⚠️ На serverless слишком много → pooler + маленький pool  |
| Cold start + тяжёлый бандл (`sharp`, grammY) | ⚠️ Лимиты размера/времени                                 |

Пока эти пункты не закрыты кодом, **API на Vercel для тестов не рекомендуем**. Связка **Vercel (web) + Supabase (DB) + Railway (API)** — минимальные изменения и предсказуемое поведение.

---

## 11. Если всё же хотите API на Vercel (черновик доработок)

Потребуется отдельная задача в коде, примерно:

1. Экспорт Express-приложения без `app.listen` (entrypoint для `@vercel/node` / Fluid).
2. `BOT_MODE=webhook` only; регистрация webhook при деплое или скриптом.
3. `CRON_ENABLED=false` + `vercel.json` crons, дергающие защищённые `POST /api/dev/cron/:job` (сейчас dev-cron в production выключен — нужен отдельный secret route).
4. `STORAGE_DRIVER=r2`.
5. `DATABASE_URL` = Supabase **Transaction** pooler (`:6543?pgbouncer=true`), уменьшить pool в `prisma.ts`.
6. Два Vercel-проекта (web + api) и rewrite `/api` → api-проект, либо один monorepo с `api/` handler.
7. Учесть `maxDuration`, cold starts, лимит body 4.5 MB.

Это уже не «гайд по кликам», а полноценный рефакторинг деплоя.

---

## 12. Render — альтернатива Railway для API

1. **New → Web Service** → GitHub repo
2. Build: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter @nail-crm/api build`
3. Start: `pnpm --filter @nail-crm/api start`
4. Instance: Free/Starter (на Free сервис засыпает — webhook/cron будут с задержкой; для тестов бота лучше платный always-on или Railway).
5. Env — как в §3.2.

---

## 13. Частые проблемы

| Симптом                             | Причина                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| CORS error в Mini App               | `CORS_ORIGINS` / `WEB_APP_URL` ≠ точный Vercel origin                 |
| Фронт бьёт в `/api` на Vercel → 404 | Не задан `VITE_API_URL` или забыли Redeploy после смены               |
| Bot 409 Conflict                    | Локальный `pnpm dev` с тем же токеном                                 |
| Prisma `P1001` / timeout            | Неверный URL, IPv6-only direct с хоста без IPv6 → берите **pooler**   |
| `migrate` падает на pooler          | Используйте **direct** URL для `pnpm db:deploy`                       |
| Карта схематичная                   | Яндекс `Invalid api key` / Referer без `vercel.app`                   |
| Uploads пропали                     | `local` storage + редеплой Railway                                    |
| Preview URL Vercel каждый раз новый | Добавляйте preview origin в CORS или тестируйте только Production URL |

---

## 14. Краткая последовательность «с нуля»

1. Создать Supabase → взять Direct + Pooler URLs
2. `pnpm db:deploy && pnpm db:seed` на Direct URL
3. Задеплоить API на Railway с env из §3.2 (`BOT_MODE=webhook`)
4. Задеплоить `apps/web` на Vercel с `VITE_API_URL` = Railway
5. Прописать Vercel URL в `WEB_APP_URL` / `CORS_ORIGINS` API → рестарт
6. BotFather → Mini App = Vercel URL
7. `/start` + открыть Mini App

Готово: тестовый стенд на Supabase + Vercel (+ Railway для API).

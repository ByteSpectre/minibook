# Glow — запись к мастерам красоты в Telegram

Telegram Mini App: маркетплейс и SaaS-кабинет для мастеров (маникюр, брови, волосы, макияж, тату…) и салонов.

- **Клиент** проходит онбординг, ищет мастеров по категориям, стране, городу и на карте (фильтр «Свободен сейчас»), записывается за пару касаний, получает напоминания, оставляет отзывы, копит скидки.
- **Мастер** ведёт расписание, клиентскую базу, услуги, акции, лояльность, рассылки, чёрный список, аналитику, оформление страницы, делится QR. Подписка 449 ₽ / 30 дней, 14 дней бесплатно.
- **Салон** объединяет мастеров (приглашения по юзернейму или ссылке), видит общее расписание, клиентов и аналитику и оплачивает подписку за всех мастеров: 1249 ₽ / 30 дней.
- **Владелец платформы** видит MRR, воронку, платежи, управляет мастерами и салонами (бан, продление), справочниками, промокодами, A/B-тестами цены и пейвола.

## Стек

| Часть                     | Технологии                                                                                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web (`apps/web`)          | React 19, Vite 8, TypeScript strict, Tailwind v4, shadcn/ui, `@telegram-apps/sdk-react`, React Router 6, TanStack Query, Zustand, react-i18next, Framer Motion, recharts, react-day-picker, Yandex Maps v3 (`ymap3-components`), qrcode.react |
| API (`apps/api`)          | Node 22, Express 5, grammY, Prisma 7 + PostgreSQL, Zod 4, JWT, node-cron, multer + sharp, S3/R2                                                                                                                                               |
| Общее (`packages/shared`) | Zod-схемы, DTO, enum'ы, утилиты (телефоны, слоты, лояльность, подписка, start-параметры), словари i18n ru/en                                                                                                                                  |

```
apps/
  api/       Express API, бот, cron, тесты (vitest)
  web/       Mini App
packages/
  shared/    общий код фронта и бэка
prisma/      schema.prisma и миграции
deploy/      nginx, PM2, скрипты VPS, нагрузочный тест k6
```

## Быстрый старт (локально)

Нужны **Node.js 22+**, **pnpm 10** (`corepack enable`) и **PostgreSQL 14+**.

```bash
pnpm install

# База данных (пример для локального Postgres)
createuser -P beauty            # пароль: beauty
createdb -O beauty beauty
createdb -O beauty beauty_test  # для тестов

cp apps/api/.env.example apps/api/.env   # JWT_SECRET можно оставить для локальной разработки
cp apps/web/.env.example apps/web/.env

pnpm db:generate     # Prisma Client
pnpm db:deploy       # миграции
pnpm db:seed         # категории, страны, города и демо-данные

pnpm dev             # API на :4420 и Mini App на :5420
```

Откройте <http://localhost:5420>. Вне Telegram показывается страница «Вход для разработки» с демо-персонажами:

| Telegram ID   | Персонаж                                       | Что посмотреть                 |
| ------------- | ---------------------------------------------- | ------------------------------ |
| 100000        | Алексей — владелец платформы                   | `/admin`                       |
| 100001        | Анна — клиент                                  | поиск, запись, календарь       |
| 100002        | Мария — мастер `maria-nails`, подписка активна | весь кабинет мастера           |
| 100003        | Ольга — салон «Лаванда», пробный период        | кабинет салона                 |
| 100004–100006 | мастера салона                                 | общий кабинет салона           |
| 100007        | Виктор — тату, СПб, триал заканчивается        | баннер подписки                |
| 100008        | Алина — Алматы, цены в тенге                   | мультивалютность               |
| 100009        | Софья — подписка истекла                       | заглушка «страница недоступна» |
| 100011        | blocked_client — в чёрном списке у Марии       | заглушка блокировки            |

### Что работает без ключей (моки)

| Интеграция     | Без ключей                                                                   | Как включить                              |
| -------------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| Telegram-бот   | `BOT_TOKEN` пустой → сообщения пишутся в лог и в `GET /api/dev/outbox`       | `BOT_TOKEN`, `BOT_USERNAME`               |
| ЮKassa         | тестовая страница оплаты `/pay/mock/:id` внутри приложения                   | `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` |
| Яндекс Карты   | встроенная схематичная карта с кластерами, выбором точки и «Рядом со мной»   | `VITE_YANDEX_MAPS_API_KEY`                |
| Хранилище фото | локальная папка `apps/api/uploads`                                           | `STORAGE_DRIVER=r2` + `R2_*`              |
| Вход           | `/api/auth/dev-login` (только при `DEV_AUTH_ENABLED=true` и не в production) | в Telegram — `initData` с проверкой HMAC  |

## Запуск внутри Telegram

Пошаговая инструкция с туннелем, BotFather, проверкой уведомлений и разбором частых ошибок — [docs/local-telegram-bot.md](docs/local-telegram-bot.md). Кратко:

1. Создайте бота у [@BotFather](https://t.me/BotFather), впишите `BOT_TOKEN` и `BOT_USERNAME` в `apps/api/.env`, `VITE_BOT_USERNAME` в `apps/web/.env`.
2. Mini App должен открываться по **https**. Локально подойдёт туннель (`cloudflared tunnel --url http://localhost:5420` или ngrok). Укажите адрес в `WEB_APP_URL` и `CORS_ORIGINS`, а также в BotFather → _Bot Settings → Configure Mini App_ (или `/newapp` для именованного Mini App, тогда заполните `MINI_APP_SHORT_NAME`).
3. `PLATFORM_OWNER_TELEGRAM_ID` — ваш Telegram ID, он получает доступ к `/admin` и еженедельный дайджест.
4. `BOT_MODE=polling` для разработки, `webhook` для продакшена (вебхук регистрируется автоматически на `PUBLIC_API_URL/api/bot/webhook`).

Deep-link'и (`startapp`): `m_<slug>` — страница мастера, `s_<slug>` — салон, `m_<slug>_r_<clientId>` — «приведи подругу», `master_ref_<id>` — реферал мастера, `join_salon_<salonId>_<code>` — приглашение в салон, `appt_view_<id>` / `appt_reschedule_<id>` / `appt_review_<id>` — кнопки из уведомлений.

## ЮKassa

1. Впишите `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`, задайте длинный `YOOKASSA_WEBHOOK_SECRET`.
2. Получите адрес вебхука: `pnpm --filter @nail-crm/api webhook:url` и вставьте его в личном кабинете ЮKassa (_Интеграция → HTTP-уведомления_, события `payment.succeeded`, `payment.canceled`, `refund.succeeded`).
3. Вебхук принимается только с IP-адресов ЮKassa, с верным HMAC-токеном в URL, а сам платёж перед изменением статуса перезапрашивается через API ЮKassa.
4. Автоплатежи: карта сохраняется после первой оплаты (`save_payment_method`), cron списывает оплату за `AUTOPAY_DAYS_BEFORE` дней до окончания. Чеки 54-ФЗ — `YOOKASSA_ENABLE_RECEIPTS=true`.

Цены, триал и бонус за реферала по умолчанию берутся из `.env` и меняются владельцем в `/admin/settings`.

## Тесты и проверки

```bash
pnpm lint             # ESLint (flat config)
pnpm typecheck        # tsc во всех пакетах
pnpm test             # vitest: unit + интеграционные тесты на реальной БД beauty_test
pnpm check:isolation  # изоляция тенантов
```

Изоляция данных: `masterId`/`salonId` берутся только из JWT, сервисный слой фильтрует запросы, Prisma-расширение `forMaster`/`forSalon` дополнительно подмешивает фильтр по тенанту и запрещает переносить записи между тенантами, чужие ресурсы отвечают **404**. Для каждого эндпоинта `/api/master/*` и `/api/salon/*` есть тест, который пытается прочитать и изменить данные другого тенанта; отдельный тест сверяет реестр маршрутов со списком кейсов и падает в CI, если для нового эндпоинта нет теста изоляции.

CI (`.github/workflows/ci.yml`) поднимает PostgreSQL и прогоняет lint, typecheck, изоляцию, тесты и сборку.

## Деплой на VPS

Подробности — в `deploy/`:

- `deploy/setup-vps.sh` — первичная настройка Ubuntu: Node 22, pnpm, PM2, PostgreSQL, nginx, Let's Encrypt, ufw, генерация секретов в `.env`:
  ```bash
  sudo DOMAIN=app.example.com EMAIL=you@example.com REPO=<git url> bash deploy/setup-vps.sh
  ```
- `deploy/deploy.sh` — обновление: pull → install → миграции → сборка → `pm2 reload`.
- `deploy/nginx/glow.conf` — статика `apps/web/dist`, прокси `/api` и `/uploads` на API, кеширование ассетов, `frame-ancestors` для web.telegram.org.
- `deploy/ecosystem.config.cjs` — PM2. API запускается **одним** процессом: бот (long polling) и cron-задачи не должны дублироваться.
- `deploy/load/k6-public.js` — нагрузочный тест поиска, страницы мастера и расчёта слотов:
  ```bash
  k6 run -e BASE_URL=https://app.example.com -e TOKEN=<JWT> deploy/load/k6-public.js
  ```

Чек-лист продакшена: `NODE_ENV=production`, `DEV_AUTH_ENABLED=false`, `VITE_DEV_AUTH=false`, уникальные `JWT_SECRET` и `YOOKASSA_WEBHOOK_SECRET`, `TRUST_PROXY=1` за nginx, `WEB_APP_URL` и `PUBLIC_API_URL` на https, резервное копирование PostgreSQL (`pg_dump` по cron).

## Уведомления и cron

| Задача                                                                                                         | Когда                                  |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Напоминание клиенту за 24 ч и за 2 ч (кнопки «Подтвердить», «Перенести», «Отменить»)                           | каждые 5 минут                         |
| Вечерняя сводка мастеру — только число записей на завтра и кнопка, без списка                                  | в выбранное мастером время 18:00–22:00 |
| Утренняя сводка                                                                                                | 9:00 по времени мастера                |
| Напоминание мастеру о ближайшей записи                                                                         | за 30 минут                            |
| Открытка после визита с фото «после», затем просьба об отзыве                                                  | через час после завершения визита      |
| Свободные окна при отмене/переносе (не чаще 1/час и 3/день на клиента, не раньше чем за 2 ч, с учётом отписки) | сразу                                  |
| Дни рождения, напоминания о подписке, автоплатежи, истечение триала                                            | ежедневно                              |
| Еженедельный дайджест владельцу                                                                                | понедельник, 10:00                     |

Рассылки мастера: не чаще одной в день, клиенту — не больше одного сообщения в час.

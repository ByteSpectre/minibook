# Запуск бота и Mini App на локальной машине

Инструкция для macOS, Linux и Windows (WSL 2 или PowerShell). В итоге бот отвечает в Telegram, кнопка меню открывает Mini App с вашего компьютера, а уведомления (новая запись, напоминания, вечерняя сводка) приходят в чат.

Схема: Telegram → HTTPS-туннель → Vite (`:5420`) → прокси `/api` и `/uploads` → API (`:4420`) → PostgreSQL. Бот работает в режиме long polling, поэтому сам туннель ему не нужен; туннель нужен только Mini App, потому что Telegram открывает веб-приложения только по https.

## 1. Что установить

| Что         | Версия                    | Проверка                       |
| ----------- | ------------------------- | ------------------------------ |
| Node.js     | 22 или новее              | `node -v`                      |
| pnpm        | 10 (через corepack)       | `corepack enable && pnpm -v`   |
| PostgreSQL  | 14 или новее (или Docker) | `psql --version` / `docker -v` |
| Git         | любая                     | `git --version`                |
| cloudflared | любая                     | `cloudflared --version`        |

`cloudflared`: macOS — `brew install cloudflared`, Windows — `winget install Cloudflare.cloudflared`, Linux — пакет с [developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/). Аккаунт Cloudflare для быстрого туннеля не нужен.

## 2. Код и зависимости

```bash
git clone <url-репозитория> glow
cd glow
corepack enable
pnpm install
```

## 3. База данных

**Вариант А — Docker (проще всего):**

```bash
docker run -d --name glow-pg \
  -e POSTGRES_USER=beauty -e POSTGRES_PASSWORD=beauty -e POSTGRES_DB=beauty \
  -p 5432:5432 postgres:16
docker exec glow-pg createdb -U beauty beauty_test   # база для автотестов
```

**Вариант Б — установленный PostgreSQL:**

```bash
# macOS: brew install postgresql@16 && brew services start postgresql@16
# Ubuntu: sudo apt install postgresql && sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE ROLE beauty LOGIN PASSWORD 'beauty' CREATEDB;"   # на macOS без sudo -u postgres
createdb -h localhost -U beauty beauty
createdb -h localhost -U beauty beauty_test
```

Строка подключения по умолчанию: `postgresql://beauty:beauty@localhost:5432/beauty`. Если у вас другие логин, пароль или порт, поменяйте `DATABASE_URL` на шаге 4.

## 4. Файлы окружения

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Пока ничего не меняйте — сначала проверим, что всё работает без Telegram.

## 5. Миграции и демо-данные

```bash
pnpm db:generate   # генерирует Prisma Client
pnpm db:deploy     # применяет миграции
pnpm db:seed       # категории, страны, города, демо-мастера, салон, клиенты, записи
```

## 6. Проверка без Telegram

```bash
pnpm dev
```

- API: <http://localhost:4420/api/health> должен ответить `{"ok":true,...}`.
- Mini App: <http://localhost:5420> — откроется «Вход для разработки» с демо-персонажами (Анна — клиент, Мария — мастер, Ольга — салон, Алексей — владелец).
- В логе API будет `BOT_TOKEN is empty: using the mock bot` — сообщения бота пока складываются в <http://localhost:4420/api/dev/outbox>.

Остановите `pnpm dev` (Ctrl+C) и переходите к настоящему боту.

## 7. Создать бота

1. Откройте [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Введите имя (например, `Glow Dev`) и юзернейм, оканчивающийся на `bot` (например, `glow_dev_ivan_bot`).
3. Сохраните токен вида `1234567890:AA...` — это `BOT_TOKEN`. Никому его не показывайте и не коммитьте.
4. Узнайте свой Telegram ID: напишите [@userinfobot](https://t.me/userinfobot), он ответит числом `Id`. Этот ID получит доступ к админке платформы.

Совет: для локальной разработки заведите отдельного бота — один токен может опрашивать только один процесс.

## 8. HTTPS-туннель к Mini App

В отдельном терминале:

```bash
cloudflared tunnel --url http://localhost:5420
```

В выводе появится адрес вида `https://random-words.trycloudflare.com` — дальше он называется `<TUNNEL>`. Терминал с туннелем не закрывайте.

> Быстрый туннель Cloudflare получает новый адрес при каждом запуске — тогда повторите шаги 9–10. Если нужен постоянный адрес, создайте именованный туннель Cloudflare со своим доменом. ngrok тоже подойдёт, но на бесплатном тарифе он показывает страницу-предупреждение, которую Telegram-вебвью не умеет пропускать.

Vite уже настроен принимать запросы с любого хоста и проксировать `/api` и `/uploads` на API, поэтому одного туннеля достаточно.

## 9. Заполнить `.env`

`apps/api/.env`:

```dotenv
BOT_TOKEN=1234567890:AA...                 # токен из шага 7
BOT_USERNAME=glow_dev_ivan_bot             # юзернейм бота без @
BOT_MODE=polling
PLATFORM_OWNER_TELEGRAM_ID=123456789       # ваш ID из @userinfobot

WEB_APP_URL=https://random-words.trycloudflare.com
PUBLIC_API_URL=https://random-words.trycloudflare.com
CORS_ORIGINS=https://random-words.trycloudflare.com,http://localhost:5420

DEV_AUTH_ENABLED=true                      # оставляет вход персонажами на localhost
```

`apps/web/.env`:

```dotenv
VITE_API_URL=                              # пусто: запросы идут на тот же адрес и проксируются Vite
VITE_BOT_USERNAME=glow_dev_ivan_bot
```

Остальное можно не трогать: без ключей ЮKassa работает тестовая оплата, без ключа Яндекс Карт — встроенная схематичная карта, фото сохраняются в `apps/api/uploads`.

## 10. Подключить Mini App в BotFather

1. `/mybots` → ваш бот → **Bot Settings** → **Configure Mini App** → **Enable Mini App** → отправьте `<TUNNEL>`.
   Это главный Mini App бота: на него ведут ссылки `t.me/<бот>?startapp=...` из уведомлений, QR-кодов и приглашений.
2. Кнопку меню настраивать вручную не нужно — API при старте сам ставит кнопку «Glow», если `WEB_APP_URL` начинается с `https://`, и регистрирует команды `/start`, `/search`, `/master`, `/salon`, `/subscription`, `/promo`, `/help`.

Необязательно — именованный Mini App (`t.me/<бот>/<имя>`): `/newapp` в BotFather, затем укажите короткое имя в `MINI_APP_SHORT_NAME` (API) и `VITE_MINI_APP_SHORT_NAME` (web).

## 11. Запуск

```bash
pnpm dev
```

В логе API должно быть:

```
API listening  port: 4420, payments: "mock", bot: "polling"
Telegram bot polling started  username: "glow_dev_ivan_bot"
Cron scheduler started
```

После каждого изменения `.env` перезапускайте `pnpm dev` — переменные читаются только при старте.

## 12. Проверить в Telegram

1. Откройте бота и отправьте `/start` — придут кнопки «Я клиент», «Я мастер», «Я владелец салона».
2. Нажмите кнопку меню **Glow** или любую кнопку — откроется Mini App с вашим Telegram-аккаунтом (вход по `initData` с проверкой подписи, без демо-персонажей).
3. Пройдите онбординг клиента и найдите демо-мастеров из сида (например, страницу `maria-nails`) — запишитесь к ним.
4. Чтобы увидеть уведомления мастера, станьте мастером сами: `/start` → «Я мастер» → онбординг. Один аккаунт может быть одновременно клиентом и мастером, поэтому можно записаться к самому себе (кабинет → «Поделиться» → ссылка) и получить сообщение о новой записи с кнопками «Подтвердить» и «Отклонить».
5. Владелец (`PLATFORM_OWNER_TELEGRAM_ID`) видит в `/start` кнопку админки, а в Mini App — раздел `/admin`.

### Запустить фоновые задачи вручную

Cron работает и сам, но для проверки не нужно ждать — задачу можно вызвать запросом (только вне production):

```bash
curl -X POST http://localhost:4420/api/dev/cron/reminders              # напоминания за 24 ч и 2 ч, открытки, просьбы об отзыве
curl -X POST http://localhost:4420/api/dev/cron/evening                # вечерняя сводка (уходит в выбранное мастером время)
curl -X POST http://localhost:4420/api/dev/cron/morning                # утренняя сводка
curl -X POST http://localhost:4420/api/dev/cron/subscriptionReminders  # напоминания об окончании подписки
curl -X POST http://localhost:4420/api/dev/cron/digest                 # еженедельный дайджест владельцу
```

Остальные задачи: `expire`, `autopay`, `onlineClose`, `birthdays`.

### Оплата

По умолчанию кнопка «Оплатить» открывает тестовую страницу оплаты внутри приложения — нажмите «Оплатить», и подписка продлится, как после настоящего вебхука.

Чтобы проверить настоящую ЮKassa в тестовом режиме:

1. Создайте тестовый магазин в личном кабинете ЮKassa, впишите `YOOKASSA_SHOP_ID` и тестовый `YOOKASSA_SECRET_KEY` (`test_...`).
2. Задайте `YOOKASSA_WEBHOOK_SECRET` и `YOOKASSA_SKIP_IP_CHECK=true` — локально запрос приходит через туннель и прокси, поэтому проверку IP ЮKassa нужно отключить (в production она всегда включена).
3. Выполните `pnpm --filter @nail-crm/api webhook:url` и вставьте выданный адрес в ЮKassa → _Интеграция → HTTP-уведомления_.
4. Тестовая карта: `5555 5555 5555 4477`, любой будущий срок, любой CVC.

### Яндекс Карты (необязательно)

Получите ключ «JavaScript API и HTTP Геокодер» в [кабинете разработчика](https://developer.tech.yandex.ru/), добавьте в ограничения по HTTP Referer `localhost` и домен туннеля, впишите ключ в `VITE_YANDEX_MAPS_API_KEY` и перезапустите `pnpm dev`.

## 13. Отладка Mini App

- **Telegram Desktop:** Настройки → Продвинутые → Экспериментальные настройки → _Enable webview inspection_, затем правый клик внутри Mini App → _Inspect_ / _Reload_.
- **Android:** включите отладку WebView (Настройки Telegram → долгое нажатие на номер версии → _Enable WebView Inspection_) и откройте `chrome://inspect` на компьютере.
- **iOS:** Safari → Разработка → ваш iPhone (нужен включённый «Веб-инспектор»).
- В браузере на <http://localhost:5420> приложение работает в режиме персонажей — удобно для вёрстки, но кнопки Telegram (MainButton, BackButton) там заменены обычными.

## 14. Частые проблемы

| Симптом                                                        | Причина и решение                                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| В логе `409 Conflict: terminated by other getUpdates request`  | Этот токен уже опрашивает другой процесс (второй `pnpm dev`, другой компьютер, продакшен). Остановите его или заведите отдельного бота для разработки.                                 |
| Бот молчит, в логе `bot: "mock"`                               | Пустой `BOT_TOKEN` или `.env` не перечитан — перезапустите `pnpm dev`.                                                                                                                 |
| Бот не получает сообщения, а раньше работал на вебхуке         | Сбросьте вебхук: `curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`.                                                                                                           |
| Mini App не открывается или белый экран                        | Сменился адрес быстрого туннеля — обновите `WEB_APP_URL`, `PUBLIC_API_URL`, `CORS_ORIGINS` и URL в BotFather, перезапустите. Проверьте, что `<TUNNEL>` открывается в обычном браузере. |
| В Mini App «Не удалось войти» / 401                            | `initData` подписан другим ботом: `BOT_TOKEN` должен принадлежать тому боту, из которого открыт Mini App. Также проверьте системное время на компьютере.                               |
| Нет кнопки меню «Glow»                                         | `WEB_APP_URL` не https. После исправления перезапустите API и заново откройте чат с ботом.                                                                                             |
| Кнопки в уведомлениях открывают ссылку `t.me`, а не приложение | То же: кнопки `web_app` используются только при https-адресе. Плюс в BotFather должен быть включён главный Mini App (шаг 10).                                                          |
| `Port 5420 is already in use`                                  | Порты фиксированы (5420 — web, 4420 — API). Освободите порт или поменяйте `PORT` в API и `port`/`VITE_API_PROXY_TARGET` в web.                                                         |
| `Can't reach database server`                                  | PostgreSQL не запущен или `DATABASE_URL` неверный. Для Docker: `docker start glow-pg`.                                                                                                 |
| Нужно начать с чистой базы                                     | `pnpm db:reset && pnpm db:seed` — удалит все данные.                                                                                                                                   |

# Деплой Glow на VPS

Пошаговая настройка Ubuntu-сервера для продакшена: nginx + TLS, PostgreSQL, PM2, один процесс API (бот + cron).

В репозитории уже есть скрипты:

| Файл                          | Назначение                                                  |
| ----------------------------- | ----------------------------------------------------------- |
| `deploy/setup-vps.sh`         | Первичная настройка чистого Ubuntu                          |
| `deploy/deploy.sh`            | Обновление: pull → install → migrate → build → `pm2 reload` |
| `deploy/nginx/glow.conf`      | Конфиг nginx (статика + прокси `/api`, `/uploads`)          |
| `deploy/ecosystem.config.cjs` | PM2: **один** fork-процесс API                              |

---

## 1. Что нужно заранее

### VPS

| Параметр | Минимум                  | Комфортно         |
| -------- | ------------------------ | ----------------- |
| ОС       | Ubuntu 22.04 / 24.04 LTS | то же             |
| RAM      | 2 GB                     | 4 GB              |
| CPU      | 1 vCPU                   | 2 vCPU            |
| Диск     | 20 GB SSD                | 40 GB+            |
| Сеть     | публичный IPv4           | + IPv6 по желанию |

Провайдеры: Hetzner, Timeweb, Selectel, DigitalOcean, Aeza и т.п.

### Домен

1. Купите домен (например `glow.example.com` или `app.yourbrand.ru`).
2. В DNS создайте **A-запись** на IP VPS:
   ```
   app.example.com.   A   203.0.113.10
   ```
3. Дождитесь распространения DNS (обычно 5–30 минут). Проверка:
   ```bash
   dig +short app.example.com
   ```

### Telegram-бот

1. [@BotFather](https://t.me/BotFather) → `/newbot` → сохраните **токен** и **username** (без `@`).
2. Узнайте свой Telegram ID через [@userinfobot](https://t.me/userinfobot) — это владелец платформы (`PLATFORM_OWNER_TELEGRAM_ID`).

### Репозиторий

Нужен git-доступ с сервера:

- HTTPS: `https://github.com/you/minibook.git` (+ token при необходимости)
- или SSH: `git@github.com:you/minibook.git` (ключ в `~/.ssh` на VPS)

---

## 2. Быстрый путь: `setup-vps.sh`

На чистом Ubuntu под root (или через `sudo`):

```bash
# 1. Временный клон только ради скрипта (или скопируйте deploy/setup-vps.sh вручную)
git clone <REPO_URL> /tmp/glow-bootstrap
cd /tmp/glow-bootstrap

# 2. Первичная настройка
sudo DOMAIN=app.example.com \
     EMAIL=you@example.com \
     REPO=<REPO_URL> \
     bash deploy/setup-vps.sh
```

Скрипт сделает:

1. Пакеты: `nginx`, `postgresql`, `certbot`, `ufw`, `git`, `curl`
2. Node.js 22, pnpm (corepack), PM2
3. Роль/БД PostgreSQL `glow` / `glow` со случайным паролем
4. Клон репозитория в `/opt/glow`
5. Генерацию `apps/api/.env` и `apps/web/.env` (секреты, URL, `DEV_AUTH=false`)
6. nginx + Let's Encrypt TLS
7. firewall (SSH + HTTP/HTTPS)
8. Первый `deploy/deploy.sh` и `pm2 save`

После выполнения откройте: `https://app.example.com/api/health` → `{"ok":true,...}`.

---

## 3. Ручная настройка (если без скрипта)

### 3.1. Система

```bash
sudo apt-get update -y
sudo apt-get install -y curl git nginx postgresql postgresql-contrib \
  certbot python3-certbot-nginx ufw
```

### 3.2. Node.js 22 + pnpm + PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
sudo corepack enable
sudo npm install -g pm2
node -v   # v22.x
pnpm -v
```

### 3.3. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE glow LOGIN PASSWORD 'ЗАМЕНИТЕ_НА_СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE glow OWNER glow;
SQL
```

Строка подключения:

```
postgresql://glow:ЗАМЕНИТЕ_НА_СИЛЬНЫЙ_ПАРОЛЬ@localhost:5432/glow
```

### 3.4. Код

```bash
sudo mkdir -p /opt/glow
sudo chown "$USER":"$USER" /opt/glow
git clone <REPO_URL> /opt/glow
cd /opt/glow
```

### 3.5. Переменные окружения

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
nano apps/api/.env
nano apps/web/.env
```

#### Обязательно в `apps/api/.env` (production)

```dotenv
NODE_ENV=production
PORT=4420
TRUST_PROXY=1
LOG_LEVEL=info

PUBLIC_API_URL=https://app.example.com
WEB_APP_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com

DATABASE_URL=postgresql://glow:ПАРОЛЬ@localhost:5432/glow

BOT_TOKEN=123456:AA...
BOT_USERNAME=your_bot_username
BOT_MODE=webhook
BOT_WEBHOOK_SECRET=$(openssl rand -hex 24)
PLATFORM_OWNER_TELEGRAM_ID=123456789
PLATFORM_TIMEZONE=Europe/Moscow

JWT_SECRET=$(openssl rand -hex 32)
JWT_TTL=7d
DEV_AUTH_ENABLED=false

CRON_ENABLED=true
RATE_LIMIT_ENABLED=true

STORAGE_DRIVER=local
UPLOAD_DIR=./uploads
```

> **Важно:** API должен работать **одним** процессом. При `BOT_MODE=polling` или включённом cron второй инстанс сломает бота / удвоит задачи. В `ecosystem.config.cjs` уже `instances: 1`.

#### Рекомендуется для продакшена

```dotenv
# ЮKassa
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_WEBHOOK_SECRET=$(openssl rand -hex 24)
YOOKASSA_SKIP_IP_CHECK=false

# Яндекс (подсказки адресов на сервере)
YANDEX_MAPS_API_KEY=...
YANDEX_SUGGEST_API_KEY=...

# Фото в Cloudflare R2 (опционально)
# STORAGE_DRIVER=r2
# R2_ACCOUNT_ID=...
# R2_ACCESS_KEY=...
# R2_SECRET_KEY=...
# R2_BUCKET=...
# R2_PUBLIC_URL=https://cdn.example.com
```

#### `apps/web/.env` (собирается на этапе `pnpm build`)

```dotenv
VITE_API_URL=
VITE_BOT_USERNAME=your_bot_username
VITE_MINI_APP_SHORT_NAME=
VITE_YANDEX_MAPS_API_KEY=...
VITE_YANDEX_SUGGEST_API_KEY=...
VITE_DEFAULT_LANGUAGE=ru
VITE_DEV_AUTH=false
```

`VITE_*` попадают в бандл при сборке — после смены ключей нужен новый `pnpm build` / `deploy.sh`.

### 3.6. Сборка и миграции

```bash
cd /opt/glow
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm db:seed          # категории, страны, города
pnpm build
```

### 3.7. PM2

```bash
cd /opt/glow
pm2 start deploy/ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME"
# выполните команду, которую выведет pm2 startup
```

Проверка:

```bash
curl -fsS http://127.0.0.1:4420/api/health
pm2 logs glow-api --lines 50
```

### 3.8. nginx + TLS

```bash
# Подставьте свой домен вместо app.example.com
DOMAIN=app.example.com
EMAIL=you@example.com

sudo mkdir -p /var/www/certbot
sudo sed "s/app.example.com/${DOMAIN}/g" /opt/glow/deploy/nginx/glow.conf \
  | sudo tee /etc/nginx/sites-available/glow.conf
sudo ln -sf /etc/nginx/sites-available/glow.conf /etc/nginx/sites-enabled/glow.conf
sudo rm -f /etc/nginx/sites-enabled/default
```

Временный HTTP для выпуска сертификата:

```bash
sudo tee /etc/nginx/sites-enabled/glow.conf >/dev/null <<EOF
server {
  listen 80;
  server_name ${DOMAIN};
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 200 'ok'; }
}
EOF
sudo nginx -t && sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" -m "$EMAIL" --agree-tos -n

# Вернуть полный конфиг с SSL
sudo sed "s/app.example.com/${DOMAIN}/g" /opt/glow/deploy/nginx/glow.conf \
  | sudo tee /etc/nginx/sites-available/glow.conf
sudo ln -sf /etc/nginx/sites-available/glow.conf /etc/nginx/sites-enabled/glow.conf
sudo nginx -t && sudo systemctl reload nginx
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

Проверка: `https://app.example.com/api/health`.

---

## 4. Подключить Mini App в Telegram

1. BotFather → `/mybots` → ваш бот → **Bot Settings** → **Configure Mini App** → **Enable Mini App**  
   URL: `https://app.example.com`
2. (Опционально) именованный Mini App: `/newapp`, затем `MINI_APP_SHORT_NAME` и `VITE_MINI_APP_SHORT_NAME`.
3. Перезапустите API (`pm2 reload glow-api`), чтобы бот зарегистрировал команды и кнопку меню (если `WEB_APP_URL` на https).

При `BOT_MODE=webhook` API сам вызывает `setWebhook` на:

```
https://app.example.com/api/bot/webhook
```

Секрет: `BOT_WEBHOOK_SECRET` (заголовок Telegram).

Проверка: напишите боту `/start` — должны прийти кнопки ролей.

---

## 5. ЮKassa (опционально)

1. Заполните `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_WEBHOOK_SECRET` в `apps/api/.env`.
2. На сервере:
   ```bash
   cd /opt/glow
   pnpm --filter @nail-crm/api webhook:url
   ```
3. Вставьте URL в ЮKassa → Интеграция → HTTP-уведомления  
   События: `payment.succeeded`, `payment.canceled`, `refund.succeeded`.
4. `YOOKASSA_SKIP_IP_CHECK=false` в production.
5. `pm2 reload glow-api`

---

## 6. Яндекс Карты

В кабинете разработчика Яндекса:

| Продукт                                             | Куда                                                           |
| --------------------------------------------------- | -------------------------------------------------------------- |
| **JavaScript API и HTTP Геокодер** (JS API **3.0**) | `VITE_YANDEX_MAPS_API_KEY` (+ серверный `YANDEX_MAPS_API_KEY`) |
| **HTTP Геосаджест**                                 | `VITE_YANDEX_SUGGEST_API_KEY` / `YANDEX_SUGGEST_API_KEY`       |

В ограничениях Referer ключей укажите:

```
app.example.com
```

После смены `VITE_*` — пересборка:

```bash
cd /opt/glow && bash deploy/deploy.sh
```

---

## 7. Обновление кода

На сервере:

```bash
cd /opt/glow
bash deploy/deploy.sh          # ветка main
# или
bash deploy/deploy.sh develop
```

Скрипт: `git pull` → `pnpm install` → миграции → `pnpm build` → `pm2 reload` → health-check.

Не запускайте второй `pm2 start` вручную — только `reload` через `deploy.sh`.

---

## 8. Бэкапы PostgreSQL

Ежедневный дамп (cron от root или пользователя приложения):

```bash
sudo mkdir -p /var/backups/glow
sudo tee /etc/cron.d/glow-pg-backup >/dev/null <<'EOF'
15 3 * * * postgres pg_dump -Fc glow > /var/backups/glow/glow-$(date +\%F).dump
EOF
```

Восстановление:

```bash
pg_restore -U glow -d glow --clean --if-exists /var/backups/glow/glow-2026-10-05.dump
```

Также бэкапьте `apps/api/uploads`, если `STORAGE_DRIVER=local`.

---

## 9. Полезные команды

```bash
pm2 status
pm2 logs glow-api
pm2 reload glow-api

curl -fsS https://app.example.com/api/health
curl -fsS https://app.example.com/api/meta

sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --dry-run

# логи nginx
sudo tail -f /var/log/nginx/error.log
```

---

## 10. Чек-лист перед «боевым» запуском

- [ ] `NODE_ENV=production`
- [ ] `DEV_AUTH_ENABLED=false`, `VITE_DEV_AUTH=false`
- [ ] Уникальные длинные `JWT_SECRET`, `BOT_WEBHOOK_SECRET`, `YOOKASSA_WEBHOOK_SECRET`
- [ ] `BOT_MODE=webhook`, токен только у этого сервера (не крутится локальный `pnpm dev` с тем же токеном)
- [ ] `WEB_APP_URL` / `PUBLIC_API_URL` / `CORS_ORIGINS` = ваш https-домен
- [ ] `TRUST_PROXY=1`
- [ ] DNS A-запись указывает на VPS
- [ ] BotFather Mini App URL = `https://ваш-домен`
- [ ] `/api/health` отвечает `ok`
- [ ] `/start` в боте работает
- [ ] Mini App открывается из Telegram (не Error 1033)
- [ ] Настроен `pg_dump` по cron
- [ ] PM2 в автозапуске (`pm2 startup` + `pm2 save`)

---

## 11. Частые проблемы

| Симптом                  | Решение                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Error 1033 / туннель     | На VPS туннель не нужен. В BotFather должен быть **ваш домен**, не `*.trycloudflare.com`                   |
| Bot молчит, 409 Conflict | Тот же `BOT_TOKEN` крутится ещё где-то (локальный `pnpm dev`). Остановите лишний процесс или смените токен |
| Mini App белый экран     | Смотрите DevTools WebView; часто CORS / старый бандл — `deploy.sh` и жёсткое обновление                    |
| 502 Bad Gateway          | API не запущен: `pm2 logs glow-api`, `curl 127.0.0.1:4420/api/health`                                      |
| Карта не грузится        | Ключ JS API 3.0 + Referer = ваш домен; пересборка web после смены `VITE_*`                                 |
| ЮKassa webhook 403       | `TRUST_PROXY=1`, nginx передаёт `X-Forwarded-For`, `YOOKASSA_SKIP_IP_CHECK=false`                          |
| Диск кончается           | Ротация логов `pm2 flush`, чистка старых `pg_dump`, R2 вместо локальных uploads                            |

---

## 12. Архитектура на сервере

```
Internet
   │
   ▼
nginx :443 (TLS)
   ├─ /            → /opt/glow/apps/web/dist  (SPA)
   ├─ /assets/     → статика, long cache
   ├─ /api/        → 127.0.0.1:4420  (Express)
   └─ /uploads/    → 127.0.0.1:4420

PM2: glow-api (1 process)
   ├─ HTTP API
   ├─ Telegram bot (webhook или polling)
   └─ cron (напоминания, автоплатежи, дайджесты)

PostgreSQL :5432  (localhost)
```

Локальная разработка с `cloudflared` описана отдельно: [local-telegram-bot.md](./local-telegram-bot.md).

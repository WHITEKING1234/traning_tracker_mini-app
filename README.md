# Telegram Training App

Личное mobile-first web-приложение для тренировок, которое можно запускать как Telegram Mini App. Внутри уже зашита программа на понедельник, среду и пятницу, запись подходов `кг x повторы`, таймер отдыха, прогресс, вес тела и техника упражнений.

## Local Run

MVP не требует установки зависимостей.

```bash
npm run dev
```

По умолчанию сервер откроется на:

```text
http://127.0.0.1:3000
```

Тесты:

```bash
npm test
```

## Environment

- `PORT` — порт сервера, по умолчанию `3000`.
- `HOST` — host для сервера. По умолчанию `127.0.0.1` в development и `0.0.0.0` в production.
- `DATA_FILE` — путь к JSON-базе, по умолчанию `data/app-data.json`.
- `BOT_TOKEN` — токен Telegram-бота для проверки Mini App `initData`.

Без `BOT_TOKEN` приложение работает в local dev fallback с пользователем `dev-user`. В production нужно задать `BOT_TOKEN`, иначе API не должен принимать реальные Telegram-запросы.

## Telegram Setup

1. Открой `@BotFather` в Telegram.
2. Создай бота командой `/newbot`.
3. Сохрани bot token в переменную окружения `BOT_TOKEN` на сервере.
4. Задеплой приложение на публичный HTTPS URL.
5. В `@BotFather` выбери бота и настрой Menu Button или Mini App URL на HTTPS адрес приложения.
6. Открой бота в Telegram на iPhone и нажми кнопку приложения.

Telegram launch data валидируется на backend. Никогда не добавляй `BOT_TOKEN` в frontend-код.

## Free GitHub Pages Deploy

Если нужен полностью бесплатный запуск без Render и сервера, используй GitHub Pages. В этом режиме приложение работает как static Telegram Mini App, а веса, подходы, вес тела и ссылки на технику сохраняются в `localStorage` на устройстве.

1. Открой repo settings: `https://github.com/WHITEKING1234/traning_tracker_mini-app/settings/pages`.
2. В `Build and deployment` выбери Source → `GitHub Actions`.
3. Перейди во вкладку Actions и запусти workflow `Deploy GitHub Pages`, если он не стартовал сам.
4. После deploy открой:

```text
https://WHITEKING1234.github.io/traning_tracker_mini-app/
```

5. Эту ссылку вставь в `@BotFather` как Mini App/Menu Button URL.

Ограничение этого режима: данные живут только на устройстве. Если очистить данные Safari/Telegram WebView или открыть приложение с другого телефона, история не синхронизируется.

## Render Deploy

В репозитории есть `render.yaml`, поэтому Render может поднять сервис как Blueprint.

1. Открой Render Dashboard и выбери New → Blueprint.
2. Подключи GitHub repo `WHITEKING1234/traning_tracker_mini-app`.
3. Render прочитает `render.yaml`.
4. В поле `BOT_TOKEN` вставь токен Telegram-бота из `@BotFather`.
5. Запусти deploy.
6. После успешного деплоя открой `https://...onrender.com/api/health`.
7. Если ответ `{ "ok": true, "app": "training-os" }`, вставь основной HTTPS URL в BotFather как Mini App/Menu Button URL.

`BOT_TOKEN` хранится как secret env var на Render и не коммитится в GitHub.

## iPhone Home Screen Icon

Приложение подготовлено как installable web app:

- `public/manifest.webmanifest`
- `public/apple-touch-icon.png`
- `public/icon-192.png`
- `public/icon-512.png`

Чтобы добавить иконку на iPhone:

1. Открой HTTPS-ссылку приложения в Safari на iPhone.
2. Нажми Share.
3. Выбери Add to Home Screen.
4. Назови иконку `Training OS`.
5. Нажми Add.

Для локального `http://127.0.0.1:3000` iPhone-иконка не подойдет, потому что телефон не видит localhost на Mac. Нужен публичный HTTPS URL.

## Deploy Health Check

Для проверки деплоя есть публичный health endpoint:

```text
GET /api/health
```

Ожидаемый ответ:

```json
{ "ok": true, "app": "training-os" }
```

## Data

Все записи сохраняются server-side в JSON-файл:

```text
data/app-data.json
```

Этот файл игнорируется git, потому что содержит личную историю тренировок. Позже его можно заменить на SQLite или Postgres, сохранив API-контракт.

## Current MVP

- Сегодня: метрики в WHOOP-like стиле и план тренировки.
- Тренировка: Пн/Ср/Пт, список упражнений, статус подходов.
- Упражнение: техника, запись веса и повторов, история, таймер отдыха.
- Прогресс: графики лучшего веса, объема и веса тела.
- Настройки: запись веса тела и ссылок на фото/видео техники.

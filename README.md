# EXILE HUB — стартовый хаб по Path of Exile 2

Веб-приложение-онбординг для PoE2: на одном экране — **что играть**, **куда качаться** и
**что нового в лиге**. Лента видео/новостей наполняется автоматически из YouTube, Reddit и
офсайта; популярные ролики сворачиваются в **AI-дайджест** (TL;DR + что изменилось в патче + билды).

Архитектура (MVP): **пайплайн (Python) → SQLite → FastAPI → веб-фронт**. Всё работает локально;
позже выносится в облако без переписывания (SQLite → Postgres сменой строки подключения).

## Архитектура

```
yt-dlp / Reddit / PoE news  →  pipeline/run.py  →  SQLite (data/exilehub.db)
                                                        ▲
                                          backend/app.py (FastAPI) ── /api/feed, /api/item, /api/meta
                                                        ▲ + раздаёт web/ статикой
                                              web/ (UI)  →  http://localhost:8000
```

## Запуск локально

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt

# 1) наполнить БД (создастся автоматически при первом прогоне)
.\.venv\Scripts\python pipeline\run.py

# 2) поднять приложение (API + сайт на одном порту)
.\.venv\Scripts\python -m uvicorn backend.app:app --port 8000 --reload
#    открыть http://localhost:8000
```

AI-дайджесты включаются переменной `ANTHROPIC_API_KEY` (без неё лента собирается без дайджестов,
кроме закэшированных в БД). Обновить данные на лету: `POST /api/refresh` или повторный `run.py`.

## База данных (SQLite через SQLModel)

| Таблица | Назначение |
|---|---|
| `item` | элементы ленты (video/news/reddit): мета, `views`, `first_seen`/`last_seen`, `score` |
| `digest` | AI-дайджест на `item_id` (кэш — не платить за анализ повторно) |
| `transcript` | сырьё транскриптов |
| `source` | источники дискавери (yt-запросы, сабреддиты, новости) — редактируемо |
| `run` | лог прогонов пайплайна |
| `meta` | `league`, `last_updated` |

Файл БД: `data/exilehub.db` (локальный, в `.gitignore` можно держать или коммитить — на выбор).

## Структура

```
web/                 фронт (index.html, styles.css, app.js) — fetch /api/feed (фолбэк: data/feed.json → демо)
backend/app.py       FastAPI: /api/* + раздача web/
pipeline/
  db.py              модели SQLModel + движок + запросы (общие для пайплайна и API)
  run.py             агрегатор: дискавери + reddit + новости + анализ → запись в БД + экспорт feed.json
  sources.json       стартовый сид источников + лимиты + модель анализа
data/                exilehub.db, digests/ (сид-дайджесты)
.github/workflows/   refresh.yml — задел под публичный деплой (статический экспорт)
```

## Путь «локально → паблик» (потом, без переделки ядра)
- **(a)** экспорт `feed.json` (`run.py` уже пишет его) → GitHub Pages: дёшево, БД остаётся локальной.
- **(b)** задеплоить FastAPI+БД на хост (Fly/Railway/VPS), SQLite → Postgres через те же модели SQLModel.

## Честные оговорки
- **YouTube с CI/датацентр-IP** лимитится жёстче — для паблика возможен ключ YouTube Data API или прогон по крону локально/на VPS.
- **Reddit** иногда 429 → ретрай + мягкая деградация (хватает одного сабреддита).
- **Тир-лист / мета / экономика** на сайте пока демо — следующий коннектор (poe.ninja), та же схема БД.

# Лендинг ИИ-бота для госзакупок — подбор КТРУ

Next.js лендинг с интеграцией AI-агента для помощи в подборе кодов КТРУ по 44-ФЗ и 223-ФЗ.

## Технологии

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS 4**
- **React 19**

## Разработка

### Установка зависимостей

```bash
npm install
```

### Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу [http://localhost:3000](http://localhost:3000).

### Сборка для продакшена

```bash
npm run build
npm start
```

### Линтинг

```bash
npm run lint
```

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните значения:

```bash
cp .env.example .env.local
```

### Обязательные переменные

- `N8N_WEBHOOK_URL` — URL webhook n8n для обработки сообщений чата
- `N8N_SECRET` — секретный ключ для защиты webhook (опционально)

### Опциональные переменные

- `CHAT_TIMEOUT_MS` — таймаут ожидания ответа от n8n (по умолчанию: 25000)
- `LOGS_ROOT` — путь к директории для логов (по умолчанию: `./logs`)
- `RATE_LIMIT_WINDOW_SEC` — окно для rate limiting в секундах (по умолчанию: 3600)
- `RATE_LIMIT_MAX_REQUESTS` — максимальное количество запросов в окне (по умолчанию: 20)

## Структура проекта

```
landing-app/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API роуты
│   │   │   ├── chat/     # Обработка сообщений чата
│   │   │   ├── analytics/# Аналитика событий
│   │   │   └── health/   # Health check
│   │   ├── layout.tsx    # Корневой layout
│   │   └── page.tsx      # Главная страница
│   ├── components/       # React компоненты
│   │   ├── chat-widget.tsx
│   │   └── feedback-form.tsx
│   └── lib/              # Утилиты
│       └── log-service.ts
└── public/               # Статические файлы
```

## API Endpoints

### `POST /api/chat`

Отправка сообщения в чат. Ожидает:

```json
{
  "clientId": "uuid",
  "message": "текст сообщения",
  "history": [{"role": "user|agent", "content": "..."}],
  "meta": {}
}
```

Возвращает:

```json
{
  "reply": "ответ от агента",
  "latencyMs": 1234,
  "status": "ok|fallback|error"
}
```

### `POST /api/analytics`

Запись аналитического события. Ожидает:

```json
{
  "clientId": "uuid",
  "sessionId": "uuid",
  "event": "chat_open|chat_message_sent|...",
  "payload": {}
}
```

### `GET /api/health`

Health check endpoint для мониторинга.

## Логирование

Все события логируются в CSV файлы в структуре:

```
LOGS_ROOT/
  YYYY/
    MM/
      chat-YYYY-MM-DD.csv
      events-YYYY-MM-DD.csv
```

## Деплой на Render

1. Создайте Web Service в Render
2. Подключите Render Disk (2GB) и примонтируйте в `/data/logs`
3. Установите переменные окружения из `.env.example`
4. Build command: `npm install && npm run build`
5. Start command: `npm run start`
6. Настройте health check на `/api/health`

## Безопасность

- Rate limiting: максимум 20 запросов в час на `clientId`
- Валидация размера сообщений: максимум 2000 символов
- Таймаут запросов к n8n: 25 секунд
- Защита webhook через заголовок `x-n8n-secret`

## Лицензия

Приватный проект.

## Архитектура лендинга и интеграции с n8n

### 1. Общая схема

```
Пользователь (браузер)
   ↓ HTTPS
Next.js (Render Web Service)
   ├─ /api/chat → (REST) → n8n Webhook Workflow → AI Agent → ответ
   ├─ /api/analytics → запись событий в CSV (Render Disk) → (cron) → бэкап в Object Storage
   └─ UI компонентов (лендинг + чат + форма)

Render Disk (персистентный)
   └─ /data/logs/YYYY/MM/{chat|events}-YYYY-MM-DD.csv
```

### 2. Фронтенд
- **Стек:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- **Состояние:** Zustand или React Context для хранения текущей сессии чата
- **Генерация clientId:** `uuidv4()` → сохраняем в cookie (`ktro_agent_id`, срок 180 дней, SameSite=Lax) и `localStorage`
- **Чат:** компоненты `ChatToggleButton`, `ChatWindow`, `MessageList`, `MessageInput`
- **Форма обратной связи:** отправка на `/api/analytics` (событие) + опционально на `/api/feedback`
- **Защита:** rate limiting (например, ограничение 20 сообщений/час на clientId с помощью in-memory map или lightweight KV)

### 3. API-роут `/api/chat`
- **Метод:** `POST`
- **Body:**
  ```json
  {
    "clientId": "uuid",
    "message": "текст пользователя",
    "history": [ { "role": "user|agent", "content": "..." } ],
    "meta": { "page": "/", "ref": "utm_source=..." }
  }
  ```
- **Действия:**
  1. Валидация входных данных
  2. Проверка rate limit + HMAC подписи (опционально)
  3. Формирование запроса к n8n webhook (`POST n8nUrl?secret=...`)
  4. Ожидание ответа (таймаут 25 сек). При таймауте — статус 202 + ticket.
  5. Запись события в `chat-YYYY-MM-DD.csv`
  6. Ответ клиенту `{ reply, latency, ticket? }`
- **Формат записи в лог:**
  `timestamp_iso,clientId,direction,message,latency_ms,status,meta_json`

### 4. n8n Workflow
- **Старт:** Webhook Trigger (POST)
- **Ноды:**
  1. **Set Metadata:** задать timestamp, requestId
  2. **AI Agent:** текущий агент (OpenAI, память, код ноды остаётся)
  3. **Function Node (лог):** подготовка строки для логов (user message + agent reply)
  4. **HTTP Request (callback?) или Respond to Webhook:** вернуть `{ reply, debug }`
  5. **Google Sheets / DB (опционально):** дублирование логов
- **Безопасность:** ожидать query `secret`, IP allowlist, ограничить размер payload
- **Таймауты:** если агент отвечает >20 сек, возвращать промежуточный ответ и пушить обновление через повторный вызов (можно доработать позже)

### 5. API-роут `/api/analytics`
- **Назначение:** приём событий интерфейса и чата
- **Body пример:**
  ```json
  {
    "clientId": "uuid",
    "event": "chat_message_sent",
    "payload": { "length": 128 },
    "sessionId": "uuid",
    "timestamp": 1730816400000
  }
  ```
- **Обработка:**
  - Валидация event (whitelist)
  - Запись в `events-YYYY-MM-DD.csv`
  - Возврат `{ ok: true }`
- **Events:** `page_view`, `cta_click`, `chat_open`, `chat_message_sent`, `chat_message_received`, `chat_error`, `feedback_open`, `feedback_submitted`

### 6. Бэкапы и ротация логов
- **Cron (Render или n8n):** ежедневно в 02:00 MSK запускать скрипт:
  1. Закрыть текущие файлы (создать новые с датой)
  2. Архивировать вчерашние CSV → zip
  3. Отправить в Object Storage (S3-compatible) с именем `logs/YYYY/MM/DD/chat.zip`
  4. Очистить локальный диск от архивов старше 30 дней

### 7. Rate limiting и защита
- **Token bucket** per `clientId`: максимум 1 сообщение в 3 секунды, не более 20 сообщений в час
- **reCAPTCHA v3 или hCaptcha** для формы обратной связи (опционально)
- **Content filtering:** отсекать входные сообщения >2000 символов
- **CORS:** ограничить домен лендинга

### 8. Конфигурация окружения (`.env`)
```
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/ktro-agent
N8N_SECRET=...
CHAT_TIMEOUT_MS=25000
LOGS_ROOT=/data/logs
BACKUP_BUCKET=s3://storage-bucket/
BACKUP_ACCESS_KEY=...
BACKUP_SECRET_KEY=...
RATE_LIMIT_WINDOW_SEC=3600
RATE_LIMIT_MAX_REQUESTS=20
SITE_NAME="Робот Семён"
``` 

### 9. Мониторинг и оповещения
- Логи ошибок Next.js → Render Dashboard + Sentry (опционально)
- Экспонировать `/api/health` (вернёт `{ status: "ok", timestamp }`)
- n8n: node «Error trigger» → уведомление в Telegram/email

### 10. Дальнейшие улучшения
- Перенос логов в time-series БД (ClickHouse/Supabase) для гибкого анализа
- Добавление SSE/WS для потоковой генерации ответов
- Авторизация админ-панели для просмотра статистики в реальном времени


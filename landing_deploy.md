## Чек-лист деплоя на Render

### 1. Подготовка окружения
- [ ] Создать репозиторий (GitHub/GitLab), убедиться, что `.env.example` содержит необходимые переменные (`N8N_WEBHOOK_URL`, `N8N_SECRET`, `LOGS_ROOT`, `BACKUP_*`).
- [ ] Добавить файл `render.yaml` (опционально) с настройками сервиса, диска и cron-задач.
- [ ] Убедиться, что в `.gitignore` исключены директории `/data` и логи.

### 2. Render Web Service
- [ ] Создать новый Web Service, выбрать репозиторий и ветку.
- [ ] Build command: `npm install && npm run build`.
- [ ] Start command: `npm run start`.
- [ ] Подключить Render Disk (например, 2 GB) и примонтировать в `/data/logs`.
- [ ] Задать переменные окружения:
  - `LOGS_ROOT=/data/logs`
  - `N8N_WEBHOOK_URL=https://...` (из n8n)
  - `N8N_SECRET=...`
  - `BACKUP_BUCKET=s3://...` (если используем S3)
  - `BACKUP_ACCESS_KEY`, `BACKUP_SECRET_KEY`
- [ ] Настроить health check (GET `/api/health`, добавить маршрут при подключении).

### 3. Cron-задача для бэкапов (опционально)
- [ ] Создать Background Worker со скриптом `node scripts/backup.js` или перенести задачу в n8n cron.
- [ ] Передавать переменные окружения для доступа к S3.

### 4. Настройка домена
- [ ] Добавить custom domain в Render, выполнить DNS-валидацию (CNAME/ALIAS).
- [ ] Дождаться автоматической выдачи SSL, проверить https-доступ.

### 5. n8n-интеграция
- [ ] Настроить workflow с Webhook Trigger, убедиться, что URL совпадает с `N8N_WEBHOOK_URL`.
- [ ] Добавить проверку заголовка `x-n8n-secret`.
- [ ] В ветке логирования сохранить ответ в Google Sheets или БД (опционально).

### 6. Постдеплойные проверки
- [ ] Пройти чек-лист тестирования (см. `landing_testing.md`).
- [ ] Проверить, что в `/data/logs` появляются `chat-*.csv` и `events-*.csv`.
- [ ] Проверить, что fallback-сценарий работает при отключённом webhook.
- [ ] Убедиться, что форма обратной связи пишет событие и не падает без `N8N_WEBHOOK_URL`.
- [ ] Настроить уведомление о сбоях (Render Alerts + n8n Error Trigger → Telegram/e-mail).

### 7. Документация
- [ ] Обновить README с инструкциями по деплою и переменным окружения.
- [ ] Зафиксировать расписание бэкапов и ротации логов (в wiki/Notion).
- [ ] Добавить информацию о SLA и каналах поддержки.


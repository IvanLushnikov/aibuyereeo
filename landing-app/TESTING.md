# Инструкция по тестированию Webhook

## Быстрый старт

### 1. Тест через Next.js API (рекомендуется)

```bash
cd landing-app
./test-webhook.sh "ваше сообщение"
```

Или с кастомным сообщением:
```bash
./test-webhook.sh "нужен монитор 24 дюйма"
```

### 2. Прямой тест webhook n8n (минуя Next.js)

```bash
cd landing-app
source .env.local  # Загрузить переменные окружения
./test-webhook-direct.sh "ваше сообщение"
```

### 3. Мониторинг логов в реальном времени

**Вариант А: В отдельном терминале**

```bash
# Терминал 1: Запуск dev сервера с фильтрацией логов
cd landing-app
npm run dev 2>&1 | grep -E "(API|chat|webhook|n8n|error)" --color=always

# Терминал 2: Запуск тестов
cd landing-app
./test-webhook.sh "тест"
```

**Вариант Б: Все логи в файл**

```bash
cd landing-app
npm run dev 2>&1 | tee /tmp/nextjs.log

# В другом терминале смотрите логи:
tail -f /tmp/nextjs.log | grep -E "(API|chat|webhook|n8n)"
```

## Ручное тестирование через curl

### Тест через Next.js API:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-123",
    "message": "автомобиль",
    "history": [],
    "meta": {"source": "manual-test"}
  }' | python3 -m json.tool
```

### Прямой тест n8n webhook:

```bash
curl -v -X POST "https://n8n.persis.ru/webhook/214d4a37-ae45-4f40-882d-54955ce7ba0a" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "direct-test",
    "message": "автомобиль",
    "history": [],
    "meta": {"source": "direct-test"}
  }'
```

### Проверка конфигурации:

```bash
curl http://localhost:3000/api/test-webhook | python3 -m json.tool
```

## Что смотреть в логах

### Успешный запрос:
```
[API] Получено сообщение от clientId: ...
[API] Отправка запроса в n8n для clientId: ...
[API] Получен ответ от n8n для clientId: ...
[API] Отправка ответа для clientId: ...
```

### Ошибка webhook:
```
[API] n8n webhook вернул ошибку 500: ...
[API] Ошибка при вызове n8n webhook для clientId: ...
```

### Ошибка конфигурации:
```
[API] N8N_WEBHOOK_URL не настроен
[API] Некорректный N8N_WEBHOOK_URL: ...
```

## Диагностика проблем

### 1. Webhook не отвечает (404)
- Проверьте что workflow активен в n8n
- Проверьте что используется Production URL, а не Test URL
- Проверьте что HTTP Method = POST

### 2. Workflow не запускается (500)
- Откройте workflow в n8n
- Проверьте логи выполнения (Executions tab)
- Проверьте что все ноды правильно настроены
- Проверьте API ключи и подключения

### 3. Таймаут
- Проверьте что workflow не выполняется слишком долго
- Увеличьте CHAT_TIMEOUT_MS в .env.local (по умолчанию 25000ms)

## Полезные команды

```bash
# Проверка переменных окружения
cat landing-app/.env.local

# Проверка что сервер запущен
curl http://localhost:3000/api/health

# Тест с разными сообщениями
./test-webhook.sh "монитор"
./test-webhook.sh "компьютер"
./test-webhook.sh "принтер"
```


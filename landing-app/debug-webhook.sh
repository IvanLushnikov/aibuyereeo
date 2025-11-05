#!/bin/bash
# Детальная диагностика webhook

echo "🔍 Детальная диагностика webhook"
echo ""

WEBHOOK_URL="https://n8n.persis.ru/webhook/214d4a37-ae45-4f40-882d-54955ce7ba0a"

echo "1️⃣ Проверка доступности webhook..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": true}')

echo "   HTTP статус: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Webhook не найден - проверьте что workflow активен!"
    exit 1
elif [ "$HTTP_CODE" = "500" ]; then
    echo "⚠️  Webhook работает, но workflow не может запуститься"
    echo ""
    echo "2️⃣ Детальный ответ от n8n:"
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d '{
        "clientId": "debug-test",
        "message": "тест",
        "history": [],
        "meta": {"source": "debug"}
      }' | python3 -m json.tool
    echo ""
    echo "💡 Проверьте в n8n:"
    echo "   - Откройте вкладку 'Executions'"
    echo "   - Найдите последнее выполнение"
    echo "   - Посмотрите какая нода выдала ошибку"
    echo ""
    echo "   Обычные проблемы:"
    echo "   - Отсутствует API ключ OpenAI"
    echo "   - Ошибка в Code node"
    echo "   - Проблема с Google Sheets"
else
    echo "✅ Webhook отвечает (статус: $HTTP_CODE)"
fi


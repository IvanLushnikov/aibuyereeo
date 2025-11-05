#!/bin/bash
# Проверка доходит ли запрос до n8n

echo "🔍 Проверка доходит ли запрос до n8n webhook"
echo ""

WEBHOOK_URL="https://n8n.persis.ru/webhook/214d4a37-ae45-4f40-882d-54955ce7ba0a"

echo "1️⃣ Отправка простого POST запроса..."
echo "   URL: $WEBHOOK_URL"
echo "   Method: POST"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": "simple"}')

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
TIME=$(echo "$RESPONSE" | grep "TIME_TOTAL:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:" | grep -v "TIME_TOTAL:")

echo "📥 Ответ:"
echo "   HTTP статус: $HTTP_CODE"
echo "   Время ответа: ${TIME}s"
echo "   Тело ответа:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "404" ]; then
    echo "❌ 404 - Запрос доходит до n8n, но webhook не зарегистрирован"
    echo "   → Workflow не активен или URL неправильный"
elif [ "$HTTP_CODE" = "500" ]; then
    echo "✅ Запрос ДОХОДИТ до n8n (статус 500)"
    echo "   → Webhook работает, но workflow не может запуститься"
    echo "   → Проверьте вкладку 'Executions' в n8n"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅✅ Запрос доходит и workflow работает!"
else
    echo "⚠️  Неожиданный статус: $HTTP_CODE"
fi


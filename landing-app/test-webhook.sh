#!/bin/bash

# Скрипт для тестирования webhook
# Использование: ./test-webhook.sh [сообщение]

MESSAGE="${1:-автомобиль}"
API_URL="http://localhost:3000/api/chat"

echo "🧪 Тестирование webhook..."
echo "📝 Сообщение: $MESSAGE"
echo "🔗 URL: $API_URL"
echo ""

# Отправляем запрос и показываем результат
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"test-$(date +%s)\",
    \"message\": \"$MESSAGE\",
    \"history\": [],
    \"meta\": {\"source\": \"console-test\"}
  }")

echo "📥 Ответ от API:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Извлекаем ключевые поля
REPLY=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('reply', 'N/A'))" 2>/dev/null)
STATUS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('status', 'N/A'))" 2>/dev/null)
LATENCY=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('latencyMs', 'N/A'))" 2>/dev/null)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💬 Ответ бота: $REPLY"
echo "📊 Статус: $STATUS"
echo "⏱️  Latency: ${LATENCY}ms"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


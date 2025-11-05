#!/bin/bash
# Проверка правильности URL webhook

echo "🔍 Проверка URL webhook"
echo ""

# Читаем URL из .env.local
WEBHOOK_URL=$(grep N8N_WEBHOOK_URL /Users/ivanlusnikov/aibuyereeo/landing-app/.env.local | cut -d= -f2)

echo "📍 URL из .env.local:"
echo "   $WEBHOOK_URL"
echo ""

# Проверяем структуру URL
WEBHOOK_PATH=$(echo "$WEBHOOK_URL" | sed 's|https://[^/]*||')
echo "📋 Путь webhook: $WEBHOOK_PATH"
echo ""

# Проверяем что это Production URL (не test)
if echo "$WEBHOOK_PATH" | grep -q "webhook-test"; then
    echo "⚠️  ВНИМАНИЕ: Используется TEST URL!"
    echo "   Test URL работает только после нажатия 'Execute workflow'"
    echo "   Нужен Production URL из вкладки 'Production URL' в n8n"
    echo ""
fi

# Проверяем путь
if echo "$WEBHOOK_PATH" | grep -q "^/webhook/"; then
    echo "✅ Путь начинается с /webhook/ - выглядит правильно"
else
    echo "⚠️  Путь не начинается с /webhook/ - возможно неправильный URL"
fi

echo ""
echo "💡 В n8n:"
echo "   1. Откройте Webhook node"
echo "   2. Перейдите на вкладку 'Production URL'"
echo "   3. Скопируйте точный URL оттуда"
echo "   4. Убедитесь что он отличается от Test URL"


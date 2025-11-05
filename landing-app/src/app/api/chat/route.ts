import { NextResponse } from "next/server";
import { appendChatLog } from "@/lib/log-service";
import { LRUCache } from "@/lib/lru-cache";

type ChatHistoryItem = {
  role: "user" | "agent";
  content: string;
};

const FALLBACK_REPLY =
  "ИИ‑бот сейчас перегружен. Попробуйте отправить запрос ещё раз через минуту.";

type RateState = {
  count: number;
  windowStart: number;
};

// Используем LRU cache для предотвращения утечек памяти
const rateLimitStore = new LRUCache<string, RateState>(
  Number(process.env.RATE_LIMIT_MAX_STORE_SIZE ?? 10000)
);
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_SEC ?? 3600) * 1000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 20);

let cleanupCounter = 0;

function isRateLimited(clientId: string) {
  const now = Date.now();
  
  // Периодическая очистка старых записей при каждом 100-м запросе
  cleanupCounter++;
  if (cleanupCounter % 100 === 0) {
    const cleaned = rateLimitStore.cleanupOlderThan(WINDOW_MS);
    if (cleaned > 0) {
      console.log(`[RateLimit] Очищено ${cleaned} устаревших записей`);
    }
  }

  const state = rateLimitStore.get(clientId);

  if (!state || now - state.windowStart > WINDOW_MS) {
    // Новое окно - сбрасываем счетчик
    rateLimitStore.set(clientId, { count: 1, windowStart: now });
    return false;
  }

  if (state.count >= MAX_REQUESTS) {
    return true;
  }

  // Увеличиваем счетчик и обновляем запись
  state.count += 1;
  rateLimitStore.set(clientId, state);
  return false;
}

export async function POST(request: Request) {
  const receivedAt = new Date();

  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[API] JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      console.error("[API] Invalid body type:", typeof body);
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const clientId = String(body?.clientId ?? "").trim();
    // Санитизация сообщения - удаляем потенциально опасные символы
    let message = String(body?.message ?? "").trim();
    // Ограничиваем длину и удаляем управляющие символы
    message = message.slice(0, 2000).replace(/[\x00-\x1F\x7F]/g, '');
    const history: ChatHistoryItem[] = Array.isArray(body?.history)
      ? (body.history as ChatHistoryItem[])
          .filter((item: ChatHistoryItem) => item && item.content && item.role)
          .map((item: ChatHistoryItem) => ({
            role: item.role === "agent" ? "agent" : "user",
            content: String(item.content).slice(0, 4000),
          }))
      : [];
    const meta = typeof body?.meta === "object" && body?.meta ? body.meta : undefined;
    const isInitial = meta?.isInitial === true;

    if (!clientId || clientId.length === 0) {
      console.error("[API] Missing or empty clientId:", { body: JSON.stringify(body).slice(0, 200) });
      return NextResponse.json(
        { error: "clientId is required and cannot be empty" },
        { status: 400 }
      );
    }

    // Разрешаем пустое сообщение только для инициализации
    if (!isInitial && !message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    if (isRateLimited(clientId)) {
      await appendChatLog({
        timestamp: new Date().toISOString(),
        clientId,
        direction: "agent",
        message: FALLBACK_REPLY,
        status: "error",
        meta: { reason: "rate_limit" },
      });
      return NextResponse.json(
        {
          reply: FALLBACK_REPLY,
          status: "error",
          reason: "rate_limit",
        },
        { status: 429 }
      );
    }

    console.log(`[API] Получено сообщение от ${clientId}:`, { messageLength: message.length, hasHistory: history.length > 0, isInitial });
    // Логируем только если это не инициализация или есть текст сообщения
    if (!isInitial || message) {
      await appendChatLog({
        timestamp: receivedAt.toISOString(),
        clientId,
        direction: "user",
        message: message || "[initial request]",
        status: "ok",
        meta,
      });
    }

    // Используем polling вместо webhook (только если явно включен)
    const usePolling = process.env.USE_POLLING === "true";
    
    if (usePolling) {
      // Добавляем в очередь
      const queueResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/chat/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          message,
          history,
          meta: { ...meta, receivedAt: receivedAt.toISOString() },
        }),
      });

      if (!queueResponse.ok) {
        console.error("[API] Ошибка добавления в очередь");
        return NextResponse.json(
          {
            reply: FALLBACK_REPLY,
            status: "error",
          },
          { status: 200 }
        );
      }

      const queueData = await queueResponse.json();
      const messageId = queueData.id;

      // Polling результата (максимум 30 секунд)
      const maxWaitTime = 30000;
      const pollInterval = 500; // 500ms
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const resultResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/chat/result?messageId=${messageId}`
        );

        if (resultResponse.ok) {
          const result = await resultResponse.json();
          
          await appendChatLog({
            timestamp: new Date().toISOString(),
            clientId,
            direction: "agent",
            message: result.reply,
            latencyMs: result.latencyMs || Date.now() - startTime,
            status: result.status || "ok",
            meta: { ...meta, messageId, source: "polling" },
          });

          return NextResponse.json({
            reply: result.reply,
            latencyMs: result.latencyMs || Date.now() - startTime,
            status: result.status || "ok",
          });
        }
      }

      // Таймаут
      return NextResponse.json(
        {
          reply: "ИИ‑бот слишком долго думает. Попробуйте ещё раз.",
          latencyMs: maxWaitTime,
          status: "error",
        },
        { status: 200 }
      );
    }

    // Старый способ через webhook (если USE_POLLING=false и есть N8N_WEBHOOK_URL)
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.N8N_SECRET;

    if (!webhookUrl) {
      console.error("[API] N8N_WEBHOOK_URL не настроен");
      await appendChatLog({
        timestamp: new Date().toISOString(),
        clientId,
        direction: "agent",
        message: FALLBACK_REPLY,
        status: "fallback",
        meta: { reason: "webhook_url_missing" },
      });
      return NextResponse.json(
        {
          reply: FALLBACK_REPLY,
          latencyMs: 0,
          status: "fallback",
        },
        { status: 200 }
      );
    }

    // Валидация URL
    try {
      new URL(webhookUrl);
    } catch {
      console.error("[API] Некорректный N8N_WEBHOOK_URL:", webhookUrl);
      await appendChatLog({
        timestamp: new Date().toISOString(),
        clientId,
        direction: "agent",
        message: FALLBACK_REPLY,
        status: "fallback",
        meta: { reason: "invalid_webhook_url" },
      });
      return NextResponse.json(
        {
          reply: FALLBACK_REPLY,
          latencyMs: 0,
          status: "fallback",
        },
        { status: 200 }
      );
    }

    const startedAt = Date.now();
    const timeoutMs = Number(process.env.CHAT_TIMEOUT_MS ?? 25000);

    // Подготовка данных для отправки в n8n
    // n8n AI Agent ожидает один объект input, поэтому оборачиваем все в один ключ
    const n8nPayload = {
      data: {
        clientId,
        message,
        history,
        meta,
        receivedAt: receivedAt.toISOString(),
      }
    };

    console.log(`[API] Отправка запроса в n8n для ${clientId}:`, {
      webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'), // Скрываем секретную часть URL
      messageLength: message.length,
      historyLength: history.length,
      isInitial,
      hasSecret: !!secret,
      payload: JSON.stringify(n8nPayload).slice(0, 200), // Первые 200 символов payload для отладки
    });

    let replyText = FALLBACK_REPLY;
    let status: "ok" | "fallback" | "error" = "fallback";
    let n8nResponseStatus: number | null = null;
    let n8nError: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      console.log(`[API] 🔍 Детальный запрос к n8n для ${clientId}:`, {
        url: webhookUrl.replace(/\/[^\/]*$/, '/***'),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-n8n-secret": "***" } : {}),
        },
        payloadSize: JSON.stringify(n8nPayload).length,
        payloadPreview: JSON.stringify(n8nPayload).slice(0, 100),
      });

      const fetchStartTime = Date.now();
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-n8n-secret": secret } : {}),
        },
        body: JSON.stringify(n8nPayload),
        signal: controller.signal,
      });

      const fetchTime = Date.now() - fetchStartTime;
      clearTimeout(timeoutId);
      n8nResponseStatus = response.status;
      
      console.log(`[API] 📥 Ответ от n8n для ${clientId}:`, {
        status: response.status,
        statusText: response.statusText,
        fetchTime: `${fetchTime}ms`,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[API] n8n webhook вернул ошибку ${response.status}:`, errorBody.slice(0, 500));
        
        // Извлекаем сообщение об ошибке из ответа n8n
        let errorMessage = `Ошибка n8n (статус ${response.status})`;
        try {
          const errorData = JSON.parse(errorBody);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Если не удалось распарсить, используем дефолтное сообщение
        }
        
        // Для 404 и 500 возвращаем понятное сообщение
        if (response.status === 404) {
          // Проверяем есть ли в сообщении подсказка про активацию
          if (errorMessage.includes("must be active") || errorMessage.includes("not registered")) {
            replyText = `ИИ‑бот не настроен: Workflow не активирован в n8n. Включите переключатель "Active" в правом верхнем углу редактора n8n.`;
          } else {
            replyText = `ИИ‑бот не настроен: Workflow не найден в n8n. Проверьте URL webhook.`;
          }
        } else if (response.status === 500) {
          replyText = `ИИ‑бот временно недоступен: ${errorMessage}. Проверьте настройки workflow в n8n.`;
        } else {
          replyText = `ИИ‑бот вернул ошибку: ${errorMessage}. Обратитесь к администратору.`;
        }
        
        status = "error";
        n8nResponseStatus = response.status;
        n8nError = errorMessage;
        
        // Пропускаем обработку ответа и переходим к логированию
      } else {
        // Обрабатываем успешный ответ только если response.ok = true
        const data = await response.json().catch((parseError) => {
          const text = response.text().catch(() => '');
          console.error("[API] Ошибка парсинга ответа от n8n:", parseError);
          return { _parseError: true, _rawResponse: text };
        });

        // Обработка разных форматов ответов от n8n
        if (data._parseError) {
          console.error("[API] n8n вернул не-JSON ответ:", data._rawResponse?.slice(0, 200));
          replyText = FALLBACK_REPLY;
          status = "fallback";
        } else {
          // Функция для проверки, что строка не является необработанным шаблоном n8n
          const isValidReply = (value: string): boolean => {
            if (!value || typeof value !== "string") return false;
            // Проверяем, что это не шаблон n8n (необработанный)
            if (value.includes("{{") && value.includes("}}")) {
              return false;
            }
            // Проверяем, что это не пустая строка после trim
            return value.trim().length > 0;
          };

          // Пробуем разные поля в ответе
          const rawReply = 
            typeof data?.reply === "string" ? data.reply
            : typeof data?.answer === "string" ? data.answer
            : typeof data?.text === "string" ? data.text
            : typeof data?.message === "string" ? data.message
            : null;

          // Проверяем, что ответ валиден и не является шаблоном
          if (rawReply && isValidReply(rawReply)) {
            replyText = rawReply;
            status = "ok";
          } else {
            // Если ответ содержит шаблон или невалиден, это ошибка конфигурации n8n
            console.error(`[API] n8n вернул необработанный шаблон или пустой ответ для ${clientId}:`, {
              rawReply,
              responseKeys: Object.keys(data || {}),
              fullData: JSON.stringify(data).slice(0, 500),
            });
            replyText = "Ошибка конфигурации n8n: ответ содержит необработанный шаблон. Проверьте настройки 'Respond to Webhook' node.";
            status = "error";
          }

          console.log(`[API] Получен ответ от n8n для ${clientId}:`, {
            status: response.status,
            replyLength: replyText.length,
            isValid: status === "ok",
            rawReply: rawReply?.slice(0, 100),
            hasReply: !!data?.reply,
            hasAnswer: !!data?.answer,
            hasText: !!data?.text,
            hasMessage: !!data?.message,
            responseKeys: Object.keys(data || {}),
          });
        }
      }
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === "AbortError";
      
      n8nError = error instanceof Error ? error.message : String(error);
      
      console.error(`[API] Ошибка при вызове n8n webhook для ${clientId}:`, {
        error: n8nError,
        isAbortError,
        webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
      });

      // AbortError может быть как таймаутом, так и отменой запроса
      // В данном случае таймаут устанавливается через setTimeout, поэтому считаем это таймаутом
      status = "error";
      replyText = isAbortError 
        ? "ИИ‑бот слишком долго думает. Попробуйте ещё раз или переформулируйте вопрос."
        : FALLBACK_REPLY;
    }

    const latencyMs = Date.now() - startedAt;

    console.log(`[API] Отправка ответа для ${clientId}:`, {
      status,
      latencyMs,
      replyLength: replyText.length,
      n8nResponseStatus,
      n8nError: n8nError ? n8nError.slice(0, 100) : null,
    });

    await appendChatLog({
      timestamp: new Date().toISOString(),
      clientId,
      direction: "agent",
      message: replyText,
      latencyMs,
      status,
      meta: {
        ...meta,
        n8nResponseStatus,
        n8nError: n8nError ? n8nError.slice(0, 200) : undefined,
      },
    });

    return NextResponse.json(
      {
        reply: replyText,
        latencyMs,
        status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("chat endpoint error", error);
    return NextResponse.json(
      { error: "invalid request" },
      { status: 400 }
    );
  }
}


import { NextResponse } from "next/server";
import { appendChatLog } from "@/lib/log-service";
import { LRUCache } from "@/lib/lru-cache";
import { N8NClient } from "@/lib/n8n-client";
import { z } from "zod";

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
    // Таймаут 1.5 минуты (90 секунд) для всех запросов
    const timeoutMs = Number(process.env.CHAT_TIMEOUT_MS ?? 90000);

    // Валидация payload перед отправкой в n8n
    const n8nPayloadSchema = z.object({
      clientId: z.string().min(1),
      message: z.string().max(2000),
      history: z.array(z.object({
        role: z.enum(['user', 'agent']),
        content: z.string().max(4000),
      })).max(10),
      meta: z.record(z.string(), z.unknown()).optional(),
      receivedAt: z.string().datetime(),
    });

    let validatedPayload;
    try {
      validatedPayload = n8nPayloadSchema.parse({
        clientId,
        message,
        history,
        meta,
        receivedAt: receivedAt.toISOString(),
      });
    } catch (validationError) {
      console.error("[API] Ошибка валидации payload:", validationError);
      await appendChatLog({
        timestamp: new Date().toISOString(),
        clientId,
        direction: "agent",
        message: FALLBACK_REPLY,
        status: "error",
        meta: { reason: "validation_error", error: validationError instanceof Error ? validationError.message : String(validationError) },
      });
      return NextResponse.json(
        {
          reply: FALLBACK_REPLY,
          latencyMs: 0,
          status: "error",
        },
        { status: 200 }
      );
    }

    // Генерируем requestId для трейсинга
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const n8nPayload = {
      ...validatedPayload,
      requestId,
    };

    console.log(`[API] Отправка запроса в n8n для ${clientId}:`, {
      requestId,
      webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
      messageLength: message.length,
      historyLength: history.length,
      isInitial,
      hasSecret: !!secret,
    });

    // Создаем клиент n8n
    const n8nClient = new N8NClient(webhookUrl, secret, timeoutMs);
    
    // Проверяем состояние circuit breaker перед запросом
    const circuitBreakerState = n8nClient.getCircuitBreakerState();
    if (circuitBreakerState === 'open') {
      console.warn(`[API] Circuit breaker открыт для ${clientId}. Пропускаем запрос к n8n.`);
      await appendChatLog({
        timestamp: new Date().toISOString(),
        clientId,
        direction: "agent",
        message: isInitial 
          ? "ИИ‑бот временно недоступен. Попробуйте открыть чат через минуту."
          : "ИИ‑бот временно недоступен. Попробуйте позже.",
        status: "error",
        meta: { ...meta, requestId, reason: "circuit_breaker_open", circuitBreakerState },
      }).catch(() => {});
      
      return NextResponse.json({
        reply: isInitial 
          ? "ИИ‑бот временно недоступен. Попробуйте открыть чат через минуту."
          : "ИИ‑бот временно недоступен. Попробуйте позже.",
        latencyMs: 0,
        status: "error",
        reason: "circuit_breaker_open",
        circuitBreakerState: circuitBreakerState,
      }, { status: 200 });
    }

    let replyText = FALLBACK_REPLY;
    let status: "ok" | "fallback" | "error" = "fallback";
    let n8nResponseStatus: number | null = null;
    let n8nError: string | null = null;

    try {
      console.log(`[API] Отправка запроса к n8n для ${clientId} (isInitial: ${isInitial}):`, {
        requestId,
        webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
        circuitBreakerState,
      });
      
      const result = await n8nClient.sendMessage(n8nPayload);
      replyText = result.reply;
      status = result.status;
      n8nResponseStatus = 200;
      
      console.log(`[API] Успешный ответ от n8n для ${clientId}:`, {
        requestId,
        replyLength: replyText.length,
        status,
      });
    } catch (error) {
      n8nError = error instanceof Error ? error.message : String(error);
      
      console.error(`[API] Ошибка при вызове n8n webhook для ${clientId}:`, {
        error: n8nError,
        requestId,
        webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
        circuitBreakerState: n8nClient.getCircuitBreakerState(),
      });

      status = "error";

      // Формируем понятное сообщение об ошибке
      // Для инициализации показываем более дружелюбное сообщение
      if (n8nError.includes("Circuit breaker is open") || n8nError.includes("circuit breaker открыт")) {
        replyText = isInitial 
          ? "ИИ‑бот временно недоступен. Попробуйте открыть чат через минуту."
          : "ИИ‑бот временно недоступен. Попробуйте позже.";
      } else if (n8nError.includes("timeout") || n8nError.includes("AbortError")) {
        replyText = isInitial
          ? "ИИ‑бот не отвечает. Попробуйте открыть чат через минуту."
          : "ИИ‑бот слишком долго думает. Попробуйте ещё раз или переформулируйте вопрос.";
      } else if (n8nError.includes("Payload too large")) {
        replyText = "Сообщение слишком большое. Попробуйте сократить текст или историю сообщений.";
        n8nResponseStatus = 413;
      } else if (n8nError.includes("404") || n8nError.includes("not found") || n8nError.includes("не найден")) {
        replyText = isInitial
          ? "ИИ‑бот временно недоступен. Обратитесь к администратору."
          : "ИИ‑бот не настроен: Workflow не найден в n8n. Проверьте URL webhook.";
        n8nResponseStatus = 404;
      } else if (n8nError.includes("500") || n8nError.includes("server error")) {
        replyText = isInitial
          ? "ИИ‑бот временно недоступен. Попробуйте открыть чат через минуту."
          : "ИИ‑бот временно недоступен. Проверьте настройки workflow в n8n.";
        n8nResponseStatus = 500;
      } else {
        // Для неизвестных ошибок при инициализации показываем более дружелюбное сообщение
        replyText = isInitial
          ? "ИИ‑бот временно недоступен. Попробуйте открыть чат через минуту."
          : FALLBACK_REPLY;
      }
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
        requestId,
        n8nResponseStatus,
        n8nError: n8nError ? n8nError.slice(0, 200) : undefined,
      },
    }).catch((error) => {
      console.error('[API] Ошибка логирования (не критично):', error);
      // Не прерываем выполнение при ошибке логирования
    });

    return NextResponse.json(
      {
        reply: replyText,
        latencyMs,
        status,
        ...(n8nError ? { error: n8nError.slice(0, 200) } : {}),
        ...(n8nResponseStatus ? { n8nStatus: n8nResponseStatus } : {}),
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


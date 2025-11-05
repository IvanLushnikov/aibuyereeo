import { NextResponse } from "next/server";
import { appendChatLog } from "@/lib/log-service";

type ChatHistoryItem = {
  role: "user" | "agent";
  content: string;
};

const FALLBACK_REPLY =
  "ИИ-бот сейчас перегружен. Попробуйте отправить запрос ещё раз через минуту.";

type RateState = {
  count: number;
  windowStart: number;
};

const rateLimitStore = new Map<string, RateState>();
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_SEC ?? 3600) * 1000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 20);
const MAX_STORE_SIZE = Number(process.env.RATE_LIMIT_MAX_STORE_SIZE ?? 10000); // Ограничение размера Map
const CLEANUP_INTERVAL_MS = 3600000; // 1 час

// Очистка старых записей rate limit для предотвращения утечек памяти
function cleanupRateLimitStore() {
  const now = Date.now();
  const entriesToDelete: string[] = [];
  
  for (const [clientId, state] of rateLimitStore.entries()) {
    if (now - state.windowStart > WINDOW_MS) {
      entriesToDelete.push(clientId);
    }
  }
  
  // Удаляем устаревшие записи
  for (const clientId of entriesToDelete) {
    rateLimitStore.delete(clientId);
  }
  
  // Если размер все еще превышает лимит, удаляем самые старые записи
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const sortedEntries = Array.from(rateLimitStore.entries())
      .sort((a, b) => a[1].windowStart - b[1].windowStart);
    
    const toRemove = sortedEntries.slice(0, rateLimitStore.size - MAX_STORE_SIZE);
    for (const [clientId] of toRemove) {
      rateLimitStore.delete(clientId);
    }
  }
}

// Ленивая инициализация интервала очистки (для serverless)
let cleanupInterval: NodeJS.Timeout | null = null;
let cleanupCounter = 0;

function ensureCleanupInterval() {
  // В serverless окружении не запускаем интервал на уровне модуля
  // Используем только периодическую очистку при запросах
  if (typeof process !== 'undefined' && process.env.VERCEL) {
    // В Vercel/serverless не используем глобальный интервал
    return;
  }
  
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      cleanupRateLimitStore();
    }, CLEANUP_INTERVAL_MS);
  }
}

// Инициализируем интервал только если не в serverless
if (typeof process !== 'undefined' && !process.env.VERCEL) {
  ensureCleanupInterval();
}

function isRateLimited(clientId: string) {
  const now = Date.now();
  
  // Периодическая очистка при каждом 100-м запросе
  cleanupCounter++;
  if (cleanupCounter % 100 === 0) {
    cleanupRateLimitStore();
  }
  
  // Если хранилище переполнено, сначала очищаем
  if (rateLimitStore.size >= MAX_STORE_SIZE) {
    cleanupRateLimitStore();
  }

  const state = rateLimitStore.get(clientId);

  if (!state || now - state.windowStart > WINDOW_MS) {
    // Проверяем размер перед добавлением новой записи
    if (rateLimitStore.size >= MAX_STORE_SIZE) {
      cleanupRateLimitStore();
    }
    rateLimitStore.set(clientId, { count: 1, windowStart: now });
    return false;
  }

  if (state.count >= MAX_REQUESTS) {
    return true;
  }

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
    const n8nPayload = {
      clientId,
      message,
      history,
      meta,
      receivedAt: receivedAt.toISOString(),
    };

    console.log(`[API] Отправка запроса в n8n для ${clientId}:`, {
      webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'), // Скрываем секретную часть URL
      messageLength: message.length,
      historyLength: history.length,
      isInitial,
      hasSecret: !!secret,
    });

    let replyText = FALLBACK_REPLY;
    let status: "ok" | "fallback" | "error" = "fallback";
    let n8nResponseStatus: number | null = null;
    let n8nError: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-n8n-secret": secret } : {}),
        },
        body: JSON.stringify(n8nPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      n8nResponseStatus = response.status;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[API] n8n webhook вернул ошибку ${response.status}:`, errorBody.slice(0, 500));
        throw new Error(`n8n webhook failed with status ${response.status}: ${errorBody.slice(0, 200)}`);
      }

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
        // Пробуем разные поля в ответе
        replyText =
          typeof data?.reply === "string" && data.reply.trim()
            ? data.reply
            : typeof data?.answer === "string" && data.answer.trim()
              ? data.answer
              : typeof data?.text === "string" && data.text.trim()
                ? data.text
                : typeof data?.message === "string" && data.message.trim()
                  ? data.message
                  : FALLBACK_REPLY;

        status = replyText === FALLBACK_REPLY ? "fallback" : "ok";

        console.log(`[API] Получен ответ от n8n для ${clientId}:`, {
          status: response.status,
          replyLength: replyText.length,
          hasReply: !!data?.reply,
          hasAnswer: !!data?.answer,
          hasText: !!data?.text,
          hasMessage: !!data?.message,
          responseKeys: Object.keys(data || {}),
        });
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
        ? "ИИ-бот слишком долго думает. Попробуйте ещё раз или переформулируйте вопрос."
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


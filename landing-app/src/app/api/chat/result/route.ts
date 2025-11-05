import { NextResponse } from "next/server";
import { appendChatLog } from "@/lib/log-service";

type ResultData = {
  reply: string;
  status: string;
  latencyMs: number;
  clientId?: string;
  receivedAt?: string;
  createdAt: number; // Время создания для очистки
};

// Хранилище результатов (в продакшене использовать Redis/БД)
// Используем Map с ограничением размера и очисткой по времени
const MAX_RESULTS_SIZE = Number(process.env.MAX_RESULTS_SIZE ?? 10000);
const CLEANUP_INTERVAL_MS = 3600000; // 1 час
const results = new Map<string, ResultData>();

// Счетчик запросов для периодической очистки
let requestCounter = 0;
const CLEANUP_INTERVAL_REQUESTS = 100; // Очистка каждые 100 запросов

// Функция очистки старых результатов
function cleanupOldResults() {
  const hourAgo = Date.now() - CLEANUP_INTERVAL_MS;
  let cleaned = 0;
  
  for (const [id, result] of results.entries()) {
    if (result.createdAt < hourAgo) {
      results.delete(id);
      cleaned++;
    }
  }
  
  // Если размер все еще превышает лимит, удаляем самые старые записи
  if (results.size > MAX_RESULTS_SIZE) {
    const entries = Array.from(results.entries());
    entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toRemove = results.size - MAX_RESULTS_SIZE;
    for (let i = 0; i < toRemove && entries.length > 0; i++) {
      results.delete(entries[i][0]);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Results] Очищено ${cleaned} старых результатов. Размер: ${results.size}/${MAX_RESULTS_SIZE}`);
  }
  
  return cleaned;
}

export async function POST(request: Request) {
  // n8n отправляет результат обработки
  const body = await request.json().catch(() => ({}));
  
  const { messageId, reply, status = "ok", latencyMs = 0, clientId, receivedAt } = body;

  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  if (!reply) {
    return NextResponse.json({ error: "reply required" }, { status: 400 });
  }

  // Периодическая очистка старых результатов
  requestCounter++;
  if (requestCounter % CLEANUP_INTERVAL_REQUESTS === 0) {
    cleanupOldResults();
  }

  // Ограничение размера хранилища
  if (results.size >= MAX_RESULTS_SIZE) {
    // Удаляем самую старую запись
    const oldestEntry = Array.from(results.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldestEntry) {
      results.delete(oldestEntry[0]);
    }
  }

  results.set(messageId, { 
    reply, 
    status, 
    latencyMs, 
    clientId, 
    receivedAt,
    createdAt: Date.now()
  });

  // Логируем ответ
  if (clientId) {
    await appendChatLog({
      timestamp: receivedAt || new Date().toISOString(),
      clientId,
      direction: "agent",
      message: reply,
      latencyMs,
      status,
      meta: { source: "polling", messageId },
    }).catch(() => {}); // Не прерываем работу при ошибке логирования
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  // Получение результата по messageId
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId");

  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  const result = results.get(messageId);
  
  if (!result) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  // Проверяем срок действия результата (lazy cleanup)
  const hourAgo = Date.now() - CLEANUP_INTERVAL_MS;
  if (result.createdAt < hourAgo) {
    results.delete(messageId);
    return NextResponse.json({ error: "Result expired" }, { status: 404 });
  }

  // Периодическая очистка при GET запросах
  requestCounter++;
  if (requestCounter % CLEANUP_INTERVAL_REQUESTS === 0) {
    cleanupOldResults();
  }

  // Возвращаем результат без служебного поля createdAt
  const { createdAt, ...resultData } = result;
  return NextResponse.json(resultData);
}


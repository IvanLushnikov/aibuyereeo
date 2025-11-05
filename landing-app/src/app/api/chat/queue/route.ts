import { NextResponse } from "next/server";

// Хранилище очереди (в продакшене использовать Redis/БД)
type QueueItem = {
  id: string;
  clientId: string;
  message: string;
  history: any[];
  meta: any;
  receivedAt: string;
  processed: boolean;
  processingStarted?: number;
};

const messageQueue: QueueItem[] = [];
const MAX_QUEUE_SIZE = 1000;
const PROCESSING_TIMEOUT = 60000; // 60 секунд

// Очистка старых и зависших задач
function cleanupQueue() {
  const now = Date.now();
  // Удаляем обработанные старше 1 часа
  const hourAgo = now - 3600000;
  let i = messageQueue.length;
  while (i--) {
    const item = messageQueue[i];
    if (item.processed && new Date(item.receivedAt).getTime() < hourAgo) {
      messageQueue.splice(i, 1);
    }
    // Возвращаем зависшие задачи (обрабатываются > 60 сек)
    if (item.processingStarted && (now - item.processingStarted) > PROCESSING_TIMEOUT) {
      item.processed = false;
      item.processingStarted = undefined;
    }
  }
}

export async function GET() {
  cleanupQueue();
  
  // n8n запрашивает необработанные сообщения
  const pending = messageQueue.filter((m) => !m.processed).slice(0, 10); // Максимум 10 за раз
  
  if (pending.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  const now = Date.now();
  // Помечаем как обрабатываемые и записываем время начала
  pending.forEach((m) => {
    m.processed = true;
    m.processingStarted = now;
  });

  return NextResponse.json({ 
    messages: pending.map(({ processingStarted, ...item }) => item) // Убираем processingStarted из ответа
  });
}

export async function POST(request: Request) {
  // Добавление сообщения в очередь
  const body = await request.json().catch(() => ({}));
  
  const queueItem: QueueItem = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    clientId: body.clientId || "unknown",
    message: body.message || "",
    history: body.history || [],
    meta: body.meta || {},
    receivedAt: body.meta?.receivedAt || new Date().toISOString(),
    processed: false,
  };

  messageQueue.push(queueItem);
  
  // Ограничиваем размер очереди
  if (messageQueue.length > MAX_QUEUE_SIZE) {
    messageQueue.shift();
  }

  return NextResponse.json({ 
    id: queueItem.id,
    queued: true,
    position: messageQueue.length,
    estimatedWait: Math.ceil(messageQueue.filter(m => !m.processed).length * 5) // примерное время ожидания в секундах
  });
}


import { NextResponse } from "next/server";

// Хранилище очереди (в продакшене использовать Redis/БД)
// Simple Memory в n8n хранит историю по clientId, поэтому history не передаем
type QueueItem = {
  id: string;
  clientId: string;
  message: string;
  meta: any;
  receivedAt: string;
  processing: boolean; // Изменено: вместо processed используем processing для отслеживания статуса
  processingStarted?: number;
  retryCount: number; // Добавлено: счетчик попыток обработки
};

// Используем Map для предотвращения утечек памяти и более эффективной работы
const messageQueue = new Map<string, QueueItem>();
const MAX_QUEUE_SIZE = 1000;
const PROCESSING_TIMEOUT = 180000; // 180 секунд
const MAX_RETRIES = 3; // Максимум 3 попытки обработки

// Очистка старых и зависших задач
function cleanupQueue() {
  const now = Date.now();
  const hourAgo = now - 3600000;
  const keysToDelete: string[] = [];
  
  for (const [id, item] of messageQueue.entries()) {
    const receivedTime = new Date(item.receivedAt).getTime();
    
    // Удаляем старые обработанные сообщения (старше 1 часа)
    if (!item.processing && receivedTime < hourAgo) {
      keysToDelete.push(id);
      continue;
    }
    
    // Возвращаем зависшие задачи (обрабатываются > 60 сек)
    // ИЛИ если превышен лимит попыток
    if (item.processing) {
      if (item.processingStarted && (now - item.processingStarted) > PROCESSING_TIMEOUT) {
        if (item.retryCount >= MAX_RETRIES) {
          // Превышен лимит попыток - удаляем сообщение
          keysToDelete.push(id);
          console.warn(`[Queue] Удалено сообщение ${id} после ${item.retryCount} неудачных попыток`);
        } else {
          // Возвращаем в очередь для повторной обработки
          item.processing = false;
          item.processingStarted = undefined;
          item.retryCount += 1;
          console.log(`[Queue] Возвращено сообщение ${id} в очередь (попытка ${item.retryCount + 1})`);
        }
      }
    }
  }
  
  // Удаляем помеченные элементы
  for (const id of keysToDelete) {
    messageQueue.delete(id);
  }
  
  // Если размер все еще превышает лимит, удаляем самые старые записи
  if (messageQueue.size > MAX_QUEUE_SIZE) {
    const entries = Array.from(messageQueue.entries());
    entries.sort((a, b) => 
      new Date(a[1].receivedAt).getTime() - new Date(b[1].receivedAt).getTime()
    );
    const toRemove = messageQueue.size - MAX_QUEUE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      messageQueue.delete(entries[i][0]);
    }
  }
  
  return keysToDelete.length;
}

export async function GET() {
  const cleaned = cleanupQueue();
  if (cleaned > 0) {
    console.log(`[Queue] Очищено ${cleaned} старых записей. Размер очереди: ${messageQueue.size}`);
  }
  
  // n8n запрашивает необработанные сообщения (не в процессе обработки)
  const pending = Array.from(messageQueue.values())
    .filter((m) => !m.processing)
    .slice(0, 10); // Максимум 10 за раз
  
  if (pending.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  const now = Date.now();
  // Помечаем как обрабатываемые (НО НЕ processed!) - это важно для предотвращения race condition
  // processed = true будет установлено только после успешной обработки в POST /api/chat/result
  pending.forEach((m) => {
    m.processing = true;
    m.processingStarted = now;
  });

  return NextResponse.json({ 
    messages: pending.map(({ processing, processingStarted, retryCount, ...item }) => item) // Убираем служебные поля из ответа
  });
}

export async function POST(request: Request) {
  // Добавление сообщения в очередь
  const body = await request.json().catch(() => ({}));
  
  // Автоматическая очистка при добавлении
  cleanupQueue();
  
  const queueItem: QueueItem = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    clientId: body.clientId || "unknown",
    message: body.message || "",
    meta: body.meta || {},
    receivedAt: body.meta?.receivedAt || new Date().toISOString(),
    processing: false,
    retryCount: 0,
  };

  messageQueue.set(queueItem.id, queueItem);

  // Ограничиваем размер очереди (уже обработано в cleanupQueue)
  const pendingCount = Array.from(messageQueue.values()).filter(m => !m.processing).length;

  return NextResponse.json({ 
    id: queueItem.id,
    queued: true,
    position: messageQueue.size,
    estimatedWait: Math.ceil(pendingCount * 5) // примерное время ожидания в секундах
  });
}


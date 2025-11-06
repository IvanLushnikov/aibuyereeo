import { mkdir, stat, writeFile, appendFile } from "fs/promises";
import path from "node:path";
import { initLogs } from "./init-logs";

type LogType = "chat" | "events";

// Инициализируем логи при импорте (только в Node.js)
if (typeof window === "undefined") {
  initLogs()
    .then((dir) => {
      if (dir) {
        console.log(`[LOG] Инициализация завершена. Используется: ${dir}`);
      }
    })
    .catch((error) => {
      console.error("[LOG] Ошибка инициализации логов:", error);
    });
}

// Функция для получения пути к логам (использует результат инициализации)
function getLogsRoot(): string {
  return process.env.LOGS_ROOT ?? path.join(process.cwd(), "logs");
}

const LOGS_ROOT = getLogsRoot();

// Выводим путь к логам при первом импорте
console.log(`[LOG] Путь к логам: ${LOGS_ROOT}`);

const ensureDirCache = new Set<string>();

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (ensureDirCache.has(dir)) return;
  try {
    await stat(dir);
    ensureDirCache.add(dir);
    return;
  } catch {
    // Папка не существует, пытаемся создать
    try {
      await mkdir(dir, { recursive: true });
      ensureDirCache.add(dir);
    } catch (mkdirError) {
      // Если не удалось создать (нет прав доступа), используем fallback
      const error = mkdirError as Error & { code?: string };
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.warn(`[LOG] Нет прав доступа к ${dir}, используем fallback`);
        // Не добавляем в кэш, чтобы не пытаться использовать эту папку снова
        throw mkdirError;
      }
      throw mkdirError;
    }
  }
}

function getFilePath(type: LogType, date = new Date()) {
  const logsRoot = getLogsRoot(); // Используем динамическое получение пути
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const dir = path.join(logsRoot, String(year), month);
  return path.join(dir, `${type}-${year}-${month}-${day}.csv`);
}

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function composeLine(values: Array<string | number | boolean | null | undefined>) {
  return values.map(toCsvValue).join(",") + "\n";
}

export async function appendChatLog(args: {
  timestamp: string;
  clientId: string;
  direction: "user" | "agent";
  message: string;
  latencyMs?: number;
  status: "ok" | "error" | "fallback";
  meta?: Record<string, unknown>;
}) {
  try {
    const filePath = getFilePath("chat", new Date(args.timestamp));
    await ensureDir(filePath);
    const line = composeLine([
      args.timestamp,
      args.clientId,
      args.direction,
      args.message,
      args.latencyMs ?? "",
      args.status,
      args.meta ? JSON.stringify(args.meta) : "",
    ]);
    await appendFile(filePath, line, { encoding: "utf-8" });
    console.log(`[LOG] Записано в ${filePath}:`, {
      timestamp: args.timestamp,
      clientId: args.clientId,
      direction: args.direction,
      status: args.status,
      messageLength: args.message.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Логируем ошибку, но не слишком громко
    if (errorMsg.includes('EACCES') || errorMsg.includes('permission denied')) {
      if (!ensureDirCache.has('_permission_error_logged')) {
        console.warn(`[LOG] Нет прав доступа для записи логов в ${getLogsRoot()}. События не будут сохраняться в файлы, но будут доступны в консоли Render.`);
        ensureDirCache.add('_permission_error_logged');
      }
    } else {
      console.error(`[LOG] Ошибка записи chat log:`, errorMsg);
    }
    // Не прерываем выполнение при ошибке логирования
    // Всегда логируем в консоль для Render Dashboard
    console.log(`[CHAT] ${args.direction}`, {
      timestamp: args.timestamp,
      clientId: args.clientId.slice(0, 8),
      status: args.status,
      messageLength: args.message.length,
      latencyMs: args.latencyMs,
    });
  }
}

export async function appendEventLog(args: {
  timestamp: string;
  clientId?: string;
  sessionId?: string;
  event: string;
  payload?: Record<string, unknown>;
}) {
  try {
    const filePath = getFilePath("events", new Date(args.timestamp));
    await ensureDir(filePath);
    const line = composeLine([
      args.timestamp,
      args.clientId ?? "",
      args.sessionId ?? "",
      args.event,
      args.payload ? JSON.stringify(args.payload) : "",
    ]);
    await appendFile(filePath, line, { encoding: "utf-8" });
    const abSummary = (() => {
      const payload = args.payload as Record<string, unknown> | undefined;
      const exp = typeof payload?.["experimentId"] === "string" ? String(payload?.["experimentId"]) : undefined;
      const variant = typeof payload?.["variant"] === "string" ? String(payload?.["variant"]) : undefined;
      return exp || variant ? `${exp ?? "?"}:${variant ?? "?"}` : undefined;
    })();
    console.log(`[LOG] Записано событие в ${filePath}:`, {
      timestamp: args.timestamp,
      clientId: args.clientId,
      event: args.event,
      ...(abSummary ? { ab: abSummary } : {}),
      ...(args.payload ? { payload: args.payload } : {}),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Логируем ошибку, но не слишком громко, чтобы не засорять логи
    if (errorMsg.includes('EACCES') || errorMsg.includes('permission denied')) {
      // Тихая ошибка прав доступа - просто логируем один раз
      if (!ensureDirCache.has('_permission_error_logged')) {
        console.warn(`[LOG] Нет прав доступа для записи логов в ${getLogsRoot()}. События не будут сохраняться в файлы, но будут доступны в консоли Render.`);
        ensureDirCache.add('_permission_error_logged');
      }
    } else {
      console.error(`[LOG] Ошибка записи event log:`, errorMsg);
    }
    // Не прерываем выполнение при ошибке логирования
    // Всегда логируем в консоль для Render Dashboard
    console.log(`[EVENT] ${args.event}`, {
      timestamp: args.timestamp,
      clientId: args.clientId?.slice(0, 8),
      sessionId: args.sessionId?.slice(0, 8),
      payload: args.payload,
    });
  }
}

export async function writeHealthCheck() {
  const logsRoot = getLogsRoot();
  const filePath = path.join(logsRoot, "healthcheck.txt");
  await ensureDir(filePath);
  await writeFile(filePath, `last access: ${new Date().toISOString()}`);
}


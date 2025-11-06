/**
 * Инициализация папки для логов при старте приложения
 * Вызывается автоматически при импорте log-service
 */

import { mkdir, stat } from "fs/promises";
import path from "node:path";

const LOGS_ROOT_ENV = process.env.LOGS_ROOT;

// Список путей для попытки создания папки (в порядке приоритета)
const LOG_DIRS = [
  LOGS_ROOT_ENV, // Если задана переменная окружения
  "/data/logs", // Render Disk (если примонтирован)
  "/tmp/logs", // Временная папка (доступна везде)
  path.join(process.cwd(), "logs"), // Папка в проекте
];

let initPromise: Promise<string | null> | null = null;

export async function initLogs(): Promise<string | null> {
  // Если уже инициализировали, возвращаем результат
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    let createdDir: string | null = null;
    const errorMessages: string[] = [];

    for (const dir of LOG_DIRS) {
      if (!dir) continue; // Пропускаем undefined/null

      try {
        // Проверяем, существует ли папка
        try {
          await stat(dir);
          // Папка существует, можем использовать
          console.log(`[Init Logs] ✅ Папка уже существует: ${dir}`);
          process.env.LOGS_ROOT = dir;
          return dir;
        } catch (statError) {
          // Папка не существует, пытаемся создать
          const err = statError as Error & { code?: string };
          if (err.code === "ENOENT") {
            try {
              await mkdir(dir, { recursive: true });
              console.log(`[Init Logs] ✅ Создана папка для логов: ${dir}`);
              process.env.LOGS_ROOT = dir;
              createdDir = dir;
              return dir;
            } catch (mkdirError) {
              const error = mkdirError as Error & { code?: string };
              errorMessages.push(`  - ${dir}: ${error.code || error.message}`);
              // Пробуем следующий вариант
              continue;
            }
          } else {
            // Другая ошибка (например, нет прав доступа)
            errorMessages.push(`  - ${dir}: ${err.code || err.message}`);
            continue;
          }
        }
      } catch (error) {
        const err = error as Error & { code?: string };
        errorMessages.push(`  - ${dir}: ${err.code || err.message}`);
        continue;
      }
    }

    // Если не удалось создать ни одну папку
    if (!createdDir) {
      console.warn("[Init Logs] ⚠️  Не удалось создать папку для логов. Попытки:");
      errorMessages.forEach((msg) => console.warn(msg));
      console.warn(
        "[Init Logs] ⚠️  Логи будут записываться только в консоль (Render Dashboard)"
      );
      console.warn("[Init Logs] ⚠️  Для сохранения в файлы убедитесь, что:");
      console.warn("[Init Logs]     1. Render Disk примонтирован в /data");
      console.warn(
        "[Init Logs]     2. Или установлена переменная LOGS_ROOT с доступной папкой"
      );
      // Используем временную переменную, чтобы не было ошибок
      process.env.LOGS_ROOT = "/tmp/logs";
      return null;
    }

    return createdDir;
  })();

  return initPromise;
}

// Автоматически инициализируем при импорте (только в Node.js окружении)
if (typeof window === "undefined") {
  initLogs().catch((error) => {
    console.error("[Init Logs] ❌ Критическая ошибка инициализации:", error);
  });
}


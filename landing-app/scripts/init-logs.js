#!/usr/bin/env node

/**
 * Скрипт инициализации папки для логов
 * Создает папку для логов при старте приложения
 * Пробует несколько вариантов путей, если один недоступен
 */

const { mkdir, stat } = require('fs/promises');
const path = require('path');

const LOGS_ROOT_ENV = process.env.LOGS_ROOT;

// Список путей для попытки создания папки (в порядке приоритета)
const LOG_DIRS = [
  LOGS_ROOT_ENV, // Если задана переменная окружения
  '/data/logs', // Render Disk (если примонтирован)
  '/tmp/logs', // Временная папка (доступна везде)
  path.join(process.cwd(), 'logs'), // Папка в проекте
];

function getErrorDetails(error) {
  if (error && typeof error === "object") {
    const code = "code" in error ? error.code : null;
    const message = "message" in error ? error.message : null;
    return code || message || JSON.stringify(error);
  }
  return String(error);
}

async function initLogs() {
  let createdDir = null;
  let errorMessages = [];

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
        if (statError && typeof statError === 'object' && statError.code === 'ENOENT') {
          try {
            await mkdir(dir, { recursive: true });
            console.log(`[Init Logs] ✅ Создана папка для логов: ${dir}`);
            process.env.LOGS_ROOT = dir;
            createdDir = dir;
            return dir;
          } catch (mkdirError) {
            errorMessages.push(`  - ${dir}: ${getErrorDetails(mkdirError)}`);
            // Пробуем следующий вариант
            continue;
          }
        } else {
          // Другая ошибка (например, нет прав доступа)
          errorMessages.push(`  - ${dir}: ${getErrorDetails(statError)}`);
          continue;
        }
      }
    } catch (error) {
      errorMessages.push(`  - ${dir}: ${getErrorDetails(error)}`);
      continue;
    }
  }

  // Если не удалось создать ни одну папку
  if (!createdDir) {
    console.warn('[Init Logs] ⚠️  Не удалось создать папку для логов. Попытки:');
    errorMessages.forEach(msg => console.warn(msg));
    console.warn('[Init Logs] ⚠️  Логи будут записываться только в консоль (Render Dashboard)');
    console.warn('[Init Logs] ⚠️  Для сохранения в файлы убедитесь, что:');
    console.warn('[Init Logs]     1. Render Disk примонтирован в /data');
    console.warn('[Init Logs]     2. Или установлена переменная LOGS_ROOT с доступной папкой');
    // Используем временную переменную, чтобы не было ошибок
    process.env.LOGS_ROOT = '/tmp/logs';
    return null;
  }

  return createdDir;
}

// Запускаем инициализацию
if (require.main === module) {
  initLogs()
    .then((dir) => {
      if (dir) {
        console.log(`[Init Logs] ✅ Инициализация завершена. Используется: ${dir}`);
        process.exit(0);
      } else {
        console.warn('[Init Logs] ⚠️  Инициализация завершена с предупреждениями');
        process.exit(0); // Не считаем это критической ошибкой
      }
    })
    .catch((error) => {
      console.error('[Init Logs] ❌ Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = { initLogs };


import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";

/**
 * GET /api/logs - Просмотр логов событий
 * 
 * Параметры:
 * - date: YYYY-MM-DD (по умолчанию сегодня)
 * - event: фильтр по типу события
 * - limit: количество записей (по умолчанию 100)
 * 
 * Авторизация через заголовок Authorization: Bearer <LOGS_API_KEY>
 */
export async function GET(request: Request) {
  // Проверка авторизации
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.LOGS_API_KEY;
  
  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json(
      { error: "Unauthorized. Provide Authorization: Bearer <LOGS_API_KEY>" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const eventFilter = searchParams.get("event");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // Определяем дату
    const date = dateParam || new Date().toISOString().split("T")[0];
    const [year, month] = date.split("-");

    if (!year || !month) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const logsRoot = process.env.LOGS_ROOT || path.join(process.cwd(), "logs");
    const filePath = path.join(logsRoot, year, month, `events-${date}.csv`);

    // Читаем файл
    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch (error) {
      return NextResponse.json(
        {
          error: "Log file not found",
          date,
          filePath,
          hint: "Make sure the date is correct and logs are being written",
        },
        { status: 404 }
      );
    }

    // Парсим CSV
    const lines = content.split("\n").filter(Boolean);
    if (lines.length === 0) {
      return NextResponse.json({
        date,
        total: 0,
        events: [],
      });
    }

    const headerCandidate = lines[0]?.toLowerCase() ?? "";
    const hasHeader =
      headerCandidate.includes("timestamp") &&
      headerCandidate.includes("event");

    const rows = hasHeader ? lines.slice(1) : lines;

    // Парсим CSV строки
    const events = rows.map((line) => {
      // Простой CSV парсинг (может не работать для сложных JSON в payload)
      const parts: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          parts.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      parts.push(current); // Последняя часть

      const timestamp = parts[0]?.replace(/^"|"$/g, "") || "";
      const clientId = parts[1]?.replace(/^"|"$/g, "") || "";
      const sessionId = parts[2]?.replace(/^"|"$/g, "") || "";
      const eventType = parts[3]?.replace(/^"|"$/g, "") || "";
      const payloadStr = parts[4]?.replace(/^"|"$/g, "") || "";

      let payload = {};
      if (payloadStr) {
        try {
          payload = JSON.parse(payloadStr);
        } catch {
          // Если не JSON, оставляем как строку
          payload = { raw: payloadStr };
        }
      }

      return {
        timestamp,
        clientId,
        sessionId,
        event: eventType,
        payload,
      };
    });

    // Фильтруем по событию
    const filtered = eventFilter
      ? events.filter((e) => e.event === eventFilter)
      : events;

    // Ограничиваем количество
    const limited = filtered.slice(-limit);

    // Статистика
    const stats = events.reduce((acc, e) => {
      acc[e.event] = (acc[e.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      date,
      total: filtered.length,
      shown: limited.length,
      stats,
      events: limited,
    });
  } catch (error) {
    console.error("[Logs API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}



"use client";

import { useState, useEffect } from "react";

interface LogEvent {
  timestamp: string;
  clientId: string;
  sessionId: string;
  event: string;
  payload: Record<string, unknown>;
}

interface LogsResponse {
  date: string;
  total: number;
  shown: number;
  stats: Record<string, number>;
  events: LogEvent[];
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [eventFilter, setEventFilter] = useState("");
  const [apiKey, setApiKey] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        date,
        ...(eventFilter && { event: eventFilter }),
        limit: "200",
      });

      const response = await fetch(`/api/logs?${params}`, {
        headers: apiKey
          ? {
              Authorization: `Bearer ${apiKey}`,
            }
          : {},
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data: LogsResponse = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLogs(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Попробуем загрузить логи при монтировании
    // fetchLogs();
  }, []);

  return (
    <div className="min-h-screen bg-neo-night p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 font-display text-4xl font-bold">
          📊 Просмотр логов событий
        </h1>

        {/* Фильтры */}
        <div className="mb-6 rounded-xl border border-white/20 bg-white/5 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold">Дата</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Фильтр по событию
              </label>
              <input
                type="text"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                placeholder="cta_click, button_click..."
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder:text-white/40"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">
                API Key (опционально)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Bearer token"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder:text-white/40"
              />
            </div>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="mt-4 rounded-lg bg-gradient-cta px-6 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Загрузка..." : "Загрузить логи"}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-red-300">
            ❌ {error}
          </div>
        )}

        {/* Статистика */}
        {logs && logs.stats && (
          <div className="mb-6 rounded-xl border border-white/20 bg-white/5 p-6">
            <h2 className="mb-4 font-display text-xl font-bold">Статистика</h2>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {Object.entries(logs.stats).map(([event, count]) => (
                <div
                  key={event}
                  className="rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div className="text-sm text-white/70">{event}</div>
                  <div className="text-2xl font-bold text-neo-electric">
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Логи */}
        {logs && (
          <div className="rounded-xl border border-white/20 bg-white/5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                События ({logs.shown} из {logs.total})
              </h2>
              <div className="text-sm text-white/70">
                Дата: {logs.date}
              </div>
            </div>

            <div className="space-y-2">
              {logs.events.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-white/70">
                  Нет событий за выбранную дату
                </div>
              ) : (
                logs.events.map((event, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold text-neo-electric">
                        {event.event}
                      </span>
                      <span className="text-xs text-white/50">
                        {new Date(event.timestamp).toLocaleString("ru-RU")}
                      </span>
                    </div>
                    <div className="grid gap-2 text-xs text-white/70 sm:grid-cols-3">
                      <div>
                        <span className="text-white/50">Client:</span>{" "}
                        {event.clientId.slice(0, 8)}...
                      </div>
                      <div>
                        <span className="text-white/50">Session:</span>{" "}
                        {event.sessionId.slice(0, 8)}...
                      </div>
                      <div>
                        <span className="text-white/50">Payload:</span>{" "}
                        {JSON.stringify(event.payload).slice(0, 50)}
                        {JSON.stringify(event.payload).length > 50 && "..."}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Инструкции */}
        <div className="mt-8 rounded-xl border border-white/20 bg-white/5 p-6">
          <h3 className="mb-4 font-display text-lg font-bold">
            📖 Как использовать
          </h3>
          <div className="space-y-2 text-sm text-white/70">
            <p>
              <strong>1. Через веб-интерфейс:</strong> Используйте форму выше
              для просмотра логов.
            </p>
            <p>
              <strong>2. Через API:</strong>
            </p>
            <pre className="mt-2 rounded-lg border border-white/10 bg-neo-card p-3 text-xs">
              {`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-app.onrender.com/api/logs?date=2025-11-05&event=cta_click"`}
            </pre>
            <p className="mt-4">
              <strong>3. На Render:</strong> Перейдите в Dashboard → Logs для
              просмотра всех логов в реальном времени.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}





"use client";

import { useState } from "react";

export default function TestWebhookPage() {
  // Защита от доступа в продакшене
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neo-night via-purple-900 to-neo-night flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Доступ запрещен</h1>
          <p className="text-white/70">Эта страница доступна только в режиме разработки.</p>
        </div>
      </main>
    );
  }
  const [status, setStatus] = useState<{
    loading: boolean;
    result: any;
    error: string | null;
  }>({
    loading: false,
    result: null,
    error: null,
  });

  const [testMessage, setTestMessage] = useState("автомобиль");

  const checkConfig = async () => {
    setStatus({ loading: true, result: null, error: null });
    try {
      const response = await fetch("/api/test-webhook");
      const data = await response.json();
      setStatus({ loading: false, result: data, error: null });
    } catch (error) {
      setStatus({
        loading: false,
        result: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const testWebhook = async () => {
    setStatus({ loading: true, result: null, error: null });
    try {
      const response = await fetch("/api/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });
      const data = await response.json();
      setStatus({ loading: false, result: data, error: null });
    } catch (error) {
      setStatus({
        loading: false,
        result: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-neo-night via-purple-900 to-neo-night p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-4xl font-bold text-white">Тест Webhook</h1>

        <div className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <h2 className="mb-4 text-2xl font-semibold text-white">Проверка конфигурации</h2>
          <button
            onClick={checkConfig}
            disabled={status.loading}
            className="rounded-xl bg-neo-electric px-6 py-3 font-semibold text-white transition hover:bg-neo-electric/80 disabled:opacity-50"
          >
            Проверить настройки
          </button>
          {status.result && (
            <div className="mt-4 rounded-lg bg-black/30 p-4">
              <pre className="overflow-auto text-sm text-white">
                {JSON.stringify(status.result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <h2 className="mb-4 text-2xl font-semibold text-white">Тест запроса к webhook</h2>
          <div className="space-y-4">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Тестовое сообщение"
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/50"
            />
            <button
              onClick={testWebhook}
              disabled={status.loading}
              className="rounded-xl bg-gradient-cta px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {status.loading ? "Отправка..." : "Отправить тестовый запрос"}
            </button>
          </div>
          {status.error && (
            <div className="mt-4 rounded-lg bg-red-500/20 p-4 text-red-300">
              <strong>Ошибка:</strong> {status.error}
            </div>
          )}
          {status.result && (
            <div className="mt-4 rounded-lg bg-black/30 p-4">
              <pre className="overflow-auto text-sm text-white">
                {JSON.stringify(status.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


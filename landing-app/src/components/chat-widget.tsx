"use client";

import { useEffect, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
};

const initialAgentMessage =
  "Привет! Я Семён. Расскажите, что хотите закупить — подберу КТРУ и характеристики.";

const fallbackReply =
  "Семён сейчас перегружен. Попробуйте отправить запрос ещё раз через минуту.";

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: uuid(),
      role: "agent",
      content: initialAgentMessage,
      timestamp: Date.now(),
    },
  ]);

  const sessionId = useMemo(() => uuid(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem("ktro_agent_id");
    if (existing) {
      setClientId(existing);
      return;
    }
    const generated = uuid();
    window.localStorage.setItem("ktro_agent_id", generated);
    document.cookie = `ktro_agent_id=${generated}; max-age=${60 * 60 * 24 * 180}; path=/; SameSite=Lax`;
    setClientId(generated);
  }, []);

  const ensureClientId = () => {
    if (clientId) return clientId;
    const generated = uuid();
    setClientId(generated);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ktro_agent_id", generated);
      document.cookie = `ktro_agent_id=${generated}; max-age=${60 * 60 * 24 * 180}; path=/; SameSite=Lax`;
    }
    return generated;
  };

  const trackEvent = async (event: string, payload?: Record<string, unknown>) => {
    const id = ensureClientId();
    try {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          sessionId,
          event,
          payload,
        }),
      });
    } catch (error) {
      console.error("analytics track error", error);
    }
  };

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!hasOpened) {
      setHasOpened(true);
      void trackEvent("chat_open");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;

    const id = ensureClientId();

    const userMessage: Message = {
      id: uuid(),
      role: "user",
      content: value,
      timestamp: Date.now(),
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput("");
    setIsThinking(true);

    void trackEvent("chat_message_sent", { length: value.length });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          sessionId,
          message: value,
          history: updatedHistory
            .map((m) => ({ role: m.role, content: m.content }))
            .slice(-10),
          meta: { source: "landing", openedAt: messages[0]?.timestamp },
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API responded with ${response.status}`);
      }

      const data = await response.json();
      const reply = typeof data?.reply === "string" ? data.reply : fallbackReply;

      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "agent",
          content: reply,
          timestamp: Date.now(),
        },
      ]);
      void trackEvent("chat_message_received", { latencyMs: data?.latencyMs ?? null });
    } catch (error) {
      console.error("chat error", error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "agent",
          content: fallbackReply,
          timestamp: Date.now(),
        },
      ]);
      void trackEvent("chat_error", { reason: (error as Error).message });
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-cta text-black shadow-neon transition-transform duration-500 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-neo-electric/40 md:h-16 md:w-16"
      >
        <span className="text-2xl">🤖</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-neo-card/95 backdrop-blur-xl shadow-neon md:w-[400px]">
          <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neo-glow/20 text-xl">
              🤖
            </div>
            <div>
              <p className="font-display text-lg">Семён</p>
              <p className="text-sm text-white/60">
                {isThinking ? "подбираю варианты…" : "онлайн"}
              </p>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-neon-soft ${
                    message.role === "user"
                      ? "bg-gradient-cta text-neo-night"
                      : "bg-white/5 text-white"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <span className="h-2 w-2 animate-ping rounded-full bg-neo-electric" />
                Семён думает…
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="border-t border-white/5 bg-neo-card/60 p-4">
            <input type="hidden" name="sessionId" value={sessionId} />
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none"
                placeholder="Опишите, что хотите купить…"
                maxLength={2000}
                aria-label="Сообщение для Семёна"
              />
              <button
                type="submit"
                disabled={isThinking}
                className="rounded-full bg-gradient-cta px-5 py-2 text-sm font-semibold text-neo-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отправить
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};


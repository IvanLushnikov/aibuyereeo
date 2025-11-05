"use client";

import { useEffect, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
};

const fallbackReply =
  "ИИ-бот сейчас перегружен. Попробуйте отправить запрос ещё раз через минуту.";

// Функция для рендеринга сообщения с поддержкой ссылок и форматирования
const renderFormattedMessage = (content: string) => {
  const parts: (string | JSX.Element)[] = [];
  let remaining = content;
  let keyCounter = 0;

  // Обрабатываем markdown ссылки [текст](url) в первую очередь
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let markdownMatch;
  let lastIndex = 0;

  while ((markdownMatch = markdownLinkRegex.exec(content)) !== null) {
    // Добавляем текст до ссылки
    if (markdownMatch.index > lastIndex) {
      const beforeText = content.slice(lastIndex, markdownMatch.index);
      if (beforeText) {
        parts.push(beforeText);
      }
    }

    // Добавляем ссылку
    parts.push(
      <a
        key={`link-${keyCounter++}`}
        href={markdownMatch[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-neo-electric underline hover:text-neo-glow transition-colors"
      >
        {markdownMatch[1]}
      </a>
    );

    lastIndex = markdownMatch.index + markdownMatch[0].length;
  }

  // Добавляем оставшийся текст после markdown ссылок
  if (lastIndex < content.length) {
    remaining = content.slice(lastIndex);
  } else if (lastIndex === 0) {
    remaining = content;
  }

  // Если были markdown ссылки, обрабатываем оставшийся текст отдельно
  if (lastIndex > 0 && remaining) {
    parts.push(remaining);
  } else if (lastIndex === 0) {
    // Если не было markdown ссылок, обрабатываем обычные URL
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    let urlMatch;
    let urlLastIndex = 0;

    while ((urlMatch = urlRegex.exec(remaining)) !== null) {
      // Добавляем текст до URL
      if (urlMatch.index > urlLastIndex) {
        const beforeUrl = remaining.slice(urlLastIndex, urlMatch.index);
        if (beforeUrl) {
          parts.push(beforeUrl);
        }
      }

      // Добавляем URL ссылку
      const url = urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`;
      parts.push(
        <a
          key={`url-${keyCounter++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neo-electric underline hover:text-neo-glow transition-colors"
        >
          {urlMatch[0]}
        </a>
      );

      urlLastIndex = urlMatch.index + urlMatch[0].length;
    }

    // Добавляем оставшийся текст после URL
    if (urlLastIndex < remaining.length) {
      parts.push(remaining.slice(urlLastIndex));
    } else if (urlLastIndex === 0) {
      parts.push(remaining);
    }
  }

  // Обрабатываем форматирование в текстовых частях
  const processFormatting = (text: string): (string | JSX.Element)[] => {
    const result: (string | JSX.Element)[] = [];
    let pos = 0;
    const textLength = text.length;

    while (pos < textLength) {
      // Ищем жирный текст **text**
      const boldMatch = text.slice(pos).match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        result.push(<strong key={`bold-${keyCounter++}`} className="font-bold">{boldMatch[1]}</strong>);
        pos += boldMatch[0].length;
        continue;
      }

      // Ищем код `code`
      const codeMatch = text.slice(pos).match(/^`([^`]+)`/);
      if (codeMatch) {
        result.push(
          <code key={`code-${keyCounter++}`} className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">
            {codeMatch[1]}
          </code>
        );
        pos += codeMatch[0].length;
        continue;
      }

      // Ищем курсив *text* (но не **text**)
      // Проверяем, что перед * нет другого *
      const italicStart = text.slice(pos).indexOf('*');
      if (italicStart === 0 && pos > 0 && text[pos - 1] !== '*' && pos + 1 < textLength && text[pos + 1] !== '*') {
        const italicEnd = text.slice(pos + 1).indexOf('*');
        if (italicEnd !== -1 && text.slice(pos + 1, pos + 1 + italicEnd).indexOf('*') === -1) {
          const italicText = text.slice(pos + 1, pos + 1 + italicEnd);
          if (italicText) {
            result.push(<em key={`italic-${keyCounter++}`} className="italic">{italicText}</em>);
            pos += italicEnd + 2;
            continue;
          }
        }
      }

      // Обычный текст до следующего форматирования
      const nextBold = text.slice(pos).indexOf('**');
      const nextCode = text.slice(pos).indexOf('`');
      // Ищем одиночный * который не является частью **
      let nextItalic = -1;
      for (let i = pos; i < textLength - 1; i++) {
        if (text[i] === '*' && text[i + 1] !== '*' && (i === 0 || text[i - 1] !== '*')) {
          const endItalic = text.slice(i + 1).indexOf('*');
          if (endItalic !== -1 && text.slice(i + 1, i + 1 + endItalic).indexOf('*') === -1) {
            nextItalic = i - pos;
            break;
          }
        }
      }
      
      const nextPos = [
        nextBold !== -1 ? nextBold : Infinity,
        nextCode !== -1 ? nextCode : Infinity,
        nextItalic !== -1 ? nextItalic : Infinity
      ].filter(p => p !== Infinity);

      if (nextPos.length > 0) {
        const minPos = Math.min(...nextPos);
        if (minPos > 0) {
          result.push(text.slice(pos, pos + minPos));
          pos += minPos;
        } else {
          result.push(text[pos]);
          pos++;
        }
      } else {
        result.push(text.slice(pos));
        break;
      }
    }

    return result.length > 0 ? result : [text];
  };

  // Обрабатываем форматирование в каждой текстовой части
  return parts.map((part, idx) => {
    if (typeof part === 'string') {
      const formatted = processFormatting(part);
      return <span key={`part-${idx}`}>{formatted}</span>;
    }
    return part;
  });
};

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

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

  const handleToggle = async () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    if (!hasOpened) {
      setHasOpened(true);
      void trackEvent("chat_open");
    }

    // Если открываем чат впервые и еще не инициализировали, отправляем пустое сообщение для получения первого вопроса от бота
    if (newIsOpen && !hasInitialized && messages.length === 0) {
      setHasInitialized(true);
      setIsThinking(true);
      
      const id = ensureClientId();
      
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: id,
            sessionId,
            message: "",
            history: [],
            meta: { source: "landing", isInitial: true },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const reply = typeof data?.reply === "string" ? data.reply : fallbackReply;

          setMessages([
            {
              id: uuid(),
              role: "agent",
              content: reply,
              timestamp: Date.now(),
            },
          ]);
          void trackEvent("chat_message_received", { latencyMs: data?.latencyMs ?? null, initial: true });
        }
      } catch (error) {
        console.error("initial chat error", error);
        setMessages([
          {
            id: uuid(),
            role: "agent",
            content: fallbackReply,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsThinking(false);
      }
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
        className="group fixed bottom-6 right-6 z-40 flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-cta px-6 py-3 text-base font-bold text-neo-night shadow-[0_0_30px_rgba(255,95,141,0.6)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,95,141,0.8)] focus:outline-none focus:ring-4 focus:ring-neo-electric/40 md:px-8 md:py-4 md:text-lg"
      >
        <span className="relative z-10">🎯 Подобрать код</span>
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-neo-card/95 backdrop-blur-xl shadow-neon md:w-[400px]">
          <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neo-glow/20 text-xl">
              🤖
            </div>
            <div>
              <p className="font-display text-lg">ИИ-бот</p>
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
                  {message.role === "agent" ? (
                    <div className="whitespace-pre-wrap break-words">
                      {renderFormattedMessage(message.content)}
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <span className="h-2 w-2 animate-ping rounded-full bg-neo-electric" />
                ИИ-бот думает…
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
                aria-label="Сообщение для ИИ-бота"
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


"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { ensureClientId } from "@/lib/client-id";

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
};

const fallbackReply =
  "ИИ‑бот сейчас перегружен. Попробуйте отправить запрос ещё раз через минуту.";

const welcomeMessage = `Привет! Помогу подобрать коды КТРУ по описанию товара или услуги.

Опишите предмет закупки простыми словами. Например:
• "Нужны мониторы 24 дюйма для школы, 10 штук"
• "Требуется грузовой автомобиль грузоподъемностью 3 тонны"
• "Нужны услуги по уборке офисных помещений"

Уточню недостающие параметры, предложу коды КТРУ с обязательными характеристиками и проверю корректность набора параметров.`;

// Валидация и санитизация URL для защиты от XSS
const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Разрешаем только http/https протоколы
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

const sanitizeUrl = (url: string): string => {
  // Убираем опасные протоколы
  const cleaned = url.trim().replace(/^javascript:|^data:|^vbscript:/i, '');
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }
  return `https://${cleaned}`;
};

// Функция для рендеринга сообщения с поддержкой ссылок и форматирования
const renderFormattedMessage = (content: string) => {
  const parts: (string | React.ReactElement)[] = [];
  let remaining = content;
  let keyCounter = 0;

  // Обрабатываем markdown ссылки [текст](url) в первую очередь
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const markdownMatches: Array<{ index: number; text: string; url: string; length: number }> = [];
  
  // Собираем все совпадения сначала (избегаем проблем с exec и /g)
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    markdownMatches.push({
      index: match.index,
      text: match[1],
      url: match[2],
      length: match[0].length,
    });
  }

  let lastIndex = 0;

  for (const markdownMatch of markdownMatches) {
    // Добавляем текст до ссылки
    if (markdownMatch.index > lastIndex) {
      const beforeText = content.slice(lastIndex, markdownMatch.index);
      if (beforeText) {
        parts.push(beforeText);
      }
    }

    // Валидируем и санитизируем URL
    const sanitizedUrl = sanitizeUrl(markdownMatch.url);
    if (isValidUrl(sanitizedUrl)) {
      parts.push(
        <a
          key={`link-${keyCounter++}`}
          href={sanitizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neo-electric underline hover:text-neo-glow transition-colors"
        >
          {markdownMatch.text}
        </a>
      );
    } else {
      // Если URL невалидный, показываем как обычный текст
      parts.push(markdownMatch.text);
    }

    lastIndex = markdownMatch.index + markdownMatch.length;
  }

  // Добавляем оставшийся текст после markdown ссылок
  if (lastIndex < content.length) {
    remaining = content.slice(lastIndex);
  } else if (lastIndex === 0) {
    remaining = content;
  }

  // Функция для обработки URL и кодов КТРУ
  function processUrlsAndKtruCodes(text: string, partsArray: (string | React.ReactElement)[], keyCount: number): { remaining: string; newKeyCount: number } {
    // Сначала обрабатываем полные URL (включая zakupki44fz.ru)
    const urlRegex = /(https?:\/\/[^\s\)]+|www\.[^\s\)]+)/gi;
    const allMatches: Array<{ index: number; type: 'url' | 'ktru'; text: string; length: number; url?: string }> = [];
    
    // Собираем все URL
    let urlMatch;
    while ((urlMatch = urlRegex.exec(text)) !== null) {
      allMatches.push({
        index: urlMatch.index,
        type: 'url',
        text: urlMatch[0],
        length: urlMatch[0].length,
        url: urlMatch[0],
      });
    }

    // Затем обрабатываем коды КТРУ без URL (формат: XX.XX.XX.XXX-XXXXXXXXX)
    // Ищем паттерн: цифры, точки, дефис, цифры (но не в уже найденных URL)
    // Паттерн: 2 цифры.2 цифры.2 цифры.3 цифры-8-9 цифр
    const ktruRegex = /\b(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d{8,9})\b/g;
    for (let match = ktruRegex.exec(text); match !== null; match = ktruRegex.exec(text)) {
      // Проверяем, не является ли это частью уже найденного URL
      const isPartOfUrl = allMatches.some(m => 
        m.type === 'url' && 
        match.index >= m.index && 
        match.index < m.index + m.length
      );
      
      if (!isPartOfUrl) {
        allMatches.push({
          index: match.index,
          type: 'ktru',
          text: match[1],
          length: match[0].length,
          url: `https://zakupki44fz.ru/app/okpd2/${match[1]}`,
        });
      }
    }

    // Сортируем все совпадения по индексу
    allMatches.sort((a, b) => a.index - b.index);

    let lastIndex = 0;
    let currentKeyCount = keyCount;

    for (const match of allMatches) {
      // Добавляем текст до совпадения
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        if (beforeText) {
          partsArray.push(beforeText);
        }
      }

      // Обрабатываем URL или код КТРУ
      if (match.type === 'url') {
        // Валидируем и санитизируем URL
        const sanitizedUrl = sanitizeUrl(match.text);
        if (isValidUrl(sanitizedUrl)) {
          partsArray.push(
            <a
              key={`url-${currentKeyCount++}`}
              href={sanitizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neo-electric underline hover:text-neo-glow transition-colors"
            >
              {match.text}
            </a>
          );
        } else {
          partsArray.push(match.text);
        }
      } else if (match.type === 'ktru' && match.url) {
        // Создаем ссылку для кода КТРУ
        partsArray.push(
          <a
            key={`ktru-${currentKeyCount++}`}
            href={match.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neo-electric underline hover:text-neo-glow transition-colors"
          >
            {match.text}
          </a>
        );
      } else {
        partsArray.push(match.text);
      }

      lastIndex = match.index + match.length;
    }

    // Возвращаем оставшийся текст после всех совпадений и обновленный keyCounter
    const remainingText = lastIndex < text.length ? text.slice(lastIndex) : '';
    return { remaining: remainingText, newKeyCount: currentKeyCount };
  }

  // Если были markdown ссылки, обрабатываем оставшийся текст отдельно
  if (lastIndex > 0 && remaining) {
    // Обрабатываем URL и коды КТРУ в оставшемся тексте
    const result = processUrlsAndKtruCodes(remaining, parts, keyCounter);
    remaining = result.remaining;
    keyCounter = result.newKeyCount;
  } else if (lastIndex === 0) {
    // Если не было markdown ссылок, обрабатываем URL и коды КТРУ
    const result = processUrlsAndKtruCodes(remaining, parts, keyCounter);
    remaining = result.remaining;
    keyCounter = result.newKeyCount;
  }

  // Добавляем оставшийся текст в parts, если он есть
  if (remaining) {
    parts.push(remaining);
  }

  // Обрабатываем форматирование в текстовых частях
  const processFormatting = (text: string): (string | React.ReactElement)[] => {
    const result: (string | React.ReactElement)[] = [];
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

// Глобальный способ открытия чата извне компонента
let openChatCallback: (() => void) | null = null;

export const openChat = () => {
  if (openChatCallback) {
    openChatCallback();
  }
};

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string>("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const initializationRef = useRef(false); // Для предотвращения race condition
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const sessionId = useMemo(() => uuid(), []);
  const thinkingPhrases = useMemo<string[]>(
    () => [
      "Подбираем код…",
      "Бежим в справочник…",
      "Сверяем классификаторы…",
      "Достаём чек‑листы…",
      "Ищем лучшие совпадения…",
      "Проверяем параметры…",
      "Сопоставляем по ОКПД2…",
      "Формируем параметры…",
    ],
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = ensureClientId();
    setClientId(id);
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Ротация статусов ожидания, пока isThinking === true
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const scheduleNext = () => {
      // Выбираем случайную фразу и время 2–5 секунд
      const nextStatus = thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
      setThinkingStatus(nextStatus);
      const delay = 2000 + Math.floor(Math.random() * 3000);
      timer = setTimeout(() => {
        if (isThinking) scheduleNext();
      }, delay);
    };

    if (isThinking) {
      scheduleNext();
    } else {
      setThinkingStatus("");
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isThinking, thinkingPhrases]);

  const getClientId = (): string => {
    // Если clientId уже установлен, используем его
    if (clientId && clientId.trim()) {
      return clientId;
    }
    
    // Используем утилиту ensureClientId с fallback
    try {
      const id = ensureClientId();
      if (id && id.trim()) {
        setClientId(id);
        return id;
      }
    } catch (error) {
      console.warn("[ChatWidget] Ошибка получения clientId:", error);
    }
    
    // Последний fallback: генерируем временный ID для сессии
    const fallbackId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    setClientId(fallbackId);
    return fallbackId;
  };

  const trackEvent = async (event: string, payload?: Record<string, unknown>) => {
    try {
      const id = getClientId();
      // Отправляем аналитику только если clientId валиден
      if (!id || !id.trim()) {
        console.warn("Cannot track event: invalid clientId");
        return;
      }

      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          sessionId,
          event,
          payload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn("Analytics API error:", response.status, errorData);
      }
    } catch (error) {
      // Не прерываем работу приложения из-за ошибок аналитики
      console.warn("analytics track error:", error);
    }
  };

  const handleToggle = useCallback(async (forceOpen?: boolean) => {
    const newIsOpen = forceOpen !== undefined ? forceOpen : !isOpen;
    setIsOpen(newIsOpen);
    
    // Если закрываем чат, отменяем все активные запросы
    if (!newIsOpen && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (!hasOpened) {
      setHasOpened(true);
      trackEvent("chat_open").catch(err => {
        console.warn("Failed to track event:", err);
      });
    }

    // Если открываем чат впервые, показываем статическое приветственное сообщение
    if (newIsOpen && !hasInitialized && messages.length === 0) {
      setHasInitialized(true);
      setMessages([
        {
          id: uuid(),
          role: "agent",
          content: welcomeMessage,
          timestamp: Date.now(),
        },
      ]);
    }
  }, [isOpen, hasOpened, hasInitialized, messages.length, isThinking, getClientId, trackEvent, sessionId, welcomeMessage]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value || isThinking) {
      return; // Предотвращаем двойную отправку
    }

    const id = getClientId();
    
    if (!id || !id.trim()) {
      console.error("Cannot send message: invalid clientId");
      return;
    }

    // Если это первое сообщение пользователя, удаляем приветственное сообщение
    // и начинаем нормальный диалог с ботом
    const isFirstUserMessage = messages.length === 1 && messages[0].role === "agent" && messages[0].content === welcomeMessage;

    const userMessage: Message = {
      id: uuid(),
      role: "user",
      content: value,
      timestamp: Date.now(),
    };

    // Если это первое сообщение, очищаем историю (убираем приветствие)
    const updatedHistory = isFirstUserMessage 
      ? [userMessage]
      : [...messages, userMessage];
    
    setMessages(updatedHistory);
    setInput("");

    trackEvent("chat_message_sent", { length: value.length }).catch(err => {
      console.warn("Failed to track event:", err);
    });

    // Создаем новый AbortController для этого запроса
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Показываем статус thinking только после начала запроса к API
    setIsThinking(true);

    try {
      // Фильтруем fallback и welcome сообщения из истории перед отправкой
      // Это предотвратит отправку ошибок и приветствий в n8n
      const cleanHistory = updatedHistory
        .filter((m) => {
          // Пропускаем сообщения агента, которые являются fallback или welcome сообщениями
          if (m.role === "agent") {
            if (m.content === fallbackReply || m.content === welcomeMessage) {
              return false;
            }
          }
          return true;
        })
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-10);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          sessionId,
          message: value,
          history: cleanHistory,
          meta: { source: "landing", openedAt: messages[0]?.timestamp },
        }),
        signal: controller.signal,
      });

      // Проверяем, не был ли запрос отменен
      if (controller.signal.aborted) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Chat API error:", response.status, errorData);
        throw new Error(`Chat API responded with ${response.status}: ${errorData.error || 'unknown error'}`);
      }

      const data = await response.json();
      const reply = typeof data?.reply === "string" ? data.reply : fallbackReply;

      // Проверяем еще раз, не был ли запрос отменен
      if (!controller.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            role: "agent",
            content: reply,
            timestamp: Date.now(),
          },
        ]);
        trackEvent("chat_message_received", { latencyMs: data?.latencyMs ?? null }).catch(err => {
          console.warn("Failed to track event:", err);
        });
      }
    } catch (error) {
      // Игнорируем ошибки отмены запроса
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error("chat error", error);
      if (!controller.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            role: "agent",
            content: fallbackReply,
            timestamp: Date.now(),
          },
        ]);
        trackEvent("chat_error", { reason: (error as Error).message }).catch(err => {
          console.warn("Failed to track event:", err);
        });
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsThinking(false);
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // Регистрируем callback для открытия чата извне
  useEffect(() => {
    openChatCallback = () => {
      if (!isOpen) {
        handleToggle(true);
      }
    };
    return () => {
      openChatCallback = null;
    };
  }, [isOpen, handleToggle]);

  // Автоскролл при добавлении новых сообщений или изменении статуса thinking
  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      // Используем requestAnimationFrame для гарантии, что DOM обновился
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
  }, [messages, isThinking, isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => handleToggle()}
        aria-label={isOpen ? "Закрыть чат" : "Подобрать код"}
        aria-expanded={isOpen}
        className="group fixed bottom-6 right-6 z-40 flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-cta px-6 py-3 text-base font-bold text-neo-night shadow-[0_0_30px_rgba(255,95,141,0.6)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,95,141,0.8)] focus:outline-none focus:ring-4 focus:ring-neo-electric/40 md:px-8 md:py-4 md:text-lg"
      >
        <span className="relative z-10">🎯 Подобрать код</span>
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </button>

      {/* Overlay для закрытия drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => handleToggle()}
          aria-hidden="true"
        />
      )}

      {/* Drawer - боковая панель справа */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Чат с ИИ‑ботом"
        aria-modal="true"
      >
        <div className="flex h-full w-full flex-col overflow-hidden border-l border-white/10 bg-neo-card/98 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neo-glow/20 text-2xl">
                🤖
              </div>
              <div>
                <p className="font-display text-xl font-bold">ИИ‑бот</p>
                <p className="text-sm text-white/60">
                  {isThinking ? "подбираю варианты..." : "онлайн"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle()}
              aria-label="Закрыть чат"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </header>

          {/* Messages area */}
          <div
            ref={messagesContainerRef}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6"
            role="log"
            aria-live="polite"
            aria-label="Сообщения чата"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
                role={message.role === "user" ? "user-message" : "agent-message"}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-4 text-base leading-relaxed shadow-neon-soft ${
                    message.role === "user"
                      ? "bg-gradient-cta text-neo-night"
                      : "bg-white/10 text-white"
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
              <div
                className="flex items-center gap-3 text-sm text-white/70"
                role="status"
                aria-live="polite"
                aria-label="ИИ‑бот обрабатывает запрос"
              >
                <span className="h-2 w-2 animate-ping rounded-full bg-neo-electric" />
                {thinkingStatus || "Ищем ответ…"}
              </div>
            )}
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="border-t border-white/10 bg-neo-card/80 p-6">
            <input type="hidden" name="sessionId" value={sessionId} />
            <div className="flex items-center gap-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!isThinking && input.trim()) {
                      const form = event.currentTarget.closest('form');
                      if (form) {
                        form.requestSubmit();
                      }
                    }
                  }
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none focus:ring-2 focus:ring-neo-electric/30"
                placeholder="Опишите, что хотите купить (простыми словами)…"
                maxLength={2000}
                aria-label="Сообщение для ИИ‑бота"
              />
              <button
                type="submit"
                disabled={isThinking || !input.trim()}
                className="rounded-xl bg-gradient-cta px-6 py-4 text-base font-semibold text-neo-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отправить
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};


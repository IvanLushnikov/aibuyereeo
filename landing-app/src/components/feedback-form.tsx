"use client";

import { useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { ensureClientId } from "@/lib/client-id";
import { logEvent, trackEvent } from "@/lib/analytics";

const roles = [
  "Инициатор",
  "Закупщик",
  "Технический специалист",
  "Другое",
];

type FormState = "idle" | "submitting" | "success";

// Валидация email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Rate limiting на клиенте: минимум 3 секунды между отправками
let lastSubmitTime = 0;
const MIN_SUBMIT_INTERVAL = 3000;

type FeedbackFormProps = {
  abExperimentId?: string;
  abPlacement?: string;
};

export const FeedbackForm = ({ abExperimentId, abPlacement }: FeedbackFormProps) => {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const sessionId = useMemo(() => uuid(), []);
  const honeypotRef = useRef<HTMLInputElement>(null);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setEmailError(null);

    // Проверка honeypot (защита от ботов)
    if (honeypotRef.current && honeypotRef.current.value) {
      // Бот заполнил honeypot - игнорируем отправку
      console.warn("[FeedbackForm] Honeypot triggered");
      return;
    }

    // Rate limiting на клиенте
    const now = Date.now();
    if (now - lastSubmitTime < MIN_SUBMIT_INTERVAL) {
      setError("Подождите несколько секунд перед повторной отправкой.");
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    const email = String(payload.email || "").trim();

    // Валидация email на клиенте
    if (!isValidEmail(email)) {
      setEmailError("Введите корректный адрес электронной почты.");
      return;
    }

    try {
      // A/B конверсия: фиксируем стандартным событием, чтобы было видно в статистике
      if (abExperimentId) {
        trackEvent("ab_conversion", { experimentId: abExperimentId, placement: abPlacement ?? "hero_right" }).catch(() => {});
      }
      // Лог клика по кнопке отправки формы
      logEvent("нажал «Отправить форму» в блоке заявки").catch(() => {});

      setState("submitting");
      lastSubmitTime = now;
      const clientId = ensureClientId();
      
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          email,
          role: payload.role,
          comment: payload.comment,
          clientId,
          sessionId,
        }),
      });

      // Читаем ответ один раз
      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error("[FeedbackForm] API error:", response.status, responseData);
        
        if (response.status === 429) {
          setError("Слишком много запросов. Подождите минуту и попробуйте снова.");
        } else if (response.status === 400) {
          setError(responseData.error || "Неверные данные. Проверьте форму и попробуйте ещё раз.");
        } else if (response.status === 502) {
          setError("Не удалось связаться с сервером обработки. Попробуйте ещё раз позднее.");
        } else if (response.status === 504) {
          setError("Сервер долго не отвечает. Попробуйте ещё раз." );
        } else {
          setError(`Ошибка сервера (${response.status}). Попробуйте ещё раз через минуту.`);
        }
        setState("idle");
        return;
      }

      // Проверяем, что ответ действительно успешный
      if (responseData.ok !== true) {
        setError("Неожиданный ответ от сервера. Попробуйте ещё раз.");
        setState("idle");
        return;
      }

      setState("success");
      formElement.reset();
    } catch (cause) {
      console.error("[FeedbackForm] Submit error:", cause);
      const errorMessage = cause instanceof Error ? cause.message : String(cause);
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setError("Нет подключения к интернету. Проверьте соединение и попробуйте ещё раз.");
      } else {
        setError(`Ошибка отправки: ${errorMessage}. Попробуйте ещё раз.`);
      }
      setState("idle");
    }
  };

  if (state === "success") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/10 p-10 text-center shadow-neon">
        <div className="text-4xl">🤖</div>
        <h3 className="mt-4 font-display text-2xl">Спасибо!</h3>
        <p className="mt-2 text-sm text-white/70">
          Мы свяжемся и пришлём чек‑лист для быстрого старта.
        </p>
        <button
          type="button"
          className="mt-6 text-sm text-white/60 underline decoration-dotted"
          onClick={() => {
            logEvent("нажал «Отправить новый запрос» после формы").catch(() => {});
            setState("idle");
          }}
        >
          Отправить новый запрос
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-neon-soft backdrop-blur-xl"
    >
      <h3 className="font-display text-2xl">Хотите протестировать на ваших задачах?</h3>
      <p className="mt-2 text-sm text-white/70">
        Оставьте контакт — пришлём сценарии внедрения и подключим к пилоту
      </p>
      {/* Honeypot поле (скрыто от пользователей, но видимо ботам) */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
        aria-hidden="true"
      />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Имя
          <input
            name="name"
            required
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none"
            placeholder="Иван"
            aria-required="true"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Рабочая почта
          <input
            type="email"
            name="email"
            required
            className={`rounded-2xl border px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none ${
              emailError
                ? "border-red-400 bg-white/10"
                : "border-white/10 bg-white/10"
            }`}
            placeholder="name@company.ru"
            aria-required="true"
            aria-invalid={emailError ? "true" : "false"}
            aria-describedby={emailError ? "email-error" : undefined}
            onChange={() => {
              if (emailError) setEmailError(null);
            }}
          />
          {emailError && (
            <span id="email-error" className="text-xs text-red-300" role="alert">
              {emailError}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Ваша роль
          <select
            name="role"
            defaultValue={roles[0]}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white focus:border-neo-electric focus:outline-none"
          >
            {roles.map((role) => (
              <option key={role} value={role} className="bg-neo-card text-white">
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm md:col-span-2">
          Расскажите о задаче
          <textarea
            name="comment"
            rows={4}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none"
            placeholder="Например: подключить отдел закупок и ИТ; пилот на 2 недели"
          />
        </label>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-300" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="group relative mt-6 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-cta px-10 py-4 text-base font-bold text-neo-night shadow-[0_0_30px_rgba(255,95,141,0.5)] transition-all hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(255,95,141,0.7)] hover:scale-105 disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
      >
        <span className="relative z-10">
          {state === "submitting" ? "Отправляем…" : "🚀 Получить разбор и доступ"}
        </span>
        {state !== "submitting" && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        )}
      </button>
    </form>
  );
};


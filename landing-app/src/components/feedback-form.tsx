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
] as const;

type FormState = "idle" | "submitting" | "success";

type FeedbackFormProps = {
  abExperimentId?: string;
  abPlacement?: string;
  abVariant?: string | null;
};

// Валидация email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Валидация телефона (опциональное поле)
const isValidPhone = (phone: string): boolean => {
  if (!phone || phone.trim().length === 0) {
    return true; // Пустой телефон - это нормально
  }
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{10,12}$/.test(digits);
};

// Rate limiting на клиенте: минимум 3 секунды между отправками
let lastSubmitTime = 0;
const MIN_SUBMIT_INTERVAL = 3000;

export const FeedbackForm = ({ abExperimentId, abPlacement, abVariant }: FeedbackFormProps) => {
  // Контролируемые поля формы
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>(roles[0]);
  const [comment, setComment] = useState("");

  // Состояния формы
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const sessionId = useMemo(() => uuid(), []);
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Очистка ошибок при изменении полей
  const handleNameChange = (value: string) => {
    setName(value);
    if (error && value.trim().length > 0) {
      setError(null);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) {
      setEmailError(null);
    }
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (phoneError) {
      setPhoneError(null);
    }
  };

  const handleRoleChange = (value: string) => {
    setRole(value);
    if (error && value.trim().length > 0) {
      setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setEmailError(null);
    setPhoneError(null);

    // Защита от повторной отправки
    if (state === "submitting") {
      console.warn("[FeedbackForm] Form is already submitting, ignoring duplicate submit");
      return;
    }

    // Проверка honeypot (защита от ботов)
    if (honeypotRef.current && honeypotRef.current.value) {
      console.warn("[FeedbackForm] Honeypot triggered");
      return;
    }

    // Rate limiting на клиенте
    const now = Date.now();
    if (now - lastSubmitTime < MIN_SUBMIT_INTERVAL) {
      setError("Подождите несколько секунд перед повторной отправкой.");
      return;
    }

    // Нормализация данных
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const normalizedRole = role.trim();
    const normalizedComment = comment.trim();

    // ЖЁСТКАЯ валидация обязательных полей
    if (!normalizedName || normalizedName.length === 0) {
      console.error("[FeedbackForm] Validation failed: name is empty");
      setError("Пожалуйста, укажите ваше имя.");
      return;
    }

    if (normalizedName.length < 2) {
      console.error("[FeedbackForm] Validation failed: name is too short");
      setError("Имя должно содержать минимум 2 символа.");
      return;
    }

    if (!normalizedEmail || normalizedEmail.length === 0) {
      console.error("[FeedbackForm] Validation failed: email is empty");
      setEmailError("Введите адрес электронной почты.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      console.error("[FeedbackForm] Validation failed: email is invalid", normalizedEmail);
      setEmailError("Введите корректный адрес электронной почты.");
      return;
    }

    if (!normalizedRole || normalizedRole.length === 0) {
      console.error("[FeedbackForm] Validation failed: role is empty");
      setError("Пожалуйста, выберите вашу роль.");
      return;
    }

    if (!roles.includes(normalizedRole as typeof roles[number])) {
      console.error("[FeedbackForm] Validation failed: role is invalid", normalizedRole);
      setError("Выберите корректную роль из списка.");
      return;
    }

    // Валидация телефона (если указан)
    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      console.error("[FeedbackForm] Validation failed: phone is invalid", normalizedPhone);
      setPhoneError("Введите корректный номер телефона (+7XXXXXXXXXX или 10-12 цифр).");
      setState("idle");
      return;
    }

    // АБСОЛЮТНАЯ ФИНАЛЬНАЯ ПРОВЕРКА перед отправкой
    const finalNameCheck = normalizedName.trim();
    const finalEmailCheck = normalizedEmail.trim();
    const finalRoleCheck = normalizedRole.trim();

    // Проверка на пустые значения и дефолтные плейсхолдеры
    const invalidValues = ["-", "—", "_", "нет", "empty", "undefined", "null", ""];
    const isNameInvalid = invalidValues.includes(finalNameCheck.toLowerCase()) || finalNameCheck.length < 2;
    const isEmailInvalid = invalidValues.includes(finalEmailCheck.toLowerCase()) || finalEmailCheck.length < 5;

    if (isNameInvalid || 
        isEmailInvalid || 
        !isValidEmail(finalEmailCheck) ||
        finalRoleCheck.length === 0 ||
        !roles.includes(finalRoleCheck as typeof roles[number])) {
      console.error("[FeedbackForm] CRITICAL: Final validation failed", {
        nameLength: finalNameCheck.length,
        emailLength: finalEmailCheck.length,
        roleLength: finalRoleCheck.length,
        nameValue: finalNameCheck,
        emailValue: finalEmailCheck,
        roleValue: finalRoleCheck,
        isNameInvalid,
        isEmailInvalid,
      });
      setError("Ошибка: не все обязательные поля заполнены корректно. Пожалуйста, проверьте форму.");
      setState("idle");
      return;
    }

    try {
      // A/B конверсия
      if (abExperimentId) {
        trackEvent("ab_conversion", { 
          experimentId: abExperimentId, 
          variant: abVariant ?? "form", 
          placement: abPlacement ?? "hero_right" 
        }).catch(() => {});
      }
      
      // Логирование события
      logEvent("нажал «Отправить форму» в блоке заявки").catch(() => {});

      setState("submitting");
      lastSubmitTime = now;
      const clientId = ensureClientId();

      // Формируем payload для отправки
      const payloadToSend = {
        name: finalNameCheck,
        email: finalEmailCheck,
        phone: normalizedPhone || undefined,
        role: finalRoleCheck,
        comment: normalizedComment || undefined,
        clientId,
        sessionId,
      };

      console.log("[FeedbackForm] Sending validated payload:", {
        name: payloadToSend.name,
        email: payloadToSend.email,
        role: payloadToSend.role,
        hasPhone: !!payloadToSend.phone,
        hasComment: !!payloadToSend.comment,
        nameLength: payloadToSend.name.length,
        emailLength: payloadToSend.email.length,
        roleLength: payloadToSend.role.length,
      });

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend),
      });

      // Читаем ответ
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
          setError("Сервер долго не отвечает. Попробуйте ещё раз.");
        } else {
          setError(`Ошибка сервера (${response.status}). Попробуйте ещё раз через минуту.`);
        }
        setState("idle");
        return;
      }

      // Проверяем успешность ответа
      if (responseData.ok !== true) {
        setError("Неожиданный ответ от сервера. Попробуйте ещё раз.");
        setState("idle");
        return;
      }

      // Успешная отправка
      setState("success");
      
      // Очищаем форму
      setName("");
      setEmail("");
      setPhone("");
      setRole(roles[0]);
      setComment("");
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
            setName("");
            setEmail("");
            setPhone("");
            setRole(roles[0]);
            setComment("");
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
      noValidate
      className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-neon-soft backdrop-blur-xl"
    >
      <h3 className="font-display text-2xl">Свяжемся для автоматизации закупок</h3>
      <p className="mt-2 text-sm text-white/70">
        Оставьте контакт — обсудим процесс и предложим план внедрения
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
          Имя *
          <input
            name="name"
            type="text"
            required
            minLength={2}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none"
            placeholder="Иван"
            aria-required="true"
          />
        </label>
        
        <label className="flex flex-col gap-2 text-sm">
          Рабочая почта *
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            className={`rounded-2xl border px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none ${
              emailError
                ? "border-red-400 bg-white/10"
                : "border-white/10 bg-white/10"
            }`}
            placeholder="name@company.ru"
            aria-required="true"
            aria-invalid={emailError ? "true" : "false"}
            aria-describedby={emailError ? "email-error" : undefined}
          />
          {emailError && (
            <span id="email-error" className="text-xs text-red-300" role="alert">
              {emailError}
            </span>
          )}
        </label>
        
        <label className="flex flex-col gap-2 text-sm">
          Телефон (по желанию)
          <input
            type="tel"
            name="phone"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className={`rounded-2xl border px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none ${
              phoneError ? "border-red-400 bg-white/10" : "border-white/10 bg-white/10"
            }`}
            placeholder="+7 999 123‑45‑67"
            aria-invalid={phoneError ? "true" : "false"}
            aria-describedby={phoneError ? "phone-error" : undefined}
          />
          {phoneError && (
            <span id="phone-error" className="text-xs text-red-300" role="alert">
              {phoneError}
            </span>
          )}
        </label>
        
        <label className="flex flex-col gap-2 text-sm">
          Ваша роль *
          <select
            name="role"
            required
            value={role}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white focus:border-neo-electric focus:outline-none"
            aria-required="true"
          >
            {roles.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {roleOption}
              </option>
            ))}
          </select>
        </label>
        
        <label className="flex flex-col gap-2 text-sm md:col-span-2">
          Расскажите о задаче
          <textarea
            name="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none"
            placeholder="Например: автоматизировать подбор КТРУ; подключить отдел закупок и ИТ"
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
          {state === "submitting" ? "Отправляем…" : "🚀 Связаться со мной"}
        </span>
        {state !== "submitting" && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        )}
      </button>
    </form>
  );
};

"use client";

import { useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import { ensureClientId } from "@/lib/client-id";

const roles = [
  "Инициатор",
  "Закупщик",
  "Технический специалист",
  "Другое",
];

type FormState = "idle" | "submitting" | "success";

export const FeedbackForm = () => {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const sessionId = useMemo(() => uuid(), []);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      setState("submitting");
      setError(null);
      const clientId = ensureClientId();
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "feedback_submitted",
          clientId,
          sessionId,
          payload,
        }),
      });
      setState("success");
      event.currentTarget.reset();
    } catch (cause) {
      console.error(cause);
      setError("Не удалось отправить форму. Попробуйте ещё раз.");
      setState("idle");
    }
  };

  if (state === "success") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/10 p-10 text-center shadow-neon">
        <div className="text-4xl">🤖</div>
        <h3 className="mt-4 font-display text-2xl">Спасибо!</h3>
        <p className="mt-2 text-sm text-white/70">
          ИИ-бот записал контакт и скоро пришлёт чек-лист внедрения.
        </p>
        <button
          type="button"
          className="mt-6 text-sm text-white/60 underline decoration-dotted"
          onClick={() => setState("idle")}
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
      <h3 className="font-display text-2xl">Хотите внедрить ИИ-бота у себя?</h3>
      <p className="mt-2 text-sm text-white/70">
        Оставьте контакт — пришлём сценарии и подключим к пилоту.
      </p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Имя
          <input
            name="name"
            required
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none"
            placeholder="Иван"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Рабочая почта
          <input
            type="email"
            name="email"
            required
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-neo-electric focus:outline-none"
            placeholder="name@company.ru"
          />
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
            placeholder="Например: хочу подключить отдел закупок и ИТ"
          />
        </label>
      </div>
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="group relative mt-6 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-cta px-10 py-4 text-base font-bold text-neo-night shadow-[0_0_30px_rgba(255,95,141,0.5)] transition-all hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(255,95,141,0.7)] hover:scale-105 disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
      >
        <span className="relative z-10">
          {state === "submitting" ? "Отправляем…" : "🚀 Получить личный разбор"}
        </span>
        {state !== "submitting" && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        )}
      </button>
    </form>
  );
};


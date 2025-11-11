"use client";

import Link from "next/link";
import { logEvent } from "@/lib/analytics";
import { openChat } from "@/components/chat-widget";

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-white/5 bg-black/55 backdrop-blur-lg transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-8 lg:px-12">
        {/* Логотип */}
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg backdrop-blur-sm">
            🤖
          </div>
          <div className="hidden sm:block">
            <p className="font-display text-base font-bold text-white leading-tight">ИИ‑бот для инициатора</p>
            <p className="text-xs text-white/60 leading-tight">Подбор КТРУ за минуты</p>
          </div>
          <div className="sm:hidden">
            <p className="font-display text-sm font-bold text-white">ИИ‑бот</p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-4 text-sm text-white/70">
          <button
            type="button"
            onClick={() => {
              logEvent("нажал «Попробовать в чате» в шапке");
              openChat();
            }}
            className="rounded-full bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/20"
          >
            Попробовать
          </button>
          <button
            type="button"
            onClick={() => {
              logEvent("нажал «Оставить заявку» в шапке", { target: "#feedback" });
              const feedbackSection = document.getElementById("feedback");
              feedbackSection?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-xs uppercase tracking-[0.14em] text-white/75 transition hover:text-white"
          >
            Оставить заявку
          </button>
          <a
            href="https://t.me/Aiexpertbuyerbot"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              logEvent("нажал Telegram в шапке", { url: "https://t.me/Aiexpertbuyerbot" })
            }
            className="text-xs uppercase tracking-[0.14em] text-white/75 transition hover:text-white"
          >
            Telegram
          </a>
        </nav>

        <div className="flex items-center gap-2 md:hidden text-xs uppercase tracking-[0.14em] text-white/75">
          <button
            type="button"
            onClick={() => {
              logEvent("нажал «Попробовать в чате» в шапке (mobile)");
              openChat();
            }}
            className="rounded-full bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
          >
            Чат
          </button>
          <button
            type="button"
            onClick={() => {
              logEvent("нажал «Оставить заявку» в шапке (mobile)", { target: "#feedback" });
              const feedbackSection = document.getElementById("feedback");
              feedbackSection?.scrollIntoView({ behavior: "smooth" });
            }}
            className="transition hover:text-white"
          >
            Оставить заявку
          </button>
          <a
            href="https://t.me/Aiexpertbuyerbot"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              logEvent("нажал Telegram в шапке (mobile)", { url: "https://t.me/Aiexpertbuyerbot" })
            }
            className="transition hover:text-white"
          >
            Telegram
          </a>
        </div>
      </div>
    </header>
  );
};


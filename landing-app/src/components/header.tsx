"use client";

import Link from "next/link";
import { logEvent } from "@/lib/analytics";

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-white/10 bg-neo-card/90 backdrop-blur-xl transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-8 lg:px-12">
        {/* Логотип */}
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-neo-electric/30 to-neo-glow/30 text-lg backdrop-blur-sm shadow-[0_0_20px_rgba(0,231,255,0.2)]">
            🤖
          </div>
          <div className="hidden sm:block">
            <p className="font-display text-base font-bold text-white leading-tight">ИИ‑бот для госзакупок</p>
            <p className="text-xs text-white/60 leading-tight">Подбор КТРУ за минуты</p>
          </div>
          <div className="sm:hidden">
            <p className="font-display text-sm font-bold text-white">ИИ‑бот</p>
          </div>
        </Link>

        {/* Навигация */}
        <nav className="hidden items-center gap-4 md:flex">
          <Link
            href="#feedback"
            onClick={() => logEvent("нажал «Заявка» в шапке (nav)", { target: "#feedback" })}
            className="text-xs font-medium text-white/70 transition-all hover:text-neo-electric hover:scale-105"
          >
            Заявка
          </Link>
        </nav>

        {/* Кнопки действий */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              logEvent("нажал «Заявка» в шапке (button)");
              const feedbackSection = document.getElementById("feedback");
              feedbackSection?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition-all hover:border-neo-electric hover:bg-neo-electric/10 hover:text-neo-electric hover:shadow-[0_0_20px_rgba(0,231,255,0.2)]"
          >
            Заявка
          </button>
        </div>
      </div>
    </header>
  );
};


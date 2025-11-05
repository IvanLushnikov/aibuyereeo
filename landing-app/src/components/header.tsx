"use client";

import Link from "next/link";
import { openChat } from "./chat-widget";

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-white/10 bg-neo-card/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 md:px-8 lg:px-12">
        {/* Логотип */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neo-electric/20 to-neo-glow/20 text-xl backdrop-blur-sm">
            🤖
          </div>
          <div className="hidden sm:block">
            <p className="font-display text-lg font-bold text-white">ИИ‑бот для госзакупок</p>
            <p className="text-xs text-white/60">Подбор КТРУ за секунды</p>
          </div>
          <div className="sm:hidden">
            <p className="font-display text-base font-bold text-white">ИИ‑бот</p>
          </div>
        </Link>

        {/* Навигация */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="#how"
            className="text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Как это работает
          </Link>
          <Link
            href="#audience"
            className="text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Для кого
          </Link>
          <Link
            href="#feedback"
            className="text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Контакты
          </Link>
        </nav>

        {/* Кнопка открытия чата */}
        <button
          type="button"
          onClick={openChat}
          className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-cta px-5 py-2.5 text-sm font-bold text-neo-night shadow-[0_0_20px_rgba(255,95,141,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,95,141,0.6)] focus:outline-none focus:ring-2 focus:ring-neo-electric/40 md:px-6 md:py-3 md:text-base"
        >
          <span className="relative z-10">💬 Открыть чат</span>
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </button>
      </div>
    </header>
  );
};


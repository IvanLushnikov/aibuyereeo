"use client";

import Link from "next/link";
import { ChatWidget, openChat } from "@/components/chat-widget";
import { FeedbackForm } from "@/components/feedback-form";
import { Header } from "@/components/header";
import { logEvent } from "@/lib/analytics";
import { useExperiment } from "@/lib/ab-client";
import { AbDebugBadge } from "@/components/ab-debug-badge";

const audience = [
  {
    title: "Инициаторы",
    description:
      "Опишите предмет закупки — сервис предложит коды КТРУ и список обязательных характеристик с обоснованием.",
    icon: "💡",
  },
  {
    title: "Контрактные управляющие и закупщики",
    description:
      "Ссылки на карточки КТРУ, журнал проверок и прозрачное обоснование выбора.",
    icon: "📊",
  },
  {
    title: "Технические специалисты",
    description:
      "Структурированные требования и шаблоны ТЗ без лишней рутины.",
    icon: "🛠️",
  },
];

const steps = [
  { title: "Опишите, что нужно купить", text: "Например: «мониторы 24″ для школы, 10 шт.»" },
  { title: "Поболтайте с ИИ в чате", text: "Короткий диалог — уточним важные детали без бюрократии." },
  { title: "Получите код КТРУ", text: "Сразу используйте в заявке. Секунды вместо часов." },
];

const painSolutions = [
  { pain: "Часы уходят на ручной подбор кода КТРУ", solution: "Секунды вместо часов — бот подберёт код за вас." },
  { pain: "Приходится ковыряться в классификаторе", solution: "Общайтесь по‑человечески в чате — без бюрократии." },
  { pain: "Сомнения, тот ли это код", solution: "Получите 1–3 ближайших варианта для быстрого выбора." },
  { pain: "Нет времени на настройки", solution: "Работает сразу в браузере. Бесплатно, без регистрации." },
];


const features = [
  "Актуальная база КТРУ",
  "Ответ за 5–15 секунд",
  "Удобный чат без регистрации",
  "Бесплатно в браузере",
];

const pains = [
  "Часы на ручной подбор кода КТРУ",
  "Неуверенность: тот ли это код",
  "Рутины много — времени нет",
];

export default function Home() {
  const { variant: ctaVariant, trackConversion: trackCtaConversion } = useExperiment("cta_text");
  return (
    <>
      <Header />
      <AbDebugBadge />
      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-16 px-4 pb-20 pt-20 sm:px-6 md:px-8 md:pt-22 lg:px-12 lg:gap-20">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="animate-float absolute -left-24 top-16 h-96 w-96 rounded-full bg-neo-glow/15 blur-3xl" />
        <div className="animate-float absolute -right-20 bottom-32 h-[32rem] w-[32rem] rounded-full bg-neo-electric/15 blur-3xl delay-1000" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neo-sunrise/10 blur-3xl" />
      </div>

      <section className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-white/10 to-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-neo-electric animate-pulse" />
            ИИ‑бот для госзакупок
          </div>
          <h1 className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Подбираем код КТРУ за секунды
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/80">
            Опишите закупку простыми словами — получите 1–3 кода КТРУ с обязательными характеристиками. Прямо в чате, бесплатно и без регистрации.
          </p>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Проблемы</p>
            <h2 className="font-display text-xl font-bold text-white">Что мы закрываем</h2>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pains.map((text) => (
              <li key={text} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80">
                <span className="text-neo-electric">✶</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                logEvent("нажал «Оставить заявку» в первом экране");
                const el = document.getElementById("feedback");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-cta px-6 py-4 text-base font-bold text-neo-night shadow-[0_0_30px_rgba(255,95,141,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_50px_rgba(255,95,141,0.6)] hover:scale-[1.02]"
            >
              Оставить заявку
            </button>
          </div>
        </div>
        {/* Правая колонка — встроенный чат */}
        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-3 sm:p-4 lg:p-5 shadow-[0_20px_60px_rgba(0,231,255,0.12)] backdrop-blur-xl">
          <ChatWidget mode="inline" defaultOpen hideFloatingButton />
        </div>
      </section>

      {/* Секция чата отдельно больше не нужна */}

      <section id="feedback" className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Связаться</p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Автоматизируем процессы госзакупок в вашей организации
          </h2>
          <p className="text-lg leading-relaxed text-white/80">
            Оставьте контакт — свяжемся, обсудим текущий процесс и предложим план внедрения
          </p>
        </div>
        <FeedbackForm />
      </section>

      <footer className="border-t border-white/10 pt-12 pb-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Контакты</h3>
            <div className="space-y-3 text-sm text-white/70">
              <a
                href="https://t.me/Aiexpertbuyerbot"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logEvent("нажал ссылку Telegram в футере", { url: "https://t.me/Aiexpertbuyerbot" })}
                className="flex items-center gap-2 transition-colors hover:text-neo-electric"
              >
                <span>💬</span>
                <span>Telegram: @Aiexpertbuyerbot</span>
              </a>
              <a
                href="https://zakupki44fz.ru/app/okpd2"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logEvent("нажал ссылку «Сайт для закупщика» в футере", { url: "https://zakupki44fz.ru/app/okpd2" })}
                className="flex items-center gap-2 transition-colors hover:text-neo-electric"
              >
                <span>🌐</span>
                <span>Сайт для закупщика</span>
              </a>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-white">О продукте</h3>
            <p className="text-sm leading-relaxed text-white/70">
              ИИ‑помощник для подбора кодов КТРУ по 44‑ФЗ и 223‑ФЗ. Бесплатно, без регистрации, прямо в браузере.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Полезные ссылки</h3>
            <div className="space-y-2 text-sm text-white/70">
              <Link href="#feedback" onClick={() => logEvent("нажал «Оставить заявку» в футере", { target: "#feedback" })} className="block transition-colors hover:text-neo-electric">
                Оставить заявку
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center text-[11px] leading-relaxed text-white/50">
          Материалы сервиса носят справочный характер и не являются юридической консультацией. Решения о выборе кода и формировании требований принимает пользователь с учётом норм 44‑ФЗ/223‑ФЗ и локальных регламентов.
        </div>
        
      </footer>

      {/* Убрали плавающий чат; используем только встроенный выше */}
    </main>
    </>
  );
}

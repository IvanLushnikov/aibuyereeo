"use client";

import Link from "next/link";
import { ChatWidget, startChatWith } from "@/components/chat-widget";
import { FeedbackForm } from "@/components/feedback-form";
import { Header } from "@/components/header";
import { logEvent } from "@/lib/analytics";
import { useExperiment } from "@/lib/ab-client";
import { AbDebugBadge } from "@/components/ab-debug-badge";

const steps = [
  { title: "Напишите, что нужно купить", text: "Например: «мониторы 24″ для школы, 10 шт.»" },
  { title: "Уточните детали по ходу", text: "Диагональ, назначение, особенности — бот спросит сам." },
  { title: "Получите 1–3 кода", text: "С характеристиками и ссылкой — можно сразу передать закупкам." },
];

const features = ["1–3 кода сразу", "Характеристики в ответе", "Уточняем вопросы по делу"];

const promptIdeas = [
  {
    label: "Компьютеры для офиса",
    query: "Нужны настольные компьютеры для офиса, 15 шт., бюджет 70 000 ₽ за штуку",
  },
  {
    label: "Медицинское оборудование",
    query: "Подобрать код КТРУ для аппарата ИВЛ для районной больницы",
  },
  {
    label: "Учебные ноутбуки",
    query: "Ноутбуки для школьного компьютерного класса, 25 шт., диагональ 14-15 дюймов",
  },
  {
    label: "Расходники",
    query: "Расходные материалы для 3D-принтера FDM, пластик PLA, 20 катушек",
  },
];

const sampleDialogue: Array<{ role: "user" | "bot"; text: string }> = [
  { role: "user", text: "Привет!" },
  { role: "bot", text: "Что нужно купить? Опишите простыми словами." },
  { role: "user", text: "Монитор 21,3 дюйма для офиса" },
  { role: "bot", text: "Записал. Подойдёт разрешение 1920×1080 и панель IPS?" },
  {
    role: "bot",
    text: `Код КТРУ: 26.20.17.110-00000040
Ссылка: https://zakupki44fz.ru/app/okpd2/26.20.17.110-00000040
Характеристики: диагональ 21,3", разрешение 1920×1080, соотношение 16:9.`,
  },
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

      <section className="relative grid gap-12 lg:grid-cols-[1fr_minmax(320px,0.85fr)] lg:items-start">
        <div className="space-y-10">
          <div className="rounded-3xl border border-white/8 bg-white/5 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <h1 className="font-display text-5xl leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Коды без боли
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85">
              Подбираем КТРУ за минуты вместо часов: опишите закупку простыми словами, бот уточнит детали и предложит варианты с характеристиками. Начните с короткой фразы — бот сам задаст уточняющие вопросы.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {features.map((text) => (
                <div
                  key={text}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/75"
                >
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/8 bg-white/5 p-6 shadow-[0_20px_60px_rgба(0,0,0,0.22)] backdrop-blur-xl">
            <p className="text-sm font-semibold text-white/80">Попробуйте готовые подсказки</p>
            <p className="mt-2 text-xs text-white/60">Кликните — и чат отправит черновик запроса, вы продолжите диалог.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {promptIdeas.map((idea) => (
                <button
                  key={idea.label}
                  type="button"
                  onClick={() => {
                    logEvent("клик быстрый запрос", { label: idea.label });
                    startChatWith(idea.query);
                  }}
                  className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs text-white/75 transition hover:border-white/35 hover:bg-white/10 hover:text-white"
                >
                  {idea.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-6 shadow-[0_20px_60px_rgба(0,0,0,0.28)] backdrop-blur-2xl">
          <ChatWidget mode="inline" defaultOpen hideFloatingButton />
        </div>
      </section>

      <section className="space-y-14">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Как работает</p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Три шага до кода</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 px-7 py-9 text-white/80 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
            >
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-neo-electric">Шаг {index + 1}</span>
              <h3 className="font-display text-xl font-bold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-12">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Пример диалога</p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Как бот уточняет запрос</h2>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
          {sampleDialogue.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-neon-soft ${
                  message.role === "user" ? "bg-gradient-cta text-neo-night" : "bg-white/10 text-white"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-10">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Помощь инициатору</p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Бот закрывает боль с кодами</h2>
        </div>
        <ul className="mx-auto flex max-w-4xl flex-wrap justify-center gap-3">
          {["1–3 кода за один диалог", "Пояснение к выбору", "Краткие вопросы по делу", "Характеристики для передачи закупщикам"].map(
            (text) => (
              <li
                key={text}
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80"
              >
                {text}
              </li>
            )
          )}
        </ul>
      </section>

      <section id="feedback" className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Связаться</p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Передадим результат закупщикам и поможем внедрить
          </h2>
          <p className="text-lg leading-relaxed text-white/80">
            Оставьте контакт — подключим команду, перенастроим процесс и соберём обратную связь по пилоту
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

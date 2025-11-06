"use client";

import Link from "next/link";
import { ChatWidget, openChat } from "@/components/chat-widget";
import { FeedbackForm } from "@/components/feedback-form";
import { Header } from "@/components/header";
import { trackEvent } from "@/lib/analytics";

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

const faq = [
  { question: "Как быстро отвечает сервис?", answer: "Обычно 5–15 секунд. При высокой нагрузке отображается индикатор ожидания." },
  { question: "Нужно ли что‑то устанавливать?", answer: "Нет, всё работает в браузере." },
  { question: "Откуда данные?", answer: "Официальный классификатор КТРУ. Обновления выполняются по плану." },
  { question: "Соответствует ли 44‑ФЗ/223‑ФЗ?", answer: "Сервис помогает проверить обязательные характеристики КТРУ, но не заменяет правовую экспертизу." },
  { question: "Кто принимает финальное решение?", answer: "Рекомендации носят справочный характер; окончательное решение принимает ответственное лицо." },
  { question: "Можно ли выгрузить обоснование?", answer: "Да, доступен экспорт с перечнем кодов КТРУ и ссылками на карточки." },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-16 px-4 pb-20 pt-20 sm:px-6 md:px-8 md:pt-22 lg:px-12 lg:gap-20">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="animate-float absolute -left-24 top-16 h-96 w-96 rounded-full bg-neo-glow/15 blur-3xl" />
        <div className="animate-float absolute -right-20 bottom-32 h-[32rem] w-[32rem] rounded-full bg-neo-electric/15 blur-3xl delay-1000" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neo-sunrise/10 blur-3xl" />
      </div>

      <section className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-white/10 to-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-neo-electric animate-pulse" />
            ИИ‑бот для госзакупок
          </div>
          <h1 className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Секунды вместо часов: ИИ‑бот подбирает код КТРУ за вас
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/80">
            Опишите закупку простыми словами — бот быстро предложит подходящий код КТРУ. Бесплатно и без регистрации.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                trackEvent("cta_click", { location: "hero", button: "Подобрать код КТРУ" });
                openChat();
              }}
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-cta px-6 py-4 text-base font-bold text-white shadow-[0_0_30px_rgba(255,95,141,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_50px_rgba(255,95,141,0.6)] hover:scale-[1.02]"
            >
              <span className="relative z-10">🎯 Подобрать код КТРУ</span>
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </button>
            <Link
              href="#how"
              onClick={() => trackEvent("link_click", { location: "hero", link: "Посмотреть, как работает", target: "#how" })}
              className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/5 px-6 py-4 text-sm font-semibold text-white backdrop-blur-md transition-all hover:border-neo-electric hover:bg-white/10 hover:text-neo-electric hover:shadow-[0_0_25px_rgba(0,231,255,0.3)]"
            >
              Посмотреть, как работает
            </Link>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-[0_20px_60px_rgba(0,231,255,0.15)] backdrop-blur-xl lg:p-8">
          <div className="absolute inset-0 bg-gradient-hero opacity-20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,47,255,0.3),transparent_70%)]" />
          <div className="relative space-y-5">
            <h2 className="font-display text-2xl font-bold text-white">Что умеет ИИ‑бот</h2>
            <ul className="space-y-4 text-sm leading-relaxed text-white/85">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 text-lg backdrop-blur-sm shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                  🎯
                </span>
                <span>Находит релевантные коды КТРУ под ваш запрос и предлагает альтернативы</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-lg backdrop-blur-sm shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  🧾
                </span>
                <span>Уточняет характеристики и выделяет обязательные параметры</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-lg backdrop-blur-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                  🛰️
                </span>
                <span>Подсвечивает неоднозначности запроса и помогает выбрать корректный код КТРУ</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="audience" className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">
            Для кого
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            ИИ‑бот помогает всем участникам закупки
          </h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audience.map((item, index) => (
            <div
              key={item.title}
              className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-neo-electric/50 hover:shadow-[0_30px_80px_rgba(0,231,255,0.2)]"
            >
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-neo-electric/30 to-neo-glow/30 blur-3xl transition-all group-hover:scale-150 group-hover:opacity-60" />
              <div className="relative space-y-3">
                <div className="text-3xl">{item.icon}</div>
                <h3 className="font-display text-xl font-bold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-white/75">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Процесс</p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Как ИИ‑бот работает с вашим запросом
          </h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-5 text-base shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-neo-electric/50 hover:shadow-[0_30px_80px_rgba(0,231,255,0.15)]"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white/30 bg-gradient-to-br from-neo-electric/20 to-neo-glow/20 font-display text-xl font-bold text-white backdrop-blur-sm transition-all group-hover:scale-110 group-hover:border-neo-electric group-hover:bg-neo-electric/30 shadow-[0_0_20px_rgba(0,231,255,0.2)]">
                {index + 1}
              </div>
              <h3 className="font-display text-lg font-bold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-white/75">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Закрываем боли</p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Решаем реальные задачи из практики
          </h2>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          {painSolutions.map((item) => (
            <div
              key={item.pain}
              className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-neo-sunrise/50 hover:shadow-[0_30px_80px_rgba(255,95,141,0.15)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-neo-sunrise/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-neo-sunrise">
                  Боль
                </p>
                <h3 className="mt-2 font-display text-xl font-bold text-white">{item.pain}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-xl leading-none text-neo-electric">→</span>
                  <p className="text-sm leading-relaxed text-white/80">{item.solution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Что внутри</p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Что внутри
          </h2>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature}
              className="group flex items-center gap-3 rounded-xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-4 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-neo-electric/50 hover:shadow-[0_30px_80px_rgba(0,231,255,0.15)]"
            >
              <span className="text-xl text-neo-electric transition-transform group-hover:scale-125 group-hover:rotate-12">✶</span>
              <span className="font-medium text-white/85">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">FAQ</p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Часто задаваемые вопросы
          </h2>
        </header>
        <div className="space-y-3">
          {faq.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:border-neo-electric/50 open:border-neo-electric/50"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-base font-semibold text-white">
                {item.question}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neo-electric/20 text-xl font-light text-neo-electric transition-transform group-open:rotate-45 group-open:bg-neo-electric/30">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-white/75">{item.answer}</p>
            </details>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-2xl border-2 border-neo-electric/50 bg-gradient-to-br from-neo-electric/20 via-neo-glow/10 to-neo-sunrise/10 p-8 text-center shadow-[0_0_60px_rgba(0,231,255,0.3)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
          <div className="relative space-y-4">
            <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">Готовы попробовать?</h3>
            <p className="mx-auto max-w-2xl text-base text-white/90">Начните прямо сейчас — это бесплатно и займёт меньше минуты</p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <span className="flex items-center gap-2 rounded-lg border border-neo-electric/40 bg-gradient-to-r from-neo-electric/20 to-neo-electric/10 px-4 py-1.5 text-xs font-semibold text-neo-electric backdrop-blur-sm">
                ⚡ Бесплатно
              </span>
              <span className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
                🛡️ Без регистрации
              </span>
              <span className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
                🧠 Актуальная база КТРУ
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                trackEvent("cta_click", { location: "faq_section", button: "Подобрать код КТРУ" });
                openChat();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-cta px-8 py-4 text-base font-bold text-white shadow-[0_0_40px_rgba(255,95,141,0.5)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_60px_rgba(255,95,141,0.7)] hover:scale-[1.02]"
            >
              <span>🎯 Подобрать код КТРУ</span>
            </button>
          </div>
        </div>
      </section>

      <section id="feedback" className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neo-electric">Связаться</p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Хотите протестировать на ваших задачах?
          </h2>
          <p className="text-lg leading-relaxed text-white/80">
            Оставьте контакт — пришлём сценарии внедрения и подключим к пилоту
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
                onClick={() => trackEvent("link_click", { location: "footer", link: "Telegram", url: "https://t.me/Aiexpertbuyerbot" })}
                className="flex items-center gap-2 transition-colors hover:text-neo-electric"
              >
                <span>💬</span>
                <span>Telegram: @Aiexpertbuyerbot</span>
              </a>
              <a
                href="https://zakupki44fz.ru/app/okpd2"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("link_click", { location: "footer", link: "Сайт для закупщика", url: "https://zakupki44fz.ru/app/okpd2" })}
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
              <Link href="#how" onClick={() => trackEvent("link_click", { location: "footer", link: "Как это работает", target: "#how" })} className="block transition-colors hover:text-neo-electric">
                Как это работает
              </Link>
              <Link href="#audience" onClick={() => trackEvent("link_click", { location: "footer", link: "Для кого", target: "#audience" })} className="block transition-colors hover:text-neo-electric">
                Для кого
              </Link>
              <Link href="#feedback" onClick={() => trackEvent("link_click", { location: "footer", link: "Оставить заявку", target: "#feedback" })} className="block transition-colors hover:text-neo-electric">
                Оставить заявку
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center text-[11px] leading-relaxed text-white/50">
          Материалы сервиса носят справочный характер и не являются юридической консультацией. Решения о выборе кода и формировании требований принимает пользователь с учётом норм 44‑ФЗ/223‑ФЗ и локальных регламентов.
        </div>
        
      </footer>

      <div id="chat">
        <ChatWidget />
      </div>
    </main>
    </>
  );
}

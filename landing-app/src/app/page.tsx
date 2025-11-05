import Link from "next/link";
import { ChatWidget } from "@/components/chat-widget";
import { FeedbackForm } from "@/components/feedback-form";

const audience = [
  {
    title: "Инициаторы",
    description:
      "Отправьте описание закупки — ИИ‑бот найдёт КТРУ, характеристики и подсветит риски.",
    icon: "💡",
  },
  {
    title: "Технические специалисты",
    description:
      "Меньше рутины: бот уточнит требования и соберёт характеристики.",
    icon: "🛠️",
  },
  {
    title: "Специалисты по закупкам",
    description:
      "Актуальные классификаторы, проверка соответствия ОКПД2/КТРУ и журнал проверок.",
    icon: "📊",
  },
];

const steps = [
  {
    title: "Опишите потребность",
    text: "Например: «нужны мониторы 24″ для школы, 10 шт.»",
  },
  {
    title: "ИИ‑бот уточнит детали",
    text: "Спросит критичные параметры и проверит, ничего ли не упущено.",
  },
  {
    title: "Получите КТРУ и характеристики",
    text: "Список кодов, параметры и подсказки по ОКПД2 и НМЦК.",
  },
  {
    title: "Экспортируйте и переходите к закупке",
    text: "Сохраните ответ, приложите к заявке или отправьте поставщикам.",
  },
];

const painSolutions = [
  {
    pain: "Тратите часы на подбор КТРУ",
    solution: "ИИ‑бот сканирует классификаторы и предлагает лучшие совпадения.",
  },
  {
    pain: "Характеристики собираются по‑разному",
    solution: "Бот стандартизирует параметры и проверяет полноту.",
  },
  {
    pain: "ЕИС отклоняет из‑за несоответствия ОКПД2",
    solution: "Бот предварительно сверяет соответствие и показывает расхождения.",
  },
  {
    pain: "НМЦК считаете вручную",
    solution: "В разработке: автоматический расчёт по КП и рыночным данным.",
  },
];


const features = [
  "Актуальная база КТРУ и ОКПД2 с регулярными обновлениями",
  "Подсказки по обязательным характеристикам и проверка полноты",
  "История диалога и экспорт ответов в CSV",
  "Предварительный аудит рисков и соответствия ОКПД2",
];

const faq = [
  {
    question: "Как быстро отвечает бот?",
    answer:
      "Обычно 5–15 секунд. При высокой нагрузке покажем индикатор ожидания; уведомления придут в чат.",
  },
  {
    question: "Нужно ли что‑то устанавливать?",
    answer: "Нет. Всё работает в браузере — без регистрации и лишних форм.",
  },
  {
    question: "Откуда берутся данные?",
    answer:
      "Официальные классификаторы КТРУ и ОКПД2. Обновляем по расписанию и дополняем чек‑листами.",
  },
  {
    question: "Это бесплатно?",
    answer: "Да, пилот для участников госзакупок бесплатен. Просим делиться обратной связью.",
  },
  {
    question: "Насколько точные ответы?",
    answer:
      "Бот предлагает варианты, финальный выбор и проверка кода остаются за специалистом.",
  },
];

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-32 px-4 pb-32 pt-20 sm:px-6 md:px-8 lg:px-12">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="animate-float absolute -left-24 top-16 h-96 w-96 rounded-full bg-neo-glow/15 blur-3xl" />
        <div className="animate-float absolute -right-20 bottom-32 h-[32rem] w-[32rem] rounded-full bg-neo-electric/15 blur-3xl delay-1000" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neo-sunrise/10 blur-3xl" />
      </div>

      <section className="relative grid gap-16 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-20">
        <div className="space-y-10">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-gradient-to-r from-white/10 to-white/5 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-neo-electric animate-pulse" />
            ИИ‑бот для госзакупок
          </div>
          <h1 className="font-display text-5xl leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            Секунды вместо часов: ИИ‑бот подбирает КТРУ и характеристики за вас
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-white/80">
            Опишите закупку простыми словами — ИИ‑бот найдёт КТРУ по 44‑ФЗ и 223‑ФЗ, уточнит
            обязательные параметры и проверит ОКПД2.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="#chat"
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-cta px-8 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(255,95,141,0.4)] transition-all hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(255,95,141,0.6)] hover:scale-[1.02]"
            >
              <span className="relative z-10">💬 Попробовать бесплатно</span>
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center justify-center rounded-2xl border-2 border-white/30 bg-white/5 px-8 py-5 text-base font-semibold text-white backdrop-blur-md transition-all hover:border-neo-electric hover:bg-white/10 hover:text-neo-electric hover:shadow-[0_0_30px_rgba(0,231,255,0.3)]"
            >
              Как это работает
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-2.5 rounded-xl border border-neo-electric/40 bg-gradient-to-r from-neo-electric/20 to-neo-electric/10 px-5 py-2.5 text-sm font-semibold text-neo-electric backdrop-blur-sm">
              ⚡ Бесплатно
            </span>
            <span className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 backdrop-blur-sm">
              🛡️ Без регистрации
            </span>
            <span className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 backdrop-blur-sm">
              🧠 Актуальная база КТРУ
            </span>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-10 shadow-[0_20px_60px_rgba(0,231,255,0.15)] backdrop-blur-xl lg:p-12">
          <div className="absolute inset-0 bg-gradient-hero opacity-20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,47,255,0.3),transparent_70%)]" />
          <div className="relative space-y-8">
            <h2 className="font-display text-3xl font-bold text-white">Что умеет ИИ‑бот</h2>
            <ul className="space-y-5 text-base leading-relaxed text-white/85">
              <li className="flex items-start gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 text-2xl backdrop-blur-sm">
                  🎯
                </span>
                <span>Находит релевантные коды КТРУ под ваш запрос и предлагает альтернативы</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-2xl backdrop-blur-sm">
                  🧾
                </span>
                <span>Уточняет характеристики и выделяет обязательные параметры</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-2xl backdrop-blur-sm">
                  🛰️
                </span>
                <span>Проверяет соответствие ОКПД2 и подсвечивает риски до подачи заявки</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="audience" className="space-y-12">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neo-electric">
            Для кого
          </p>
          <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            ИИ‑бот помогает всем участникам закупки
          </h2>
        </header>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {audience.map((item, index) => (
            <div
              key={item.title}
              className="group relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:-translate-y-2 hover:border-neo-electric/50 hover:shadow-[0_30px_80px_rgba(0,231,255,0.2)]"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-neo-electric/30 to-neo-glow/30 blur-3xl transition-all group-hover:scale-150 group-hover:opacity-60" />
              <div className="relative space-y-4">
                <div className="text-4xl">{item.icon}</div>
                <h3 className="font-display text-2xl font-bold">{item.title}</h3>
                <p className="text-base leading-relaxed text-white/75">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="space-y-12">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neo-electric">Процесс</p>
          <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Как ИИ‑бот работает с вашим запросом
          </h2>
        </header>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-8 text-base shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-neo-electric/50 hover:shadow-[0_30px_80px_rgba(0,231,255,0.15)]"
            >
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-white/30 bg-gradient-to-br from-neo-electric/20 to-neo-glow/20 font-display text-2xl font-bold text-white backdrop-blur-sm transition-all group-hover:scale-110 group-hover:border-neo-electric group-hover:bg-neo-electric/30">
                {index + 1}
              </div>
              <h3 className="font-display text-xl font-bold text-white">{step.title}</h3>
              <p className="leading-relaxed text-white/75">{step.text}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center pt-4">
          <Link
            href="#chat"
            className="group inline-flex items-center gap-3 rounded-2xl border-2 border-neo-electric bg-gradient-to-r from-neo-electric/20 to-neo-electric/10 px-8 py-4 text-base font-semibold text-neo-electric backdrop-blur-md transition-all hover:from-neo-electric/30 hover:to-neo-electric/20 hover:shadow-[0_0_40px_rgba(0,231,255,0.4)]"
          >
            <span>Попробовать сейчас</span>
            <span className="text-xl transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

      <section className="space-y-12">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neo-electric">Решаем проблемы</p>
          <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Решаем реальные задачи из практики
          </h2>
        </header>
        <div className="grid gap-6 lg:grid-cols-2">
          {painSolutions.map((item) => (
            <div
              key={item.pain}
              className="group relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-neo-sunrise/50 hover:shadow-[0_30px_80px_rgba(255,95,141,0.15)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-neo-sunrise/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-neo-sunrise">
                  Боль
                </p>
                <h3 className="mt-3 font-display text-2xl font-bold text-white">{item.pain}</h3>
                <div className="mt-6 flex items-start gap-3">
                  <span className="mt-1 text-2xl">→</span>
                  <p className="text-base leading-relaxed text-white/80">{item.solution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center pt-4">
          <Link
            href="#chat"
            className="group inline-flex items-center gap-3 rounded-2xl border-2 border-neo-sunrise bg-gradient-to-r from-neo-sunrise/20 to-neo-sunrise/10 px-8 py-4 text-base font-semibold text-neo-sunrise backdrop-blur-md transition-all hover:from-neo-sunrise/30 hover:to-neo-sunrise/20 hover:shadow-[0_0_40px_rgba(255,95,141,0.4)]"
          >
            <span>Решить вашу задачу</span>
            <span className="text-xl transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

      <section className="space-y-12">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neo-electric">Что внутри</p>
          <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Технологии и возможности ИИ‑бота
          </h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature}
              className="group flex items-center gap-4 rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-6 text-base shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-neo-electric/50 hover:shadow-[0_30px_80px_rgba(0,231,255,0.15)]"
            >
              <span className="text-2xl text-neo-electric transition-transform group-hover:scale-125">✶</span>
              <span className="font-medium text-white/85">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-12">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neo-electric">FAQ</p>
          <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Часто задаваемые вопросы
          </h2>
        </header>
        <div className="space-y-4">
          {faq.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:border-neo-electric/50 open:border-neo-electric/50"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-lg font-semibold text-white">
                {item.question}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neo-electric/20 text-2xl font-light text-neo-electric transition-transform group-open:rotate-45 group-open:bg-neo-electric/30">
                  +
                </span>
              </summary>
              <p className="mt-4 text-base leading-relaxed text-white/75">{item.answer}</p>
            </details>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-3xl border-2 border-neo-electric/50 bg-gradient-to-br from-neo-electric/20 via-neo-glow/10 to-neo-sunrise/10 p-12 text-center shadow-[0_0_60px_rgba(0,231,255,0.3)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
          <div className="relative space-y-6">
            <h3 className="font-display text-3xl font-bold text-white sm:text-4xl">Готовы попробовать?</h3>
            <p className="mx-auto max-w-2xl text-lg text-white/90">Начните прямо сейчас — это бесплатно и займёт меньше минуты</p>
            <Link
              href="#chat"
              className="inline-flex items-center gap-3 rounded-2xl bg-gradient-cta px-10 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(255,95,141,0.5)] transition-all hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(255,95,141,0.7)] hover:scale-[1.02]"
            >
              <span>💬 Начать чат с ботом</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="feedback" className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neo-electric">Связаться</p>
          <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Внедрение ИИ‑бота в вашу компанию
          </h2>
          <p className="text-xl leading-relaxed text-white/80">
            Оставьте заявку — обсудим внедрение бота под ваши процессы
          </p>
        </div>
        <FeedbackForm />
      </section>


      <div id="chat">
        <ChatWidget />
      </div>
    </main>
  );
}

import Link from "next/link";
import { ChatWidget } from "@/components/chat-widget";
import { FeedbackForm } from "@/components/feedback-form";

const audience = [
  {
    title: "Инициаторы",
    description:
      "Скиньте описание закупки — Семён найдёт КТРУ, характеристики и подсветит риски сразу.",
    icon: "💡",
  },
  {
    title: "Технические специалисты",
    description:
      "Меньше рутины: бот уточнит требования и соберёт шаблон ТЗ вместо вас.",
    icon: "🛠️",
  },
  {
    title: "Специалисты по закупкам",
    description:
      "Актуальные классификаторы, контроль соответствия ОКПД ↔ КТРУ и журнал проверок.",
    icon: "📊",
  },
];

const steps = [
  {
    title: "Описываете потребность",
    text: "Например: нужен монитор 24'' для школы, 10 штук.",
  },
  {
    title: "Семён уточняет детали",
    text: "Спрашивает критичные параметры и проверяет, не пропустили ли важное.",
  },
  {
    title: "Получаете КТРУ + ТЗ",
    text: "Список кодов, характеристики и подсказки по ОКПД и НМЦК.",
  },
  {
    title: "Экспортируете и идёте в закупку",
    text: "Сохраняете ответ, прикрепляете к заявке или рассылаете поставщикам.",
  },
];

const painSolutions = [
  {
    pain: "Тратите часы на подбор КТРУ",
    solution: "ИИ-алгоритм сканирует классификатор и предлагает лучшие совпадения.",
  },
  {
    pain: "Каждый отдел собирает ТЗ по-своему",
    solution: "Готовые шаблоны и контроль обязательных характеристик.",
  },
  {
    pain: "ЕИС отклоняет из‑за несоответствия ОКПД",
    solution: "Семён сверяет соответствие и подсвечивает расхождения до отправки.",
  },
  {
    pain: "НМЦК считаете вручную",
    solution: "Скоро — автоматический расчёт по КП и рыночным данным.",
  },
];

const testimonials = [
  {
    quote:
      "Отдел госзаказа занят. Семён за пару минут выдал коды и характеристики — удобно",
    role: "Инициатор, сфера культуры",
  },
  {
    quote:
      "Закидываю описание монитора — бот сам подбирает код и проверяет параметры. Наконец-то можно заниматься основной работой",
    role: "Главный энергетик",
  },
  {
    quote:
      "ОКПД в ЕИС теперь совпадает. Не стопоримся на оплате, меньше возвратов",
    role: "Закупщик, ГБУ МОК КВД",
  },
];

const features = [
  "Актуальная база КТРУ и ОКПД с обновлениями",
  "Шаблоны ТЗ и подсказки по обязательным характеристикам",
  "История диалога и экспорт ответов в CSV",
  "Контроль соответствия и подсветка рисков",
];

const faq = [
  {
    question: "Как быстро отвечает Семён?",
    answer:
      "Обычно 5–15 секунд. Если нагрузка выше — покажем индикатор ожидания и отправим уведомление в чате.",
  },
  {
    question: "Нужно ли что-то устанавливать?",
    answer: "Нет, всё работает прямо в браузере, без регистрации и лишних форм.",
  },
  {
    question: "Откуда берутся данные?",
    answer:
      "Используем официальные классификаторы КТРУ и ОКПД, обновляем по расписанию и дополняем своими чек-листами.",
  },
  {
    question: "Это бесплатно?",
    answer: "Да, пилот для участников госзакупок бесплатен. Главное — поделиться обратной связью.",
  },
  {
    question: "Насколько точные ответы?",
    answer:
      "Семён предлагает лучшие варианты, но финальную проверку и выбор кода делает специалист.",
  },
];

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-24 px-6 pb-32 pt-16 md:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-float absolute -left-24 top-16 h-72 w-72 rounded-full bg-neo-glow/20 blur-3xl" />
        <div className="animate-float absolute -right-20 bottom-32 h-80 w-80 rounded-full bg-neo-electric/20 blur-3xl delay-1000" />
      </div>

      <section className="grid gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-wide text-white/70">
            ИИ-бот для госзакупок
          </span>
          <h1 className="font-display text-4xl leading-tight md:text-5xl lg:text-6xl">
            Секунды вместо часов: Семён подбирает КТРУ и характеристики за вас
          </h1>
          <p className="max-w-xl text-lg text-white/75">
            Опишите закупку по-человечески — Семён найдёт КТРУ по 44-ФЗ и 223-ФЗ, уточнит
            обязательные параметры, проверит ОКПД и подготовит шаблон ТЗ.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="#chat"
              className="inline-flex items-center justify-center rounded-full bg-gradient-cta px-8 py-3 text-base font-semibold text-neo-night shadow-neon transition hover:-translate-y-1 hover:shadow-neon-soft"
            >
              Написать в чат
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-3 text-base font-semibold text-white transition hover:border-neo-electric hover:text-neo-electric"
            >
              Как это работает
            </Link>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-white/60">
            <span className="flex items-center gap-2">⚡ Бесплатно</span>
            <span className="flex items-center gap-2">🛡️ Без регистрации</span>
            <span className="flex items-center gap-2">🧠 Обновляемая база КТРУ</span>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-neon-soft backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-hero opacity-30" />
          <div className="relative space-y-6">
            <h2 className="font-display text-2xl">Что умеет Семён</h2>
            <ul className="space-y-4 text-sm text-white/75">
              <li className="flex items-start gap-3">
                <span className="mt-1 text-lg">🎯</span>
                Находит точные коды КТРУ под ваш запрос и показывает альтернативы
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-lg">🧾</span>
                Собирает характеристики и оформляет техзадание в структурированном виде
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-lg">🛰️</span>
                Следит за соответствием ОКПД и подсвечивает риски до подачи заявки
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-lg">📦</span>
                Готовится к интеграции с расчётом НМЦК и запросом КП у поставщиков
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="audience" className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">
            Для кого
          </p>
          <h2 className="font-display text-3xl md:text-4xl">Семён выручает всех участников закупки</h2>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {audience.map((item) => (
            <div
              key={item.title}
              className="group relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-neon-soft backdrop-blur-xl transition hover:-translate-y-2 hover:border-neo-electric/60"
            >
              <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-neo-electric/20 blur-2xl transition group-hover:bg-neo-glow/40" />
              <div className="relative space-y-3">
                <span className="text-3xl">{item.icon}</span>
                <h3 className="font-display text-xl">{item.title}</h3>
                <p className="text-sm text-white/70">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Процесс</p>
          <h2 className="font-display text-3xl md:text-4xl">Как Семён работает с вашим запросом</h2>
        </header>
        <div className="grid gap-6 md:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70 shadow-neon-soft backdrop-blur-xl"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 font-display text-lg text-white/80">
                0{index + 1}
              </span>
              <h3 className="font-display text-lg text-white">{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Закрываем боли</p>
          <h2 className="font-display text-3xl md:text-4xl">Решаем задачи из реальных кастдевов</h2>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          {painSolutions.map((item) => (
            <div
              key={item.pain}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-neon-soft backdrop-blur-xl"
            >
              <p className="text-sm uppercase tracking-[0.3em] text-neo-electric">
                Боль
              </p>
              <h3 className="mt-2 font-display text-xl">{item.pain}</h3>
              <p className="mt-4 text-sm text-white/70">{item.solution}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Отзывы</p>
          <h2 className="font-display text-3xl md:text-4xl">Цитаты из интервью</h2>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <figure
              key={item.quote}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-neon-soft backdrop-blur-xl"
            >
              <blockquote className="text-sm text-white/80">“{item.quote}”</blockquote>
              <figcaption className="text-xs uppercase tracking-wider text-white/50">
                {item.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Что внутри</p>
          <h2 className="font-display text-3xl md:text-4xl">Технологии и возможности Семёна</h2>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/75 shadow-neon-soft backdrop-blur-xl"
            >
              <span className="mt-1 text-lg text-neo-electric">✶</span>
              {feature}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">FAQ</p>
          <h2 className="font-display text-3xl md:text-4xl">Вопросы, которые задают чаще всего</h2>
        </header>
        <div className="space-y-4">
          {faq.map((item) => (
            <details
              key={item.question}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 shadow-neon-soft backdrop-blur-xl"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-lg text-white">
                {item.question}
                <span className="text-xl text-neo-electric transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-sm text-white/70">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="feedback" className="grid gap-10 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Связаться</p>
          <h2 className="font-display text-3xl md:text-4xl">
            Хотите внедрить Семёна или попробовать на своём кейсе?
          </h2>
          <p className="text-sm text-white/70">
            Расскажите, что планируете автоматизировать. Отправим сценарии запуска, подключим пилот и поможем с обучением команды.
          </p>
          <ul className="space-y-2 text-sm text-white/60">
            <li>• Пилот бесплатно для команд госзакупок</li>
            <li>• Поддержка через Telegram и email</li>
            <li>• SLA ответа — до 1 рабочего дня</li>
          </ul>
        </div>
        <FeedbackForm />
      </section>

      <footer className="border-t border-white/10 pt-10 text-sm text-white/50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Робот Семён. Все права защищены.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="mailto:team@semion.ai" className="hover:text-neo-electric">
              team@semion.ai
            </Link>
            <Link href="https://t.me/semion_support" className="hover:text-neo-electric">
              Telegram поддержка
            </Link>
            <span>Политика конфиденциальности</span>
          </div>
        </div>
      </footer>

      <div id="chat">
        <ChatWidget />
      </div>
    </main>
  );
}

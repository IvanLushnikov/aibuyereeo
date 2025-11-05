import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://semion.ai"),
  title: {
    default: "Робот Семён — ИИ-помощник по подбору КТРУ",
    template: "%s | Робот Семён",
  },
  description:
    "Робот Семён подбирает коды КТРУ по 44‑ФЗ и 223‑ФЗ за секунды: чат, шаблоны ТЗ и контроль соответствия ОКПД.",
  openGraph: {
    title: "Робот Семён — подбор КТРУ за секунды",
    description:
      "ИИ‑агент для инициаторов, техспециалистов и закупщиков. Бесплатно, без регистрации, прямо в браузере.",
    url: "https://semion.ai",
    siteName: "Робот Семён",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Робот Семён — ИИ-помощник по КТРУ",
    description:
      "Секунды вместо часов: ИИ‑агент подбирает КТРУ и характеристики для госзакупок.",
  },
  icons: {
    icon: "/favicon.ico",
  },
  keywords: [
    "КТРУ",
    "44-ФЗ",
    "223-ФЗ",
    "госзакупки",
    "подбор кодов",
    "ИИ помощник",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${inter.variable} ${manrope.variable} bg-neo-night text-white antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

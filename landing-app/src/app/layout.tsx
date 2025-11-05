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
    default: "ИИ-бот для госзакупок — подбор КТРУ за секунды",
    template: "%s | ИИ-бот для госзакупок",
  },
  description:
    "ИИ-бот подбирает коды КТРУ по 44‑ФЗ и 223‑ФЗ за секунды: чат, шаблоны ТЗ и контроль соответствия ОКПД.",
  openGraph: {
    title: "ИИ-бот для госзакупок — подбор КТРУ за секунды",
    description:
      "ИИ‑агент для инициаторов, техспециалистов и закупщиков. Бесплатно, без регистрации, прямо в браузере.",
    url: "https://semion.ai",
    siteName: "ИИ-бот для госзакупок",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ИИ-бот для госзакупок — подбор КТРУ",
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

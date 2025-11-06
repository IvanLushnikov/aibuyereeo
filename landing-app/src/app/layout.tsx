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
    default: "ИИ‑бот для госзакупок — подбор КТРУ за секунды",
    template: "%s | ИИ‑бот для госзакупок",
  },
  description:
    "ИИ‑бот подбирает код КТРУ по 44‑ФЗ и 223‑ФЗ за секунды: чат и быстрый результат.",
  openGraph: {
    title: "ИИ‑бот для госзакупок — подбор КТРУ за секунды",
    description:
      "ИИ‑бот для инициаторов, техспециалистов и закупщиков. Бесплатно, без регистрации, прямо в браузере.",
    url: "https://semion.ai",
    siteName: "ИИ‑бот для госзакупок",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ИИ‑бот для госзакупок — подбор КТРУ за секунды",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ИИ‑бот для госзакупок — подбор КТРУ",
    description:
      "Секунды вместо часов: ИИ‑бот подбирает код КТРУ за вас.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  keywords: [
    "КТРУ",
    "44‑ФЗ",
    "223‑ФЗ",
    "госзакупки",
    "подбор кодов",
    "ИИ‑бот",
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
        {/* Автовосстановление при ошибке загрузки чанка (например, после деплоя) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var handled=false;
                function reload(){ if(handled) return; handled=true; try{ sessionStorage.setItem('last_reload', String(Date.now())); }catch(e){} window.location.reload(); }
                window.addEventListener('error', function(e){
                  var msg = (e && e.message) || '';
                  if (/ChunkLoadError|Loading chunk \d+ failed/i.test(msg)) { reload(); }
                });
                window.addEventListener('unhandledrejection', function(e){
                  var msg = (e && e.reason && e.reason.message) || '';
                  if (/ChunkLoadError|Loading chunk \d+ failed/i.test(msg)) { reload(); }
                });
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}

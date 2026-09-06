import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { MATH_LINE_BREAKS_INLINE_SCRIPT } from "@/lib/math-line-breaks";

// Единая гарнитура сайта — Montserrat (variable font, все веса). Логотип
// «ШБЗШкола» берёт её же через --font-logo с весом 900.
const montserrat = Montserrat({ subsets: ["latin", "cyrillic"], variable: "--font-logo" });

export const metadata: Metadata = {
  title: {
    default: "ШБЗ Школа",
    template: "%s — ШБЗ Школа"
  },
  applicationName: "ШБЗ Школа",
  description: "Платформа ШБЗ Школы: общие темы и материалы, индивидуальный прогресс и домашние задания учеников.",
  openGraph: {
    title: "ШБЗ Школа",
    siteName: "ШБЗ Школа",
    description: "Платформа ШБЗ Школы: общие темы и материалы, индивидуальный прогресс и домашние задания учеников.",
    locale: "ru_RU",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  // Ключи переименованы tutorflow-* → shbz-*; старые читаются как фолбэк,
                  // чтобы настройки интерфейса не сбросились после переезда бренда.
                  const storedTheme = localStorage.getItem("shbz-theme") || localStorage.getItem("tutorflow-theme") || "system";
                  const storedHints = localStorage.getItem("shbz-hints") || localStorage.getItem("tutorflow-hints") || "off";
                  const storedDensity = localStorage.getItem("shbz-density") || localStorage.getItem("tutorflow-density") || "comfortable";
                  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  const resolvedTheme = storedTheme === "system" ? (prefersDark ? "dark" : "light") : storedTheme;
                  document.documentElement.dataset.themeMode = storedTheme;
                  document.documentElement.dataset.theme = resolvedTheme;
                  document.documentElement.dataset.hints = storedHints === "on" ? "on" : "off";
                  document.documentElement.dataset.density = storedDensity === "compact" ? "compact" : "comfortable";
                } catch {
                  document.documentElement.dataset.themeMode = "system";
                  document.documentElement.dataset.theme = "light";
                  document.documentElement.dataset.hints = "off";
                  document.documentElement.dataset.density = "comfortable";
                }
              })();
            `
          }}
        />
        {/* Математический перенос формул (lib/math-line-breaks.ts): чистый JS
            инлайном — прод-CSP разрешает 'unsafe-inline', но не 'unsafe-eval'. */}
        <script dangerouslySetInnerHTML={{ __html: MATH_LINE_BREAKS_INLINE_SCRIPT }} />
      </head>
      <body className={`${montserrat.className} ${montserrat.variable}`}>{children}</body>
    </html>
  );
}

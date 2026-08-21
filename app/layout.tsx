import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Montserrat, Onest } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const onest = Onest({ subsets: ["latin", "cyrillic"] });
// Шрифт логотипа «ШБЗШкола»: только вес 900, отдаётся CSS-переменной --font-logo.
const montserrat = Montserrat({ subsets: ["latin", "cyrillic"], weight: "900", variable: "--font-logo" });

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
      </head>
      <body className={`${onest.className} ${montserrat.variable}`}>{children}</body>
    </html>
  );
}

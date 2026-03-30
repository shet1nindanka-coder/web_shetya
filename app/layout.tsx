import type { ReactNode } from "react";
import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "TutorFlow",
  description: "Платформа для репетитора с общими темами, файлами и индивидуальным прогрессом учеников."
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
                  const storedTheme = localStorage.getItem("tutorflow-theme") || "system";
                  const storedHints = localStorage.getItem("tutorflow-hints") || "on";
                  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  const resolvedTheme = storedTheme === "system" ? (prefersDark ? "dark" : "light") : storedTheme;
                  document.documentElement.dataset.themeMode = storedTheme;
                  document.documentElement.dataset.theme = resolvedTheme;
                  document.documentElement.dataset.hints = storedHints === "off" ? "off" : "on";
                } catch {
                  document.documentElement.dataset.themeMode = "system";
                  document.documentElement.dataset.theme = "light";
                  document.documentElement.dataset.hints = "on";
                }
              })();
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

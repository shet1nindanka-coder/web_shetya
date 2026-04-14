import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

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
                  const storedHints = localStorage.getItem("tutorflow-hints") || "off";
                  const storedDensity = localStorage.getItem("tutorflow-density") || "comfortable";
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
      <body className={inter.className}>{children}</body>
    </html>
  );
}

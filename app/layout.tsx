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
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

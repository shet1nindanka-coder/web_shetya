"use client";

import { useEffect, useMemo, useState } from "react";

type ThemeMode = "system" | "light" | "dark";
type HintsMode = "on" | "off";

const THEME_STORAGE_KEY = "tutorflow-theme";
const HINTS_STORAGE_KEY = "tutorflow-hints";

function getPreferredTheme(themeMode: ThemeMode) {
  if (themeMode !== "system") {
    return themeMode;
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function applyPreferences(themeMode: ThemeMode, hintsMode: HintsMode) {
  const root = document.documentElement;
  const resolvedTheme = getPreferredTheme(themeMode);

  root.dataset.themeMode = themeMode;
  root.dataset.theme = resolvedTheme;
  root.dataset.hints = hintsMode;
}

export function InterfaceSettingsPanel() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [hintsMode, setHintsMode] = useState<HintsMode>("on");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const storedHints = window.localStorage.getItem(HINTS_STORAGE_KEY);

    const nextTheme =
      storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
    const nextHints = storedHints === "off" ? "off" : "on";

    setThemeMode(nextTheme);
    setHintsMode(nextHints);
    applyPreferences(nextTheme, nextHints);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    window.localStorage.setItem(HINTS_STORAGE_KEY, hintsMode);
    applyPreferences(themeMode, hintsMode);

    if (themeMode !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyPreferences("system", hintsMode);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode, hintsMode]);

  const effectiveThemeLabel = useMemo(() => {
    switch (getPreferredTheme(themeMode)) {
      case "dark":
        return "Сейчас активна темная тема";
      case "light":
      default:
        return "Сейчас активна светлая тема";
    }
  }, [themeMode]);

  return (
    <section className="ui-fade-slide ui-surface rounded-[22px] border border-slate-200/80 bg-white/94 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)] sm:rounded-[24px] sm:p-5 lg:rounded-[28px] lg:p-6">
      <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-4">
        <h2 className="font-display text-[1.35rem] font-semibold text-slate-950 sm:text-[1.5rem] lg:text-[1.65rem]">
          Интерфейс
        </h2>
        <p className="ui-hint max-w-2xl text-sm leading-6 text-slate-500">
          Эти настройки меняют внешний вид сайта на текущем устройстве и помогают убрать лишнюю нагрузку из
          интерфейса.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-medium text-slate-700">Тема</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { value: "system", label: "Как на устройстве" },
              { value: "light", label: "Светлая" },
              { value: "dark", label: "Темная" }
            ].map((option) => {
              const isActive = themeMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setThemeMode(option.value as ThemeMode)}
                  aria-pressed={isActive}
                  className={`ui-pressable rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="ui-hint mt-3 text-sm leading-6 text-slate-500">{effectiveThemeLabel}.</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-medium text-slate-700">Подсказки</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { value: "on", label: "Включены" },
              { value: "off", label: "Скрыты" }
            ].map((option) => {
              const isActive = hintsMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHintsMode(option.value as HintsMode)}
                  aria-pressed={isActive}
                  className={`ui-pressable rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="ui-hint mt-3 text-sm leading-6 text-slate-500">
            В режиме без подсказок скрываются второстепенные описания, helper-тексты и пояснения.
          </p>
        </div>
      </div>
    </section>
  );
}

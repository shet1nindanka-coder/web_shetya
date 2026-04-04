"use client";

import { useEffect, useMemo, useState } from "react";

type ThemeMode = "system" | "light" | "dark";
type HintsMode = "on" | "off";
type DensityMode = "comfortable" | "compact";

const THEME_STORAGE_KEY = "tutorflow-theme";
const HINTS_STORAGE_KEY = "tutorflow-hints";
const DENSITY_STORAGE_KEY = "tutorflow-density";

function getPreferredTheme(themeMode: ThemeMode) {
  if (themeMode !== "system") {
    return themeMode;
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function applyPreferences(themeMode: ThemeMode, hintsMode: HintsMode, densityMode: DensityMode) {
  const root = document.documentElement;
  const resolvedTheme = getPreferredTheme(themeMode);

  root.dataset.themeMode = themeMode;
  root.dataset.theme = resolvedTheme;
  root.dataset.hints = hintsMode;
  root.dataset.density = densityMode;
}

export function InterfaceSettingsPanel() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [hintsMode, setHintsMode] = useState<HintsMode>("on");
  const [densityMode, setDensityMode] = useState<DensityMode>("comfortable");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const storedHints = window.localStorage.getItem(HINTS_STORAGE_KEY);
    const storedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY);

    const nextTheme =
      storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
    const nextHints = storedHints === "off" ? "off" : "on";
    const nextDensity = storedDensity === "compact" ? "compact" : "comfortable";

    setThemeMode(nextTheme);
    setHintsMode(nextHints);
    setDensityMode(nextDensity);
    applyPreferences(nextTheme, nextHints, nextDensity);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    window.localStorage.setItem(HINTS_STORAGE_KEY, hintsMode);
    window.localStorage.setItem(DENSITY_STORAGE_KEY, densityMode);
    applyPreferences(themeMode, hintsMode, densityMode);

    if (themeMode !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyPreferences("system", hintsMode, densityMode);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode, hintsMode, densityMode]);

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
    <section className="ui-fade-slide ui-surface rounded-[22px] border p-4 sm:rounded-[24px] sm:p-5 lg:rounded-[28px] lg:p-6">
      <div className="mb-4 flex flex-col gap-2 border-b pb-4">
        <h2 className="font-display text-[1.35rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.5rem] lg:text-[1.65rem]">
          Интерфейс
        </h2>
        <p className="ui-hint ui-copy-muted max-w-2xl text-sm leading-6">
          Эти настройки меняют внешний вид сайта на текущем устройстве и помогают убрать лишнюю нагрузку из
          интерфейса.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="ui-card-soft rounded-[24px] p-4">
          <p className="text-sm font-medium text-[var(--theme-text-default)]">Тема</p>
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
                  className={`ui-pressable rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "ui-button-tonal"
                      : "ui-button-secondary"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="ui-hint ui-copy-muted mt-3 text-sm leading-6">{effectiveThemeLabel}.</p>
        </div>

        <div className="ui-card-soft rounded-[24px] p-4">
          <p className="text-sm font-medium text-[var(--theme-text-default)]">Подсказки</p>
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
                  className={`ui-pressable rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "ui-button-tonal"
                      : "ui-button-secondary"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="ui-hint ui-copy-muted mt-3 text-sm leading-6">
            В режиме без подсказок скрываются второстепенные описания, helper-тексты и пояснения.
          </p>
        </div>

        <div className="ui-card-soft rounded-[24px] p-4">
          <p className="text-sm font-medium text-[var(--theme-text-default)]">Плотность интерфейса</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { value: "comfortable", label: "Обычный" },
              { value: "compact", label: "Компактный" }
            ].map((option) => {
              const isActive = densityMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDensityMode(option.value as DensityMode)}
                  aria-pressed={isActive}
                  className={`ui-pressable rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "ui-button-tonal"
                      : "ui-button-secondary"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="ui-hint ui-copy-muted mt-3 text-sm leading-6">
            Компактный режим уменьшает отступы, карточки и табы, чтобы на экране помещалось больше рабочих блоков.
          </p>
        </div>
      </div>
    </section>
  );
}

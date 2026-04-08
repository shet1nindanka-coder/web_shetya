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

  const themeOptions: Array<{ value: ThemeMode; label: string; caption: string }> = [
    { value: "system", label: "Системная", caption: "как на устройстве" },
    { value: "light", label: "Светлая", caption: "дневной режим" },
    { value: "dark", label: "Темная", caption: "вечерний режим" }
  ];

  const hintsOptions: Array<{ value: HintsMode; label: string; caption: string }> = [
    { value: "on", label: "Включены", caption: "больше пояснений" },
    { value: "off", label: "Скрыты", caption: "меньше шума" }
  ];

  const densityOptions: Array<{ value: DensityMode; label: string; caption: string }> = [
    { value: "comfortable", label: "Обычный", caption: "больше воздуха" },
    { value: "compact", label: "Компактный", caption: "больше на экране" }
  ];

  return (
    <section className="ui-fade-slide ui-surface rounded-[18px] border p-4 sm:rounded-[20px] sm:p-5 lg:rounded-[22px] lg:p-6">
      <div className="mb-4 flex flex-col gap-2 border-b pb-4">
        <h2 className="font-display text-[1.35rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.5rem] lg:text-[1.65rem]">
          Интерфейс
        </h2>
        <p className="ui-hint ui-copy-muted max-w-2xl text-sm leading-6">Тема, подсказки и плотность на этом устройстве.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr_0.95fr]">
        <div className="ui-settings-card rounded-[18px] p-4 sm:rounded-[20px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="ui-kicker">Тема</p>
              <p className="ui-hint ui-copy-muted mt-2 text-sm leading-6">Светлая, темная или системная.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const isActive = themeMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setThemeMode(option.value)}
                  aria-pressed={isActive}
                  className={`ui-settings-option ui-pressable rounded-[14px] px-3.5 py-3 text-left text-sm transition ${
                    isActive ? "ui-button-tonal" : "ui-button-secondary"
                  }`}
                >
                  <span className="ui-settings-option-copy">
                    <span className="font-medium">{option.label}</span>
                    <span className="ui-hint mt-1 text-xs text-[var(--theme-text-muted)]">{option.caption}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="ui-hint ui-copy-muted mt-auto pt-4 text-sm leading-6">{effectiveThemeLabel}.</p>
        </div>

        <div className="ui-settings-card rounded-[18px] p-4 sm:rounded-[20px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="ui-kicker">Подсказки</p>
              <p className="ui-hint ui-copy-muted mt-2 text-sm leading-6">Подробные пояснения по интерфейсу.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {hintsOptions.map((option) => {
              const isActive = hintsMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHintsMode(option.value)}
                  aria-pressed={isActive}
                  className={`ui-settings-option ui-pressable rounded-[14px] px-3.5 py-3 text-left text-sm transition ${
                    isActive ? "ui-button-tonal" : "ui-button-secondary"
                  }`}
                >
                  <span className="ui-settings-option-copy">
                    <span className="font-medium">{option.label}</span>
                    <span className="ui-hint mt-1 text-xs text-[var(--theme-text-muted)]">{option.caption}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ui-settings-card rounded-[18px] p-4 sm:rounded-[20px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="ui-kicker">Плотность</p>
              <p className="ui-hint ui-copy-muted mt-2 text-sm leading-6">Больше воздуха или больше контента на экране.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {densityOptions.map((option) => {
              const isActive = densityMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDensityMode(option.value)}
                  aria-pressed={isActive}
                  className={`ui-settings-option ui-pressable rounded-[14px] px-3.5 py-3 text-left text-sm transition ${
                    isActive ? "ui-button-tonal" : "ui-button-secondary"
                  }`}
                >
                  <span className="ui-settings-option-copy">
                    <span className="font-medium">{option.label}</span>
                    <span className="ui-hint mt-1 text-xs text-[var(--theme-text-muted)]">{option.caption}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

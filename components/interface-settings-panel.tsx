"use client";

import { useEffect, useState } from "react";

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

type SettingBlockProps = {
  label: string;
  hint: string;
  children: React.ReactNode;
};

function SettingBlock({ label, hint, children }: SettingBlockProps) {
  return (
    <div className="shbz-panel-soft p-5">
      <div className="mb-3.5 text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
        {label}
      </div>
      {children}
      <div className="ui-hint mt-3 text-[12.5px] leading-[1.5]" style={{ color: "var(--shbz-kicker)" }}>
        {hint}
      </div>
    </div>
  );
}

export function InterfaceSettingsPanel() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [hintsMode, setHintsMode] = useState<HintsMode>("off");
  const [densityMode, setDensityMode] = useState<DensityMode>("comfortable");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const storedHints = window.localStorage.getItem(HINTS_STORAGE_KEY);
    const storedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY);

    const nextTheme =
      storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
    const nextHints = storedHints === "on" ? "on" : "off";
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

  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: "system", label: "Системная" },
    { value: "light", label: "Светлая" },
    { value: "dark", label: "Тёмная" }
  ];

  const hintsOptions: Array<{ value: HintsMode; label: string }> = [
    { value: "on", label: "Включены" },
    { value: "off", label: "Скрыты" }
  ];

  const densityOptions: Array<{ value: DensityMode; label: string }> = [
    { value: "comfortable", label: "Обычный" },
    { value: "compact", label: "Компактный" }
  ];

  return (
    <section className="mb-11">
      <h2 className="shbz-section-title">Интерфейс</h2>
      <div className="shbz-card shbz-section-pad">
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <SettingBlock label="Тема" hint="Светлое, тёмное или системное оформление интерфейса.">
            <div className="shbz-seg shbz-seg--fill">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setThemeMode(option.value)}
                  data-active={themeMode === option.value}
                  aria-pressed={themeMode === option.value}
                  className="shbz-seg-btn"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </SettingBlock>

          <SettingBlock label="Подсказки" hint="Пояснения к настройкам под каждым блоком.">
            <div className="shbz-seg shbz-seg--fill">
              {hintsOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHintsMode(option.value)}
                  data-active={hintsMode === option.value}
                  aria-pressed={hintsMode === option.value}
                  className="shbz-seg-btn"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </SettingBlock>

          <SettingBlock label="Плотность" hint="Компактный режим уменьшает отступы карточек.">
            <div className="shbz-seg shbz-seg--fill">
              {densityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDensityMode(option.value)}
                  data-active={densityMode === option.value}
                  aria-pressed={densityMode === option.value}
                  className="shbz-seg-btn"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </SettingBlock>
        </div>
      </div>
    </section>
  );
}

"use client";

import type { CSSProperties } from "react";
import { useCountUp } from "@/lib/animation-hooks";

/*
 * A04: число серверной статистики «набирается» 600 ms при загрузке.
 * Только для цифр, которые пользователь не меняет сам (счётчики на карточках,
 * сводки) — поля ввода и счётчики выбранных номеров не анимируем.
 */
type CountUpValueProps = {
  value: number;
  decimals?: number;
  className?: string;
  style?: CSSProperties;
};

export function CountUpValue({ value, decimals = 0, className, style }: CountUpValueProps) {
  const current = useCountUp(value, 600, decimals);

  return (
    <span className={className ? `ui-num ${className}` : "ui-num"} style={style}>
      {decimals > 0 ? current.toFixed(decimals) : current}
    </span>
  );
}

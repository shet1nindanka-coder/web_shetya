import Link from "next/link";
import { cx } from "@/lib/utils";

/*
 * Лок «ШБЗШкола» — текст, не картинка. Две части в одном слове без пробела,
 * различие держит только цвет: «ШБЗ» чернилами, «Школа» фирменным.
 * Между частями нет пробела и переноса — иначе появится лишний зазор.
 * Шрифт Montserrat 900 подключён в app/layout.tsx как CSS-переменная --font-logo.
 */

export type LogoVariant = "default" | "on-dark" | "mono";

type LogoProps = {
  /** Кегль знака в px. Ниже 22 px приписка уходит в --brand-deep (мелкая версия). */
  size?: number;
  variant?: LogoVariant;
  /** Стек для квадратных мест: две строки, line-height 0.95. */
  stacked?: boolean;
  /** Ссылка на главную. Без href рендерится <span>. */
  href?: string;
  className?: string;
};

export function Logo({ size = 24, variant = "default", stacked = false, href, className }: LogoProps) {
  const classes = cx(
    "logo",
    variant === "on-dark" && "logo--on-dark",
    variant === "mono" && "logo--mono",
    size < 22 && "logo--small",
    stacked && "logo--stacked",
    className
  );
  const content = (
    <>
      <span>ШБЗ</span>
      <span className="logo__sub">Школа</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label="ШБЗ Школа" className={classes} style={{ fontSize: size }}>
        {content}
      </Link>
    );
  }

  return (
    <span aria-label="ШБЗ Школа" role="img" className={classes} style={{ fontSize: size }}>
      {content}
    </span>
  );
}

type LogoMarkProps = {
  /** Сторона плашки в px; радиус ≈ 22 %, буква ≈ 60 % стороны. */
  size?: number;
  className?: string;
};

/** Иконка: буква «Ш» из лока на фирменной плашке. Отдельный знак не рисуется. */
export function LogoMark({ size = 48, className }: LogoMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cx("logo-mark", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), fontSize: Math.round(size * 0.6) }}
    >
      Ш
    </span>
  );
}

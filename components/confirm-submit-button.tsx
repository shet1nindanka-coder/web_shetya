"use client";

import type { MouseEventHandler, ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  className: string;
  message: string;
};

export function ConfirmSubmitButton({ children, className, message }: ConfirmSubmitButtonProps) {
  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (!window.confirm(message)) {
      event.preventDefault();
    }
  };

  return (
    <button type="submit" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

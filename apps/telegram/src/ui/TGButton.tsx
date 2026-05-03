import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@tour/ui";
import styles from "./TGButton.module.css";

/** Maps to Telegram MainButton / SecondaryButton-style roles (design_system §8). */
export type TGButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export type TGButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: TGButtonVariant;
  children: ReactNode;
  className?: string;
};

const map: Record<TGButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
  ghost: styles.ghost,
};

export function TGButton({
  variant = "primary",
  className,
  type = "button",
  children,
  ...rest
}: TGButtonProps) {
  return (
    <button
      type={type}
      className={cn(styles.button, map[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

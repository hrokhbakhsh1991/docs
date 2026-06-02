import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";
import styles from "./Badge.module.css";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const variantClass: Record<BadgeVariant, string> = {
  neutral: styles.neutral,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  info: styles.info,
};

export function Badge({ variant = "neutral", className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn(styles.badge, variantClass[variant], className)} {...rest}>
      {children}
    </span>
  );
}

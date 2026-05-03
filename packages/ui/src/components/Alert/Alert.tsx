import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";
import styles from "./Alert.module.css";

export type AlertVariant = "info" | "success" | "warning" | "error";

export type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** Leading glyph when no icon system is wired (single char / emoji). */
  icon?: ReactNode;
};

const variantClass: Record<AlertVariant, string> = {
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  error: styles.error,
};

const defaultIcon: Record<AlertVariant, string> = {
  info: "i",
  success: "✓",
  warning: "!",
  error: "!",
};

export function Alert({
  variant = "info",
  title,
  children,
  icon,
  className,
  role,
  ...rest
}: AlertProps) {
  const resolvedRole = role ?? (variant === "error" ? "alert" : "status");
  const glyph = icon ?? defaultIcon[variant];

  return (
    <div className={cn(styles.alert, variantClass[variant], className)} role={resolvedRole} {...rest}>
      <span className={styles.iconSlot} aria-hidden>
        {glyph}
      </span>
      <div className={styles.content}>
        {title ? <strong className={styles.title}>{title}</strong> : null}
        {children ? <div className={styles.text}>{children}</div> : null}
      </div>
    </div>
  );
}

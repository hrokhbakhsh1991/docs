import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "../utils/cn";
import styles from "./Alert.module.css";

/** Keep in sync with `alertVariants` in `../tokens/component-token-maps.ts`. */
export const alertVariants = ["info", "success", "warning", "error"] as const;
export type AlertVariant = (typeof alertVariants)[number];

export type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
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

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { variant = "info", title, children, icon, className, role, ...rest },
  ref,
) {
  const resolvedRole = role ?? (variant === "error" ? "alert" : "status");
  const glyph = icon ?? defaultIcon[variant];

  return (
    <div
      ref={ref}
      className={cn(styles.alert, variantClass[variant], className)}
      role={resolvedRole}
      data-variant={variant}
      {...rest}
    >
      <span className={styles.iconSlot} aria-hidden>
        {glyph}
      </span>
      <div className={styles.content}>
        {title ? <strong className={styles.title}>{title}</strong> : null}
        {children ? <div className={styles.text}>{children}</div> : null}
      </div>
    </div>
  );
});

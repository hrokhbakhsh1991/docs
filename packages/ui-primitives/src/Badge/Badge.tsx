import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "../utils/cn";
import styles from "./Badge.module.css";

/** Keep in sync with `badgeVariants` in `../tokens/component-token-maps.ts`. */
export const badgeVariants = ["neutral", "success", "warning", "danger", "info"] as const;
export type BadgeVariant = (typeof badgeVariants)[number];

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

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "neutral", className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(styles.badge, variantClass[variant], className)}
      data-variant={variant}
      {...rest}
    >
      {children}
    </span>
  );
});

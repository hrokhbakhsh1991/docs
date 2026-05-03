import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@tour/ui";
import styles from "./TGStatus.module.css";
import type { TGTone } from "./types";

export type TGStatusProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  tone?: TGTone;
  children: ReactNode;
};

const toneClass: Record<TGTone, string> = {
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  neutral: styles.neutral,
};

/** Inline registration/payment/waitlist-style label (mirrors Web status chips). */
export function TGStatus({ tone = "neutral", className, children, ...rest }: TGStatusProps) {
  return (
    <span className={cn(styles.status, toneClass[tone], className)} {...rest}>
      {children}
    </span>
  );
}

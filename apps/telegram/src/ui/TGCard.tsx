import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@tour/ui";
import styles from "./TGCard.module.css";
import type { TGTone } from "./types";

export type { TGTone };

export type TGCardProps = HTMLAttributes<HTMLDivElement> & {
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

/**
 * Block container for a status or summary (maps to “Success/Warning/Danger/Info/Neutral” cards in design_system §8.1).
 */
export function TGCard({ tone = "neutral", className, children, ...rest }: TGCardProps) {
  return (
    <div className={cn(styles.card, toneClass[tone], className)} {...rest}>
      {children}
    </div>
  );
}

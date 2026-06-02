import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@tour/ui";
import styles from "./TGMessage.module.css";
import type { TGTone } from "./types";

export type TGMessageProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  /** §8.2 — equivalent to `--text-h3` */
  title?: ReactNode;
  /** Main copy — `--text-body` */
  children?: ReactNode;
  /** Support / correlation id — `--text-micro`, muted */
  footnote?: ReactNode;
  tone?: TGTone;
};

const toneClass: Record<TGTone, string> = {
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  neutral: styles.neutral,
};

/**
 * Structured content block (title / body / footnote) per design_system §8.2.
 */
export function TGMessage({
  title,
  children,
  footnote,
  tone = "neutral",
  className,
  ...rest
}: TGMessageProps) {
  return (
    <div className={cn(styles.message, toneClass[tone], className)} {...rest}>
      {title != null ? <h3 className={styles.title}>{title}</h3> : null}
      {children != null ? <div className={styles.body}>{children}</div> : null}
      {footnote != null ? <p className={styles.footnote}>{footnote}</p> : null}
    </div>
  );
}

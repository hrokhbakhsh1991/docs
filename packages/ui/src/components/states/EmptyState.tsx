import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

import styles from "./EmptyState.module.css";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
};

function DefaultEmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M7.5 10.5h9M7.5 14h5" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ title, description, action, icon, className, ...rest }: EmptyStateProps) {
  return (
    <div className={cn(styles.root, className)} role="status" {...rest}>
      <div className={styles.icon}>{icon ?? <DefaultEmptyIcon />}</div>
      <h3 className={styles.title}>{title}</h3>
      {description ? (
        <p className={styles.description}>{description}</p>
      ) : null}
      {action ? <div className={styles.actionRow}>{action}</div> : null}
    </div>
  );
}

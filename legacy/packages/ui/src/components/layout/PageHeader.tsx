import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

import styles from "./PageHeader.module.css";

export type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  /** Visible `<h1>` when non-empty */
  title?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  /** Optional subtitle shown under the title */
  description?: ReactNode;
};

export function PageHeader({ title, actions, breadcrumb, description, className, ...rest }: PageHeaderProps) {
  const hasTitle = Boolean(title?.trim());
  const showMidRow = hasTitle || description != null || actions != null;

  return (
    <header className={cn(styles.root, className)} {...rest}>
      <div className={styles.inner}>
        {breadcrumb ? <div>{breadcrumb}</div> : null}
        {showMidRow ? (
          <div className={styles.titleRow}>
            <div className={styles.titleBlock}>
              {hasTitle ? <h1 className={styles.title}>{title?.trim()}</h1> : null}
              {description ? (
                <div className={styles.description}>{description}</div>
              ) : null}
            </div>
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

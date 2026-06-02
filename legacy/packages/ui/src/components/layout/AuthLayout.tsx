import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

import styles from "./AuthLayout.module.css";

export type AuthLayoutProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  illustration?: ReactNode;
};

/**
 * Centered auth shell: narrow column for credentials card and optional illustration (desktop).
 */
export function AuthLayout({ children, illustration, className, ...rest }: AuthLayoutProps) {
  return (
    <div className={cn(styles.root, className)} {...rest}>
      <div className={cn(styles.grid, illustration ? styles.gridSplit : undefined)}>
        <div className={styles.formColumn}>{children}</div>
        {illustration ? <div className={styles.illustration}>{illustration}</div> : null}
      </div>
    </div>
  );
}

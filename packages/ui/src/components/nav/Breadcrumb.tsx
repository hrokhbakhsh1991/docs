import type { HTMLAttributes } from "react";

import { cn } from "../../utils/cn";

import styles from "./Breadcrumb.module.css";

export type BreadcrumbItem = { label: string; href?: string };

export type BreadcrumbProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items, className, ...rest }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav className={cn(styles.nav, className)} aria-label="Breadcrumb" {...rest}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className={styles.item}>
              {index > 0 ? (
                <span className={styles.sep} aria-hidden>
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <a className={styles.link} href={item.href}>
                  {item.label}
                </a>
              ) : (
                <span className={styles.current} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

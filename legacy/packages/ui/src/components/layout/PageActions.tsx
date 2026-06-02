import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

import styles from "./PageActions.module.css";

export type PageActionsProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
};

export function PageActions({ children, className, ...rest }: PageActionsProps) {
  return (
    <div className={cn(styles.row, className)} role="toolbar" aria-label="Page actions" {...rest}>
      {children}
    </div>
  );
}

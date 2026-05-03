import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "../../utils/cn";

import styles from "./Table.module.css";

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  children: ReactNode;
  /** Accessibility label for the grid */
  "aria-label"?: string;
};

export function Table({ children, className, ...rest }: TableProps) {
  return (
    <div className={styles.wrap}>
      <table className={cn(styles.table, className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...rest} />;
}

export function TableBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest} />;
}

export function TableRow({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={className} {...rest} />;
}

export function TableHeaderCell({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn(styles.th, className)} scope={rest.scope ?? "col"} {...rest} />;
}

export function TableCell({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn(styles.td, className)} {...rest} />;
}

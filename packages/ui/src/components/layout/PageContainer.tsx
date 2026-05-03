import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

import styles from "./PageContainer.module.css";

export type PageContainerProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
};

export function PageContainer({ children, className, ...rest }: PageContainerProps) {
  return (
    <div className={cn(styles.root, className)} {...rest}>
      {children}
    </div>
  );
}

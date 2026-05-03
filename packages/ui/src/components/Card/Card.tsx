import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";
import styles from "./Card.module.css";

export type CardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  children?: ReactNode;
  /** Optional header title — when set with `description` / `actions`, builds a structured card layout. */
  title?: ReactNode;
  /** Optional subtitle under the title. */
  description?: ReactNode;
  /** Rendered in a footer row (e.g. buttons). */
  actions?: ReactNode;
};

export function Card({ className, children, title, description, actions, ...rest }: CardProps) {
  const structured = title != null || description != null || actions != null;

  if (!structured) {
    return (
      <div className={cn(styles.card, className)} {...rest}>
        {children}
      </div>
    );
  }

  const showHeader = title != null || description != null;

  return (
    <div className={cn(styles.card, className)} {...rest}>
      {showHeader ? (
        <header className={styles.header}>
          {title != null ? <h2 className={styles.title}>{title}</h2> : null}
          {description != null ? <p className={styles.subtitle}>{description}</p> : null}
        </header>
      ) : null}
      {children != null ? <div className={styles.body}>{children}</div> : null}
      {actions != null ? <footer className={styles.footer}>{actions}</footer> : null}
    </div>
  );
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function CardHeader({ className, children, ...rest }: CardHeaderProps) {
  return (
    <header className={cn(styles.header, className)} {...rest}>
      {children}
    </header>
  );
}

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & { children: ReactNode };

export function CardTitle({ className, children, ...rest }: CardTitleProps) {
  return (
    <h2 className={cn(styles.title, className)} {...rest}>
      {children}
    </h2>
  );
}

export type CardSubtitleProps = HTMLAttributes<HTMLParagraphElement> & { children?: ReactNode };

export function CardSubtitle({ className, children, ...rest }: CardSubtitleProps) {
  if (children == null) return null;
  return (
    <p className={cn(styles.subtitle, className)} {...rest}>
      {children}
    </p>
  );
}

export type CardBodyProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function CardBody({ className, children, ...rest }: CardBodyProps) {
  return (
    <div className={cn(styles.body, className)} {...rest}>
      {children}
    </div>
  );
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function CardFooter({ className, children, ...rest }: CardFooterProps) {
  return (
    <footer className={cn(styles.footer, className)} {...rest}>
      {children}
    </footer>
  );
}

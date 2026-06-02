"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

import { useOptionalAppLayoutChrome } from "./AppLayoutContext";
import styles from "./AppLayout.module.css";
import { PageHeader } from "./PageHeader";

export type AppLayoutProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
};

/**
 * Workspace shell: optional page chrome (via props or `AppLayoutProvider` state) + main region + optional footer.
 */
export function AppLayout({
  children,
  className,
  title: titleProp,
  actions: actionsProp,
  breadcrumb: breadcrumbProp,
  description: descriptionProp,
  footer,
  ...rest
}: AppLayoutProps) {
  const ctx = useOptionalAppLayoutChrome();

  const title = titleProp ?? ctx?.chrome.title;
  const actions = actionsProp ?? ctx?.chrome.actions;
  const breadcrumb = breadcrumbProp ?? ctx?.chrome.breadcrumb;
  const description = descriptionProp ?? ctx?.chrome.description;

  const showHeader =
    Boolean(title?.trim()) || breadcrumb != null || actions != null || description != null;

  return (
    <div className={cn(styles.root, className)} {...rest}>
      {showHeader ? (
        <PageHeader title={title} breadcrumb={breadcrumb} actions={actions} description={description} />
      ) : null}
      <div className={styles.main}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  );
}

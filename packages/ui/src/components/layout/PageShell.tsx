"use client";

import { Component, type ErrorInfo, type HTMLAttributes, type ReactNode, Suspense, useEffect } from "react";

import { Alert } from "../Alert/Alert";

import { cn } from "../../utils/cn";

import styles from "./PageShell.module.css";

export type PageShellProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  /** When set, updates `document.title` for quick parity with route metadata */
  documentTitle?: string;
  loadingFallback?: ReactNode;
};

class LayoutSectionErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PageShell]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Alert variant="error" title="Something went wrong" role="alert">
          {this.state.error.message || "An unexpected error occurred in this section."}
        </Alert>
      );
    }
    return this.props.children;
  }
}

export function PageShell({
  children,
  className,
  documentTitle,
  loadingFallback,
  ...rest
}: PageShellProps) {
  useEffect(() => {
    if (!documentTitle) return;
    document.title = `${documentTitle} | TourOps`;
  }, [documentTitle]);

  return (
    <div className={cn(styles.root, className)} {...rest}>
      <div className={styles.inner}>
        <Suspense
          fallback={
            loadingFallback ?? (
              <p className={styles.fallback} role="status" aria-live="polite">
                Loading…
              </p>
            )
          }
        >
          <LayoutSectionErrorBoundary>{children}</LayoutSectionErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
}

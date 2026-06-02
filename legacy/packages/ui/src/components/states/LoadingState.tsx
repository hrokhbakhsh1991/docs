import type { HTMLAttributes } from "react";

import { cn } from "../../utils/cn";

import styles from "./LoadingState.module.css";

export type LoadingStateProps = HTMLAttributes<HTMLDivElement> & {
  message?: string;
  /** Show subtle skeleton lines under message for better perceived progress. */
  withSkeleton?: boolean;
};

export function LoadingState({
  message = "Loading…",
  withSkeleton = true,
  className,
  ...rest
}: LoadingStateProps) {
  return (
    <div className={cn(styles.root, className)} role="status" aria-live="polite" {...rest}>
      <span className={styles.spinner} aria-hidden />
      {message ? <p className={styles.message}>{message}</p> : null}
      {withSkeleton ? (
        <div className={styles.skeletonStack} aria-hidden>
          <span className={`${styles.skeletonLine} ${styles.skeletonLineLg}`} />
          <span className={`${styles.skeletonLine} ${styles.skeletonLineMd}`} />
          <span className={`${styles.skeletonLine} ${styles.skeletonLineSm}`} />
        </div>
      ) : null}
    </div>
  );
}

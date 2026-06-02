import type { HTMLAttributes } from "react";

import { cn } from "../../utils/cn";
import { Alert } from "../Alert/Alert";
import { Button } from "../Button/Button";

import styles from "./ErrorState.module.css";

export type ErrorStateProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
  className,
  ...rest
}: ErrorStateProps) {
  return (
    <div className={cn(styles.root, className)} {...rest}>
      <Alert variant="error" title={title}>
        {message}
      </Alert>
      {onRetry ? (
        <div className={styles.retryRow}>
          <Button type="button" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}

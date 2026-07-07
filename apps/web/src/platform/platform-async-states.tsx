import type { ReactNode } from "react";

export function PlatformLoadingState({ message = "Loading…" }: { readonly message?: string }) {
  return (
    <div
      className="rounded-lg border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground"
      data-platform-loading
    >
      {message}
    </div>
  );
}

export function PlatformErrorState({
  message,
  action,
}: {
  readonly message: string;
  readonly action?: ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
      data-platform-error
    >
      <p>{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PlatformEmptyState({ message }: { readonly message: string }) {
  return (
    <div
      className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
      data-platform-empty
    >
      {message}
    </div>
  );
}

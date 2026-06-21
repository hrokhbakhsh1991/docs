"use client";

import { formatOffboardCountdown } from "./format-offboard-countdown";

export type TabActionsDangerProps = {
  readonly tenantId: string;
  readonly status: string;
  readonly scheduledDeletionAt: string | null;
  readonly isOwner: boolean;
  readonly busy: boolean;
  readonly onOffboard: () => Promise<void>;
  readonly onCancelOffboard: () => Promise<void>;
  readonly onExport: () => Promise<void>;
};

export function TabActionsDanger({
  status,
  scheduledDeletionAt,
  isOwner,
  busy,
  onOffboard,
  onCancelOffboard,
  onExport,
}: TabActionsDangerProps) {
  return (
    <div data-danger-zone className="mt-4 space-y-3 rounded-lg border border-destructive/40 p-4">
      <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
      {!isOwner ? (
        <p className="text-sm text-muted-foreground" data-danger-owner-only>
          Owner only
        </p>
      ) : null}
      {isOwner && status !== "offboarding" ? (
        <button
          type="button"
          data-offboard-start
          className="inline-flex h-9 items-center rounded-md border border-destructive px-4 text-sm text-destructive disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Start offboarding for this club? Operators will be blocked.")) {
              void onOffboard();
            }
          }}
        >
          Start offboarding
        </button>
      ) : null}
      {isOwner && status === "offboarding" ? (
        <div className="space-y-3">
          <span className="text-sm" data-offboard-countdown>
            {formatOffboardCountdown(scheduledDeletionAt)}
          </span>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              data-offboard-cancel
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => void onCancelOffboard()}
            >
              Cancel offboarding
            </button>
            <button
              type="button"
              data-export-tenant
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void onExport()}
            >
              Download GDPR export
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

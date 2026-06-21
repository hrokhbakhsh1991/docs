"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { fetchPlatformApi } from "../platform-api-client";
import type { PlatformClubDetail } from "./platform-club-detail.types";

export type TabBillingProps = {
  readonly tenantId: string;
  readonly subscription: PlatformClubDetail["subscription"];
  readonly isOwner: boolean;
  readonly onSubscriptionUpdated: (
    subscription: NonNullable<PlatformClubDetail["subscription"]>
  ) => void;
};

export function TabBilling({
  tenantId,
  subscription,
  isOwner,
  onSubscriptionUpdated,
}: TabBillingProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPlanChange = useCallback(
    async (planId: "standard" | "enterprise") => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetchPlatformApi(`/tenants/${tenantId}/subscription`, {
          method: "PATCH",
          body: JSON.stringify({ planId }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          subscription?: NonNullable<PlatformClubDetail["subscription"]>;
          error?: string;
        };
        if (!response.ok || !body.subscription) {
          setError(body.error ?? "Failed to update plan");
          return;
        }
        onSubscriptionUpdated(body.subscription);
        router.refresh();
      } catch {
        setError("Failed to update plan");
      } finally {
        setBusy(false);
      }
    },
    [onSubscriptionUpdated, router, tenantId]
  );

  const onMarkPaid = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchPlatformApi(`/tenants/${tenantId}/subscription/mark-paid`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => ({}))) as {
        subscription?: NonNullable<PlatformClubDetail["subscription"]>;
        error?: string;
      };
      if (!response.ok || !body.subscription) {
        setError(body.error ?? "Failed to mark paid");
        return;
      }
      onSubscriptionUpdated(body.subscription);
      router.refresh();
    } catch {
      setError("Failed to mark paid");
    } finally {
      setBusy(false);
    }
  }, [onSubscriptionUpdated, router, tenantId]);

  return (
    <div data-tab="billing" className="space-y-4 rounded-lg border border-border p-4 text-sm">
      {subscription ? (
        <dl className="grid gap-3 md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-medium">{subscription.planDisplayName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{subscription.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Period end</dt>
            <dd className="font-medium">
              {subscription.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground">No subscription record.</p>
      )}

      {isOwner ? (
        <div className="flex flex-wrap items-center gap-3">
          <select
            data-billing-plan-select
            className="h-9 rounded-md border border-border bg-background px-3"
            disabled={busy}
            value={subscription?.planId ?? "standard"}
            onChange={(event) => void onPlanChange(event.target.value as "standard" | "enterprise")}
          >
            <option value="standard">standard</option>
            <option value="enterprise">enterprise</option>
          </select>
          <button
            type="button"
            data-billing-mark-paid
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() => void onMarkPaid()}
          >
            Mark paid
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

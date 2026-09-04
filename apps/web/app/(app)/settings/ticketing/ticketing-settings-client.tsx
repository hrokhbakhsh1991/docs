"use client";

import { useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { PageHeader } from "@/admin/patterns/page-header";
import { Button } from "@/components/ui/button";
import { canMutateTickets } from "@/features/tickets/operator-tickets-types";

type SettingsView = {
  readonly enabled: boolean;
  readonly allowedPriorities: readonly string[];
  readonly maxAttachmentSizeBytes: number;
  readonly rowVersion: number;
  readonly categories: readonly { readonly code: string; readonly enabled: boolean }[];
};

type Props = {
  readonly session: OperatorSessionContext;
};

export function TicketingSettingsClient({ session }: Props) {
  const canMutate = canMutateTickets(session.role);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ticket-settings", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { settings?: SettingsView };
      setSettings(body.settings ?? null);
    })();
  }, []);

  async function save(): Promise<void> {
    if (settings === null || !canMutate) return;
    const res = await fetch("/api/ticket-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: settings.enabled,
        rowVersion: settings.rowVersion,
      }),
    });
    if (!res.ok) {
      setNotice("Save failed");
      return;
    }
    const body = (await res.json()) as { settings?: SettingsView };
    setSettings(body.settings ?? settings);
    setNotice("Saved");
  }

  return (
    <div className="space-y-6" data-ticketing-settings>
      <PageHeader title="Ticketing settings" description="Workspace ticketing configuration" />
      {settings === null ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4 rounded-lg border p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={!canMutate}
              onChange={(event) =>
                setSettings({ ...settings, enabled: event.target.checked })
              }
            />
            Module enabled
          </label>
          <p className="text-sm text-muted-foreground">
            Max attachment: {Math.round(settings.maxAttachmentSizeBytes / 1024 / 1024)} MiB
          </p>
          <p className="text-sm" data-testid="ticketing-settings-categories">
            Categories: {settings.categories.map((category) => category.code).join(", ")}
          </p>
          {canMutate ? (
            <Button type="button" onClick={() => void save()}>
              Save
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Viewer read-only</p>
          )}
          {notice !== null ? <p className="text-sm">{notice}</p> : null}
        </div>
      )}
    </div>
  );
}

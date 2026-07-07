"use client";

import { useCallback, useEffect, useState } from "react";

import { Input } from "@app-tour/ui-primitives/input";

import { fetchPlatformApi } from "../platform-api-client";
import { ClubCommerceBadge } from "../club-commerce-badge";
import { ClubPspStatus } from "../club-psp-status";
import type { PlatformClubDetail } from "./platform-club-detail.types";

export type TabWorkspaceDefinitionProps = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly workspaceCommerce: PlatformClubDetail["workspaceCommerce"];
  readonly integrationsPlane: PlatformClubDetail["integrationsPlane"];
  readonly binding: PlatformClubDetail["workspaceDefinition"];
  readonly isWriteRole: boolean;
  readonly onBindingUpdated: (binding: PlatformClubDetail["workspaceDefinition"]) => void;
};

type DefinitionListItem = {
  readonly id: string;
  readonly displayName: string;
  readonly latestPublishedVersion: number | null;
};

export function TabWorkspaceDefinition({
  tenantId,
  workspaceType,
  workspaceCommerce,
  integrationsPlane,
  binding,
  isWriteRole,
  onBindingUpdated,
}: TabWorkspaceDefinitionProps) {
  const [definitions, setDefinitions] = useState<readonly DefinitionListItem[]>([]);
  const [definitionId, setDefinitionId] = useState(binding?.definitionId ?? "");
  const [definitionVersion, setDefinitionVersion] = useState(
    binding?.definitionVersion?.toString() ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetchPlatformApi("/workspace-definitions");
      const body = (await response.json().catch(() => ({}))) as { items?: DefinitionListItem[] };
      if (response.ok && Array.isArray(body.items)) {
        setDefinitions(body.items);
      }
    })();
  }, []);

  const onSave = useCallback(async () => {
    if (!isWriteRole) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const patch =
        definitionId.trim().length === 0
          ? { definitionId: null }
          : {
              definitionId: definitionId.trim(),
              definitionVersion:
                definitionVersion.trim().length > 0 ? Number.parseInt(definitionVersion, 10) : null,
            };
      const response = await fetchPlatformApi(`/tenants/${tenantId}/workspace-definition`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const body = (await response.json().catch(() => ({}))) as {
        workspaceDefinition?: PlatformClubDetail["workspaceDefinition"];
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Failed to update workspace binding");
        return;
      }
      onBindingUpdated(body.workspaceDefinition ?? null);
    } catch {
      setError("Failed to update workspace binding");
    } finally {
      setBusy(false);
    }
  }, [definitionId, definitionVersion, isWriteRole, onBindingUpdated, tenantId]);

  const cutoverStage = binding?.metadataCutoverStage ?? "off";
  const cutoverVersionLabel =
    binding?.definitionVersion !== null && binding?.definitionVersion !== undefined
      ? `v${binding.definitionVersion}`
      : binding
        ? "latest"
        : null;

  return (
    <div
      data-tab="workspace-definition"
      className="space-y-4 rounded-lg border border-border p-4 text-sm"
    >
      <div>
        <h2 className="font-semibold">Workspace definition</h2>
        <p className="text-muted-foreground">
          Pin a published metadata definition to this club. Publish changes in the Workspaces
          builder.
        </p>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
        data-testid="platform-workspace-cutover-badge"
        data-metadata-cutover-stage={cutoverStage}
      >
        <span className="text-muted-foreground">Metadata cutover</span>
        <span className="font-medium capitalize">{cutoverStage}</span>
        {cutoverVersionLabel ? (
          <span className="text-muted-foreground" data-workspace-definition-version>
            Definition version: {cutoverVersionLabel}
          </span>
        ) : null}
      </div>

      <ClubCommerceBadge
        workspaceType={workspaceType}
        paymentMode={workspaceCommerce.paymentMode}
        gatewayProvider={workspaceCommerce.gatewayProvider}
      />

      <ClubPspStatus
        workspaceType={workspaceType}
        paymentMode={workspaceCommerce.paymentMode}
        gatewayProvider={workspaceCommerce.gatewayProvider}
        integrationsPlane={integrationsPlane}
      />

      {binding ? (
        <p>
          Current: {binding.definitionId}
          {binding.definitionVersion !== null ? ` v${binding.definitionVersion}` : ""}
          {binding.displayName ? ` (${binding.displayName})` : ""}
        </p>
      ) : (
        <p className="text-muted-foreground">No metadata binding — package plugin default.</p>
      )}

      <label className="block space-y-1">
        <span>Definition id</span>
        <select
          className="w-full rounded-md border border-border px-2 py-1"
          value={definitionId}
          disabled={!isWriteRole}
          onChange={(event) => setDefinitionId(event.target.value)}
        >
          <option value="">Clear binding</option>
          {definitions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName} ({item.id})
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span>Version (optional — latest when empty)</span>
        <Input
          className="w-full"
          value={definitionVersion}
          disabled={!isWriteRole || definitionId.length === 0}
          onChange={(event) => setDefinitionVersion(event.target.value)}
        />
      </label>

      <button
        type="button"
        className="rounded-md border border-border px-4 py-2 disabled:opacity-50"
        disabled={!isWriteRole || busy}
        data-workspace-definition-assign
        onClick={() => void onSave()}
      >
        Save binding
      </button>

      {!isWriteRole ? (
        <p className="text-xs text-muted-foreground">Support role is read-only on this tab.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

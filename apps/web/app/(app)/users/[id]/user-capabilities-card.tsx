"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  FormField,
} from "@tour/ui";
import { WORKSPACE_CAPABILITY_VALUES, type RegisteredWorkspaceCapability } from "@repo/shared-contracts";

import { ApiError } from "@/lib/api-client";
import { fetchSettingsRegions } from "@/lib/settings-locations-client";
import {
  patchMembershipCapabilities,
  type PatchMembershipCapabilitiesPayload,
  type WorkspaceUserDto,
} from "@/lib/services/users.service";
import { userKeys } from "@/lib/query-keys";
import { useAppToast } from "@/lib/use-app-toast";

type WorkspaceRegionRow = { id: string; name: string };

const CAPABILITY_LABELS: Record<string, string> = {
  "tour.create": "Create tours",
  "tour.read": "Read tours",
  "tour.update": "Update tours",
  "tour.update.core": "Update tour core fields",
  "tour.update.tripDetails": "Update trip details",
  "tour.publish": "Publish tours",
  "tour.regional.manage": "Regional tour scope",
  "settings.read": "Read settings",
  "settings.themes.manage": "Manage themes",
  "module.finance": "Finance module",
  "module.form_builder": "Form builder module",
  "marketing.segment.read": "Marketing segments",
};

type UserCapabilitiesCardProps = {
  tenantId: string;
  userId: string;
  user: WorkspaceUserDto;
  onChanged?: () => void | Promise<void>;
};

export function UserCapabilitiesCard({
  tenantId,
  userId,
  user,
  onChanged,
}: UserCapabilitiesCardProps): JSX.Element {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>(user.assignedCapabilities ?? []);
  const [regionIds, setRegionIds] = useState<string[]>(user.allowedRegionIds ?? []);

  useEffect(() => {
    setSelected(user.assignedCapabilities ?? []);
    setRegionIds(user.allowedRegionIds ?? []);
  }, [user.assignedCapabilities, user.allowedRegionIds]);

  const regionsQuery = useQuery({
    queryKey: ["settings", "regions", tenantId],
    queryFn: async () => {
      const rows = await fetchSettingsRegions();
      return rows.map((r) => ({ id: r.id, name: r.name } satisfies WorkspaceRegionRow));
    },
    enabled: Boolean(tenantId),
  });

  const showRegionalPicker = selected.includes("tour.regional.manage");

  const effectiveHint = useMemo(() => {
    const effective = user.effectiveCapabilities ?? [];
    if (effective.length === 0) return "No effective capabilities resolved.";
    return `Effective: ${effective.join(", ")}`;
  }, [user.effectiveCapabilities]);

  const saveMutation = useMutation({
    mutationFn: (payload: PatchMembershipCapabilitiesPayload) =>
      patchMembershipCapabilities(tenantId, userId, payload),
    onSuccess: async () => {
      toast.success({ message: "Capabilities updated." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: userKeys.detail(tenantId, userId) }),
        queryClient.invalidateQueries({ queryKey: userKeys.directoryListRoot(tenantId) }),
      ]);
      if (onChanged) await onChanged();
    },
    onError: (e: unknown) =>
      toast.error({
        message: e instanceof ApiError ? e.message : "Failed to update capabilities.",
      }),
  });

  function toggleCapability(cap: string, checked: boolean) {
    setSelected((prev) => {
      if (checked) {
        return prev.includes(cap) ? prev : [...prev, cap];
      }
      const next = prev.filter((c) => c !== cap);
      if (cap === "tour.regional.manage") {
        setRegionIds([]);
      }
      return next;
    });
  }

  function toggleRegion(regionId: string, checked: boolean) {
    setRegionIds((prev) => {
      if (checked) return prev.includes(regionId) ? prev : [...prev, regionId];
      return prev.filter((id) => id !== regionId);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capabilities</CardTitle>
      </CardHeader>
      <CardBody>
        <p style={{ marginTop: 0, fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          Explicit grants on membership metadata. Role-derived capabilities are read-only ({effectiveHint}).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
          {WORKSPACE_CAPABILITY_VALUES.map((cap: RegisteredWorkspaceCapability) => (
            <Checkbox
              key={cap}
              label={CAPABILITY_LABELS[cap] ?? cap}
              checked={selected.includes(cap)}
              onChange={(event) => toggleCapability(cap, event.target.checked)}
            />
          ))}
        </div>
        {showRegionalPicker ? (
          <FormField label="Allowed regions" description="Required for regional tour scope.">
            {regionsQuery.isPending ? (
              <span>Loading regions…</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
                {(regionsQuery.data ?? []).map((region) => (
                  <Checkbox
                    key={region.id}
                    label={region.name}
                    checked={regionIds.includes(region.id)}
                    onChange={(event) => toggleRegion(region.id, event.target.checked)}
                  />
                ))}
              </div>
            )}
          </FormField>
        ) : null}
        <Button
          type="button"
          variant="primary"
          disabled={saveMutation.isPending}
          onClick={() =>
            saveMutation.mutate({
              capabilities: selected,
              ...(showRegionalPicker ? { allowedRegionIds: regionIds } : {}),
            })
          }
        >
          Save capabilities
        </Button>
      </CardBody>
    </Card>
  );
}

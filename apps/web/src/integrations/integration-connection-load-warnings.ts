import type {
  IntegrationConnectionLoadWarning,
  IntegrationConnectionPublic,
} from "@/integrations/integrations-types";

export type PartitionedIntegrationLoadWarnings = {
  readonly tourPublishedPolicyDrift: boolean;
  readonly other: readonly IntegrationConnectionLoadWarning[];
};

export function partitionIntegrationLoadWarnings(
  loadWarnings: readonly IntegrationConnectionLoadWarning[] | undefined,
): PartitionedIntegrationLoadWarnings {
  const all = loadWarnings ?? [];
  return {
    tourPublishedPolicyDrift: all.includes("TOUR_PUBLISHED_POLICY_DRIFT"),
    other: all.filter((warning) => warning !== "TOUR_PUBLISHED_POLICY_DRIFT"),
  };
}

export function hasIntegrationLoadWarnings(
  loadWarnings: readonly IntegrationConnectionLoadWarning[] | undefined,
): boolean {
  return (loadWarnings?.length ?? 0) > 0;
}

export function listDeprecatedEventPolicies(
  connection: IntegrationConnectionPublic,
): readonly IntegrationConnectionPublic["eventPolicies"][number][] {
  return connection.eventPolicies.filter((policy) => policy.deprecated === true);
}

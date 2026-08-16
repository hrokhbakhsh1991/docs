import { resolveWizardHostCapability } from "@app-tour/workspace-sdk";

import { getSettingsResourcesRepository } from "../settings/create-settings-resources-repository";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";
import type { ValidateBeforePersistInput } from "./canonical-validation-sync.types";

export type PersistCanonicalNormalizeDeps = {
  readonly listDestinations?: (
    tenantId: string
  ) => Promise<readonly Readonly<Record<string, unknown>>[]>;
  readonly resolvePlugin?: typeof resolveWorkspacePluginForType;
};

async function defaultListDestinations(
  tenantId: string
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const rows = await getSettingsResourcesRepository().listDestinations(tenantId);
  return rows as readonly Readonly<Record<string, unknown>>[];
}

/**
 * ED-PEAK-LOCK-01 — product-blind persist enrich.
 * Only loads destinations when the workspace implements `normalizeCanonicalForPersist`.
 * Must run on the HTTP/main thread (not inside the validation worker).
 */
export async function applyWorkspacePersistCanonicalNormalize(
  input: ValidateBeforePersistInput,
  deps: PersistCanonicalNormalizeDeps = {}
): Promise<ValidateBeforePersistInput> {
  const resolvePlugin = deps.resolvePlugin ?? resolveWorkspacePluginForType;
  const plugin = await resolvePlugin(input.workspaceType);
  const normalize = resolveWizardHostCapability(plugin)?.normalizeCanonicalForPersist;
  if (normalize == null) {
    return input;
  }
  const data =
    input.body.data !== null &&
    typeof input.body.data === "object" &&
    !Array.isArray(input.body.data)
      ? (input.body.data as Record<string, unknown>)
      : undefined;
  if (data == null) {
    return input;
  }
  const listDestinations = deps.listDestinations ?? defaultListDestinations;
  const destinations = await listDestinations(input.tenantId);
  const nextData = normalize({ data, destinations });
  if (nextData === data) {
    return input;
  }
  return {
    ...input,
    body: {
      ...input.body,
      data: nextData as NonNullable<ValidateBeforePersistInput["body"]["data"]>,
    },
  };
}

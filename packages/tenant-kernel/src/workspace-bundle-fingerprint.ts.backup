import { createHash } from "node:crypto";

import type { WorkspaceBundleDescriptor } from "./workspace-infrastructure-placement";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

/**
 * Deterministic workspace configuration bundle fingerprint (MAT-010).
 * No secrets — pins, policy binding, branding hash, placement mode, release SHA only.
 */
export function computeWorkspaceBundleFingerprint(bundle: WorkspaceBundleDescriptor): string {
  const payload = {
    workspaceBindingId: bundle.workspaceBindingId,
    workspaceType: bundle.workspaceType,
    manifestFingerprint: bundle.manifestFingerprint,
    profilePin: bundle.profilePin ?? null,
    capabilityPins: bundle.capabilityPins ?? null,
    workspacePolicyBindingId: bundle.workspacePolicyBindingId ?? null,
    brandingConfigHash: bundle.brandingConfigHash ?? null,
    placement: {
      mode: bundle.placement.mode,
      region: bundle.placement.region ?? null,
      residencyPolicy: bundle.placement.residencyPolicy ?? null,
      approvedRegions: bundle.placement.approvedRegions ?? null,
      stampId: bundle.placement.stampId ?? null,
      databaseTargetId: bundle.placement.databaseTargetId ?? null,
    },
    releaseSha: bundle.releaseSha,
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

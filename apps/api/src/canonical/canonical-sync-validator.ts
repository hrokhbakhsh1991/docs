import type { TourRecord } from "../db/tour-record";

export type CanonicalSyncValidationResult = {
  readonly ok: boolean;
  readonly violations: readonly string[];
};

/**
 * End-of-pipeline check — canonical SoT must not diverge from legacy mirror.
 * Phase 3.4: legacy mirror is empty; any legacy row without canonical twin is a FAIL.
 */
export function validateCanonicalLegacySync(input: {
  readonly canonicalRecords: readonly TourRecord[];
  readonly legacyRecords: readonly TourRecord[];
}): CanonicalSyncValidationResult {
  const violations: string[] = [];
  const canonicalById = new Map(input.canonicalRecords.map((r) => [r.id, r]));

  for (const legacy of input.legacyRecords) {
    const canonical = canonicalById.get(legacy.id);
    if (!canonical) {
      violations.push(`legacy_orphan:${legacy.id}`);
      continue;
    }
    if (canonical.tenantId !== legacy.tenantId) {
      violations.push(`tenant_mismatch:${legacy.id}`);
    }
    if (JSON.stringify(canonical.canonical) !== JSON.stringify(legacy.canonical)) {
      violations.push(`canonical_payload_mismatch:${legacy.id}`);
    }
  }

  if (input.legacyRecords.length > input.canonicalRecords.length) {
    violations.push("legacy_count_exceeds_canonical");
  }

  return { ok: violations.length === 0, violations };
}

import type { WorkspaceCapability } from "./capabilities";
import { normalizeProductCapabilityId } from "./capability-registry";

/** JWT claim name for compact effective-capability snapshot (Phase 8.2). */
export const JWT_CAPABILITY_SNAPSHOT_CLAIM = "caps";

const MAX_SNAPSHOT_LENGTH = 512;

/**
 * Encodes effective capabilities as a sorted comma-separated claim value.
 * Only registered workspace capability ids are included.
 */
export function encodeJwtCapabilitySnapshot(
  capabilities: readonly string[],
): string | undefined {
  const normalized: WorkspaceCapability[] = [];
  for (const raw of capabilities) {
    const cap = normalizeProductCapabilityId(raw);
    if (cap) {
      normalized.push(cap);
    }
  }
  if (normalized.length === 0) {
    return undefined;
  }
  const encoded = [...new Set(normalized)].sort((a, b) => a.localeCompare(b)).join(",");
  if (encoded.length > MAX_SNAPSHOT_LENGTH) {
    return encoded.slice(0, MAX_SNAPSHOT_LENGTH);
  }
  return encoded;
}

export function decodeJwtCapabilitySnapshot(raw: unknown): readonly string[] {
  if (typeof raw !== "string" || raw.trim() === "") {
    return [];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

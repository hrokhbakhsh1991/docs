import { createHash } from "node:crypto";

import type { WorkspaceDefinitionPayload } from "../plugin/workspace-plugin-validation-core.js";

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortKeysDeep(record[key]);
  }
  return sorted;
}

/** Stable SHA-256 for dedupe / audit on `workspace_definition_versions.checksum`. Server-only. */
export function computeWorkspaceDefinitionPayloadChecksum(
  payload: WorkspaceDefinitionPayload,
): string {
  const canonical = JSON.stringify(sortKeysDeep(payload));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

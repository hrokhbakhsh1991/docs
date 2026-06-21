import { createHash } from "node:crypto";

import type { WorkspacePlugin } from "../plugin/workspace-plugin.contract.js";
import type { WorkspaceDefinitionPayload } from "../plugin/workspace-plugin-validation-core.js";

export type {
  WorkspaceDefinitionPayload,
  WorkspaceDefinitionThemePayload,
} from "../plugin/workspace-plugin-validation-core.js";
export {
  assertWorkspaceDefinitionPayload,
  validateWorkspaceDefinitionPayload,
} from "../plugin/workspace-plugin-validation-core.js";

/** Strip runtime hook surfaces from a package plugin for DB persistence (P3-A A4). */
export function stripWorkspacePluginToDefinitionPayload(
  plugin: WorkspacePlugin,
): WorkspaceDefinitionPayload {
  return {
    id: plugin.id,
    version: plugin.version,
    contractVersion: plugin.contractVersion,
    supportedWorkspaceTypes: plugin.supportedWorkspaceTypes,
    fieldRegistry: plugin.fieldRegistry,
    ruleSet: plugin.ruleSet,
    wizard: plugin.wizard,
  };
}

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

/** Stable SHA-256 for dedupe / audit on `workspace_definition_versions.checksum`. */
export function computeWorkspaceDefinitionPayloadChecksum(
  payload: WorkspaceDefinitionPayload,
): string {
  const canonical = JSON.stringify(sortKeysDeep(payload));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

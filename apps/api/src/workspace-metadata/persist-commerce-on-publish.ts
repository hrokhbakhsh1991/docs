import {
  DEFAULT_WORKSPACE_COMMERCE_CONFIG,
  parseWorkspaceCommerceConfig,
  type WorkspaceCommerceConfig,
} from "@app-tour/workspace-sdk/metadata";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * P5-C-N-003 — ensure workspace definition publish payloads carry explicit commerce config.
 * Default: offline_receipt (Denali-compatible baseline for non-gateway workspaces).
 */
export function mergeCommerceIntoWorkspaceDefinitionPayload(payload: unknown): unknown {
  if (!isPlainObject(payload)) {
    return payload;
  }

  const commerce: WorkspaceCommerceConfig =
    payload.commerce === undefined
      ? DEFAULT_WORKSPACE_COMMERCE_CONFIG
      : parseWorkspaceCommerceConfig(payload.commerce);

  return {
    ...payload,
    commerce,
  };
}

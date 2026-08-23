import type { WorkspaceDefinitionPayload } from "@app-tour/workspace-sdk/metadata";
import { isAllowedPlatformRendererId } from "@app-tour/workspace-sdk/metadata";

import { PlatformRendererNotAllowed } from "./platform.errors.ts";

/** P3-C — builder publish allowlist for composite renderer ids (primitives skipped). */
export function assertWorkspaceDefinitionRendererAllowlist(
  payload: WorkspaceDefinitionPayload
): void {
  for (const field of payload.fieldRegistry.fields) {
    if (field.kind !== "composite" && field.id === field.canonicalPath) {
      continue;
    }
    if (isAllowedPlatformRendererId(field.id)) {
      continue;
    }
    throw new PlatformRendererNotAllowed(field.id);
  }
}

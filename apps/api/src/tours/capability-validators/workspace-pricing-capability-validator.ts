import {
  getWorkspacePricingCapabilities,
  WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH,
} from "@app-tour/workspace-sdk";
import type {
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

import { readCanonicalPath, readFiniteNumber } from "./canonical-path.ts";

/** MAT-002 — generic pricing capability structural validation (CW7-11). */
export function validateWorkspacePricingCapability(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  const capabilities = getWorkspacePricingCapabilities(ctx.workspaceType);
  if (capabilities == null || capabilities.wizardTourField !== true) {
    return null;
  }

  const data = ctx.document.data as Record<string, unknown>;
  const rawBasePrice = readCanonicalPath(data, WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH);
  if (rawBasePrice === undefined) {
    return null;
  }

  const basePrice = readFiniteNumber(rawBasePrice);
  if (basePrice == null || basePrice < 0) {
    return {
      code: "WORKSPACE_PRICING_INVALID",
      message: `${WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH} must be a finite number >= 0 when present`,
    };
  }

  return null;
}

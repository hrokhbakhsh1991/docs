import {
  resolveFrozenWorkspaceCommerce,
  type WorkspaceCommerceConfig,
} from "@app-tour/workspace-sdk/metadata";

import type { CreateTourBody } from "./create-tour.schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPartialStarterLegacyCreateBody(data: Record<string, unknown>): boolean {
  return isRecord(data.basics) && !isRecord(data.details);
}

/**
 * P5-C-N-005 — apply workspace commerce paymentMode default on tour create ingress.
 * Frozen workspace types force paymentMode from manifest commerce.frozen (Wave F.b / PC-07).
 */
export function applyWorkspaceCommercePaymentModeToCreateData(
  workspaceType: string,
  data: Record<string, unknown>,
  commerce: WorkspaceCommerceConfig
): Record<string, unknown> {
  const frozen = resolveFrozenWorkspaceCommerce(workspaceType);
  const paymentMode = frozen?.paymentMode ?? commerce.paymentMode;
  const pricing = isRecord(data.pricing) ? { ...data.pricing } : {};

  if (frozen !== null) {
    return {
      ...data,
      pricing: {
        ...pricing,
        paymentMode,
      },
    };
  }

  if (pricing.paymentMode !== undefined) {
    return data;
  }

  return {
    ...data,
    pricing: {
      ...pricing,
      paymentMode,
    },
  };
}

export function applyWorkspaceCommerceDefaultToCreateBody(
  workspaceType: string,
  body: CreateTourBody,
  commerce: WorkspaceCommerceConfig
): CreateTourBody {
  if (body.data === undefined) {
    return body;
  }
  if (!isRecord(body.data)) {
    return body;
  }
  const nextData = applyWorkspaceCommercePaymentModeToCreateData(workspaceType, body.data, commerce);
  if (!isRecord(nextData.pricing)) {
    return {
      ...body,
      data: nextData,
    };
  }

  const roots = body.roots;
  if (roots === undefined) {
    if (isPartialStarterLegacyCreateBody(nextData)) {
      return { ...body, data: nextData };
    }
    return {
      ...body,
      roots: [...new Set([...Object.keys(nextData), "pricing"])],
      data: nextData,
    };
  }

  if (roots.includes("pricing")) {
    return { ...body, data: nextData };
  }
  return {
    ...body,
    roots: [...roots, "pricing"],
    data: nextData,
  };
}

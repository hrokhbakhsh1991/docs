import type { Prisma } from "@prisma/client";

import {
  getActiveActorId,
  getActiveWorkspaceType,
  requireActiveTenantId,
} from "../tenant/tenant-request-context";
import { pseudonymizeAuditActorId } from "./audit-pseudonym";

export const AUDIT_ACTION_TOUR_CREATED = "TOUR_CREATED";
export const AUDIT_ACTION_TOUR_UPDATED = "TOUR_UPDATED";

const AUDIT_METADATA_ALLOWLIST = ["workspaceType"] as const;

export type AppendAuditEventInput = {
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata?: Prisma.InputJsonValue;
};

/** Allowlisted audit metadata — caller extras are dropped (LOG-COL-03 / DEC-034). */
export function buildAuditMetadata(input: AppendAuditEventInput): Prisma.InputJsonValue {
  const workspaceType = getActiveWorkspaceType() ?? "starter";
  const metadata: Record<string, unknown> = { workspaceType };

  if (
    input.metadata !== undefined &&
    typeof input.metadata === "object" &&
    input.metadata !== null
  ) {
    for (const key of AUDIT_METADATA_ALLOWLIST) {
      if (key === "workspaceType") {
        continue;
      }
      const value = (input.metadata as Record<string, unknown>)[key];
      if (value !== undefined) {
        metadata[key] = value;
      }
    }
  }

  return metadata as Prisma.InputJsonValue;
}

/**
 * Append-only audit write — must run inside {@link withCanonicalTransaction} (same TX as domain row).
 * {@link tenantId} is taken from AsyncLocalStorage; optional explicit tenant must match when provided.
 */
export async function appendAuditEvent(
  tx: Prisma.TransactionClient,
  input: AppendAuditEventInput
): Promise<void> {
  const tenantId = requireActiveTenantId();
  const rawActorId = getActiveActorId();
  const actorId = rawActorId === undefined ? null : pseudonymizeAuditActorId(rawActorId, tenantId);

  await tx.auditEvent.create({
    data: {
      tenantId,
      actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: buildAuditMetadata(input),
    },
  });
}

/**
 * Application-level immutability guard — call before any non-append audit persistence API.
 * Phase 5 exposes only {@link appendAuditEvent}; update/delete must not be added without a new ADR.
 */
export function rejectAuditEventMutation(): never {
  throw new Error("AUDIT_EVENTS_IMMUTABLE");
}

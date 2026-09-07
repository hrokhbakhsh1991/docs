import type { Prisma } from "@prisma/client";

import {
  getActiveActorId,
  getActiveWorkspaceType,
  requireActiveTenantId,
} from "../tenant/tenant-request-context";
import { pseudonymizeAuditActorId } from "./audit-pseudonym";

export const AUDIT_ACTION_TOUR_CREATED = "TOUR_CREATED";
export const AUDIT_ACTION_TOUR_UPDATED = "TOUR_UPDATED";
export const AUDIT_ACTION_TOUR_PUBLISHED = "TOUR_PUBLISHED";
export const AUDIT_ACTION_TOUR_UNPUBLISHED = "TOUR_UNPUBLISHED";
export const AUDIT_ACTION_TENANT_PROVISIONED = "TENANT_PROVISIONED";
export const AUDIT_ACTION_BOOKING_ATTENDANCE_MARKED = "BOOKING_ATTENDANCE_MARKED";

const AUDIT_METADATA_ALLOWLIST = [
  "workspaceType",
  "fromPublishStatus",
  "toPublishStatus",
  "attendanceStatus",
  "markedAt",
] as const;

export type AppendAuditEventInput = {
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata?: Prisma.InputJsonValue;
  /** DEC-077 — explicit DB `now()` from canonical TX; omit only outside atomic path. */
  readonly createdAt?: Date;
};

export type AppendTourAuditEventInput = {
  readonly tourId: string;
  /** DEC-077 — explicit DB `now()` from canonical TX. */
  readonly createdAt?: Date;
};

export type AppendTourPublishTransitionAuditInput = {
  readonly tourId: string;
  readonly transition: "published" | "unpublished";
  readonly fromPublishStatus?: string;
  readonly toPublishStatus?: string;
  readonly createdAt?: Date;
};

/** P5-B-N-011 / DEC-047 — PATCH tour success appends `TOUR_UPDATED` in forensic TX. */
export async function appendTourUpdatedAuditEvent(
  tx: Prisma.TransactionClient,
  input: AppendTourAuditEventInput
): Promise<void> {
  await appendAuditEvent(tx, {
    action: AUDIT_ACTION_TOUR_UPDATED,
    entityType: "tour",
    entityId: input.tourId,
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
  });
}

/** P5-B-N-012 — publish/unpublish transition audit in same TX as tour update. */
export async function appendTourPublishTransitionAuditEvent(
  tx: Prisma.TransactionClient,
  input: AppendTourPublishTransitionAuditInput
): Promise<void> {
  const action =
    input.transition === "published" ? AUDIT_ACTION_TOUR_PUBLISHED : AUDIT_ACTION_TOUR_UNPUBLISHED;
  await appendAuditEvent(tx, {
    action,
    entityType: "tour",
    entityId: input.tourId,
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
    metadata: {
      ...(input.fromPublishStatus !== undefined
        ? { fromPublishStatus: input.fromPublishStatus }
        : {}),
      ...(input.toPublishStatus !== undefined ? { toPublishStatus: input.toPublishStatus } : {}),
    },
  });
}

/** Allowlisted audit metadata — caller extras are dropped (LOG-COL-03 / DEC-034). */
export function buildAuditMetadata(input: AppendAuditEventInput): Prisma.InputJsonValue {
  const workspaceType = getActiveWorkspaceType() ?? "unknown";
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
 *
 * **actor_id (AUDIT-GAP-05):** null when ALS has no `actorId` (internal provision, background jobs).
 * HTTP `/tours` binds actor from `x-user-id`. See `docs/phase-5/appendices/audit-coverage.md`.
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
      ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
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

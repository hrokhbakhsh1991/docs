import type { PrismaClient } from "@prisma/client";

import { getPrismaAdmin } from "../../db/prisma";
import { FINANCE_RECON_SEVERITY, type FinanceReconFindingDraft } from "./codes";

export type UpsertFindingsResult = {
  readonly upserted: number;
  readonly reopened: number;
};

/** Upsert open findings; reopen previously resolved/ignored if divergence returns. */
export async function upsertFinanceReconFindings(
  drafts: readonly FinanceReconFindingDraft[],
  admin: PrismaClient = getPrismaAdmin()
): Promise<UpsertFindingsResult> {
  let upserted = 0;
  let reopened = 0;
  for (const draft of drafts) {
    const severity = FINANCE_RECON_SEVERITY[draft.code];
    const existing = await admin.financeReconFinding.findUnique({
      where: {
        tenantId_code_fingerprint: {
          tenantId: draft.tenantId,
          code: draft.code,
          fingerprint: draft.fingerprint,
        },
      },
      select: { id: true, status: true },
    });

    if (existing === null) {
      await admin.financeReconFinding.create({
        data: {
          tenantId: draft.tenantId,
          code: draft.code,
          severity,
          status: "open",
          fingerprint: draft.fingerprint,
          paymentId: draft.paymentId ?? null,
          registrationId: draft.registrationId ?? null,
          outboxEventId: draft.outboxEventId ?? null,
          details: draft.details,
        },
      });
      upserted += 1;
      continue;
    }

    const reopen = existing.status !== "open";
    await admin.financeReconFinding.update({
      where: { id: existing.id },
      data: {
        severity,
        status: "open",
        paymentId: draft.paymentId ?? null,
        registrationId: draft.registrationId ?? null,
        outboxEventId: draft.outboxEventId ?? null,
        details: draft.details,
        resolvedAt: null,
        resolvedBy: null,
        detectedAt: reopen ? new Date() : undefined,
      },
    });
    upserted += 1;
    if (reopen) {
      reopened += 1;
    }
  }
  return { upserted, reopened };
}

export async function listOpenFinanceReconFindings(input: {
  readonly tenantId?: string;
  readonly code?: string;
  readonly limit?: number;
}): Promise<unknown[]> {
  const admin = getPrismaAdmin();
  return admin.financeReconFinding.findMany({
    where: {
      status: "open",
      ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
    },
    orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
    take: input.limit ?? 100,
  });
}

export async function getFinanceReconFinding(id: string): Promise<unknown | null> {
  const admin = getPrismaAdmin();
  return admin.financeReconFinding.findUnique({
    where: { id },
    include: { actions: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
}

export async function recordFinanceReconAction(input: {
  readonly findingId: string;
  readonly tenantId: string;
  readonly action: string;
  readonly actorUserId?: string;
  readonly dryRun: boolean;
  readonly mode?: string;
  readonly reason?: string | null;
  readonly rollbackStrategy?: string;
  readonly result: string;
  readonly payload: Record<string, unknown>;
}): Promise<void> {
  const admin = getPrismaAdmin();
  await admin.financeReconAction.create({
    data: {
      findingId: input.findingId,
      tenantId: input.tenantId,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      dryRun: input.dryRun,
      mode: input.mode ?? (input.dryRun ? "preview" : "manual"),
      reason: input.reason ?? null,
      rollbackStrategy: input.rollbackStrategy ?? "ticket_only",
      result: input.result,
      payload: input.payload,
    },
  });
}

export async function markFinanceReconFindingStatus(input: {
  readonly findingId: string;
  readonly status: "resolved" | "ignored";
  readonly resolvedBy?: string;
}): Promise<void> {
  const admin = getPrismaAdmin();
  await admin.financeReconFinding.update({
    where: { id: input.findingId },
    data: {
      status: input.status,
      resolvedAt: new Date(),
      resolvedBy: input.resolvedBy ?? null,
    },
  });
}

export async function countOpenFinanceReconFindings(): Promise<number> {
  const admin = getPrismaAdmin();
  return admin.financeReconFinding.count({ where: { status: "open" } });
}

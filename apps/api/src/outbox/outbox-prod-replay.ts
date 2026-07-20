/**
 * Phase 3.17 — production-safe outbox replay orchestration.
 * Mutation stays DEC-086 failed→pending; no outbox redesign.
 */
import type { Prisma } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";
import { logger } from "../observability/logger";
import { metricsRegistry } from "../observability/metrics";
import { persistOutboxReplayRun } from "./outbox-replay-audit";
import {
  OutboxReplayNotFoundError,
  OutboxReplayTenantMismatchError,
  replayFailedOutboxEvent,
  tryReplayFailedOutboxEvent,
} from "./outbox-replay";

export const OUTBOX_REPLAY_CONFIRM_PHRASE = "REPLAY";
export const OUTBOX_REPLAY_BATCH_MAX = 500;
export const OUTBOX_REPLAY_SCAN_MAX = 2000;

const RUNS_TOTAL = "outbox_replay_runs_total";
const EVENTS_TOTAL = "outbox_replay_events_total";
const DURATION_MS = "outbox_replay_duration_ms";

export type OutboxReplayMode = "single" | "batch" | "tenant" | "workspace" | "date_range";

export type OutboxReplayCandidate = {
  readonly id: string;
  readonly tenantId: string;
  readonly status: string;
  readonly eventType: string;
  readonly createdAt: Date;
};

export type OutboxProdReplayInput = {
  readonly mode: OutboxReplayMode;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly confirmPhrase?: string;
  readonly actorUserId?: string;
  readonly tenantId?: string;
  readonly outboxId?: string;
  readonly outboxIds?: readonly string[];
  readonly workspaceType?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly eventTypePrefix?: string;
};

export type OutboxProdReplayResult = {
  readonly runId: string;
  readonly mode: OutboxReplayMode;
  readonly dryRun: boolean;
  readonly replayed: number;
  readonly skipped: number;
  readonly failed: number;
  readonly durationMs: number;
  readonly candidates: readonly {
    readonly id: string;
    readonly tenantId: string;
    readonly eventType: string;
    readonly outcome: "would_replay" | "replayed" | "skipped" | "error";
    readonly reason?: string;
  }[];
};

export class OutboxReplayConfirmRequiredError extends Error {
  readonly code = "OUTBOX_REPLAY_CONFIRM_REQUIRED";
  constructor() {
    super("Apply requires confirm:true and confirmPhrase:REPLAY");
    this.name = "OutboxReplayConfirmRequiredError";
  }
}

export class OutboxReplayInputError extends Error {
  readonly code = "OUTBOX_REPLAY_INPUT_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "OutboxReplayInputError";
  }
}

function assertConfirmForApply(input: OutboxProdReplayInput, dryRun: boolean): void {
  if (dryRun) {
    return;
  }
  if (input.confirm !== true || input.confirmPhrase !== OUTBOX_REPLAY_CONFIRM_PHRASE) {
    throw new OutboxReplayConfirmRequiredError();
  }
}

function parseModeInput(input: OutboxProdReplayInput): void {
  switch (input.mode) {
    case "single":
      if (!input.tenantId?.trim() || !input.outboxId?.trim()) {
        throw new OutboxReplayInputError("single requires tenantId and outboxId");
      }
      break;
    case "batch":
      if (!input.tenantId?.trim() || !input.outboxIds || input.outboxIds.length === 0) {
        throw new OutboxReplayInputError("batch requires tenantId and outboxIds");
      }
      if (input.outboxIds.length > OUTBOX_REPLAY_BATCH_MAX) {
        throw new OutboxReplayInputError(`batch max ${OUTBOX_REPLAY_BATCH_MAX}`);
      }
      break;
    case "tenant":
      if (!input.tenantId?.trim()) {
        throw new OutboxReplayInputError("tenant mode requires tenantId");
      }
      break;
    case "workspace":
      if (!input.workspaceType?.trim()) {
        throw new OutboxReplayInputError("workspace mode requires workspaceType");
      }
      break;
    case "date_range":
      if (!(input.from instanceof Date) || !(input.to instanceof Date)) {
        throw new OutboxReplayInputError("date_range requires from and to");
      }
      if (input.from.getTime() > input.to.getTime()) {
        throw new OutboxReplayInputError("from must be <= to");
      }
      break;
    default:
      throw new OutboxReplayInputError(`unknown mode: ${String(input.mode)}`);
  }
}

/** Pure helper for unit tests — classify a candidate status. */
export function classifyReplayCandidateStatus(
  status: string
): "would_replay" | "skipped" {
  return status === "failed" ? "would_replay" : "skipped";
}

export async function selectOutboxReplayCandidates(
  input: OutboxProdReplayInput
): Promise<readonly OutboxReplayCandidate[]> {
  parseModeInput(input);
  const admin = getPrismaAdmin();
  const prefix = input.eventTypePrefix?.trim();

  if (input.mode === "single") {
    const row = await admin.outboxEvent.findUnique({
      where: { id: input.outboxId! },
      select: {
        id: true,
        tenantId: true,
        status: true,
        eventType: true,
        createdAt: true,
      },
    });
    if (row === null) {
      throw new OutboxReplayNotFoundError();
    }
    if (row.tenantId !== input.tenantId) {
      throw new OutboxReplayTenantMismatchError();
    }
    return [row];
  }

  if (input.mode === "batch") {
    const rows = await admin.outboxEvent.findMany({
      where: {
        tenantId: input.tenantId!,
        id: { in: [...input.outboxIds!] },
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        eventType: true,
        createdAt: true,
      },
      take: OUTBOX_REPLAY_BATCH_MAX,
    });
    return rows;
  }

  const where: Prisma.OutboxEventWhereInput = {
    status: "failed",
  };
  if (input.tenantId?.trim()) {
    where.tenantId = input.tenantId.trim();
  }
  if (input.from !== undefined || input.to !== undefined) {
    where.createdAt = {
      ...(input.from !== undefined ? { gte: input.from } : {}),
      ...(input.to !== undefined ? { lte: input.to } : {}),
    };
  }
  if (prefix !== undefined && prefix.length > 0) {
    where.eventType = { startsWith: prefix };
  }
  if (input.mode === "workspace" || (input.mode === "date_range" && input.workspaceType?.trim())) {
    const workspaceType = input.workspaceType!.trim();
    where.tenant = { workspaceType };
  }

  return admin.outboxEvent.findMany({
    where,
    select: {
      id: true,
      tenantId: true,
      status: true,
      eventType: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: OUTBOX_REPLAY_SCAN_MAX,
  });
}

export async function runOutboxProdReplay(
  input: OutboxProdReplayInput
): Promise<OutboxProdReplayResult> {
  const started = Date.now();
  const dryRun = input.dryRun !== false;
  let runResult: "ok" | "error" | "rejected" = "ok";

  try {
    parseModeInput(input);
    assertConfirmForApply(input, dryRun);

    const candidates = await selectOutboxReplayCandidates(input);
    type CandidateOutcome = OutboxProdReplayResult["candidates"][number];
    const outcomes: CandidateOutcome[] = [];
    let replayed = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of candidates) {
      const classed = classifyReplayCandidateStatus(row.status);
      if (classed === "skipped") {
        skipped += 1;
        outcomes.push({
          id: row.id,
          tenantId: row.tenantId,
          eventType: row.eventType,
          outcome: "skipped",
          reason: `status=${row.status}`,
        });
        metricsRegistry.increment(EVENTS_TOTAL, { outcome: "skipped" });
        continue;
      }

      if (dryRun) {
        replayed += 1;
        outcomes.push({
          id: row.id,
          tenantId: row.tenantId,
          eventType: row.eventType,
          outcome: "would_replay",
        });
        metricsRegistry.increment(EVENTS_TOTAL, { outcome: "would_replay" });
        continue;
      }

      try {
        if (input.mode === "single") {
          await replayFailedOutboxEvent({
            tenantId: row.tenantId,
            outboxId: row.id,
          });
          replayed += 1;
          outcomes.push({
            id: row.id,
            tenantId: row.tenantId,
            eventType: row.eventType,
            outcome: "replayed",
          });
          metricsRegistry.increment(EVENTS_TOTAL, { outcome: "replayed" });
        } else {
          const result = await tryReplayFailedOutboxEvent({
            tenantId: row.tenantId,
            outboxId: row.id,
          });
          if (result === "replayed") {
            replayed += 1;
            outcomes.push({
              id: row.id,
              tenantId: row.tenantId,
              eventType: row.eventType,
              outcome: "replayed",
            });
            metricsRegistry.increment(EVENTS_TOTAL, { outcome: "replayed" });
          } else {
            skipped += 1;
            outcomes.push({
              id: row.id,
              tenantId: row.tenantId,
              eventType: row.eventType,
              outcome: "skipped",
              reason: "race_or_not_failed",
            });
            metricsRegistry.increment(EVENTS_TOTAL, { outcome: "skipped" });
          }
        }
      } catch (error: unknown) {
        failed += 1;
        outcomes.push({
          id: row.id,
          tenantId: row.tenantId,
          eventType: row.eventType,
          outcome: "error",
          reason: error instanceof Error ? error.message : String(error),
        });
        metricsRegistry.increment(EVENTS_TOTAL, { outcome: "error" });
        if (input.mode === "single") {
          throw error;
        }
      }
    }

    const durationMs = Math.max(0, Date.now() - started);
    metricsRegistry.observe(DURATION_MS, durationMs, {
      mode: input.mode,
      dry_run: dryRun ? "true" : "false",
    });

    const requestedIds =
      input.mode === "single" && input.outboxId
        ? [input.outboxId]
        : input.mode === "batch"
          ? [...(input.outboxIds ?? [])]
          : candidates.map((c) => c.id);

    const run = await persistOutboxReplayRun({
      mode: input.mode,
      dryRun,
      confirmed: !dryRun,
      actorUserId: input.actorUserId,
      tenantId: input.tenantId,
      workspaceType: input.workspaceType,
      fromCreatedAt: input.from,
      toCreatedAt: input.to,
      eventTypePrefix: input.eventTypePrefix,
      requestedIds,
      replayed,
      skipped,
      failed,
      durationMs,
      details: {
        candidateCount: candidates.length,
        outcomes: outcomes.slice(0, 100),
      },
    });

    metricsRegistry.increment(RUNS_TOTAL, { mode: input.mode, result: "ok" });
    logger.info(
      {
        event: "outbox.replay.run",
        run_id: run.id,
        mode: input.mode,
        dry_run: dryRun,
        replayed,
        skipped,
        failed,
        duration_ms: durationMs,
      },
      "outbox replay run complete"
    );

    return {
      runId: run.id,
      mode: input.mode,
      dryRun,
      replayed,
      skipped,
      failed,
      durationMs,
      candidates: outcomes,
    };
  } catch (error: unknown) {
    runResult =
      error instanceof OutboxReplayConfirmRequiredError ||
      error instanceof OutboxReplayInputError
        ? "rejected"
        : "error";
    metricsRegistry.increment(RUNS_TOTAL, { mode: input.mode, result: runResult });
    const durationMs = Math.max(0, Date.now() - started);
    metricsRegistry.observe(DURATION_MS, durationMs, {
      mode: input.mode,
      dry_run: String(input.dryRun !== false),
    });
    logger.warn(
      {
        event: "outbox.replay.run_failed",
        mode: input.mode,
        dry_run: input.dryRun !== false,
        err: error instanceof Error ? error.message : String(error),
        duration_ms: durationMs,
      },
      "outbox replay run failed"
    );
    throw error;
  }
}

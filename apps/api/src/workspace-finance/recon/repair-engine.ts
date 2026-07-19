/**
 * Finance recon repair engine — mode gating, matrix allowlist, audit.
 * @see docs/phase-20/p7/appendices/FINANCE_RECON_REPAIR_ENGINE.md
 */
import { logger } from "../../observability/logger";
import { metricsRegistry } from "../../observability/metrics";
import {
  getFinanceReconFinding,
  markFinanceReconFindingStatus,
  recordFinanceReconAction,
} from "./findings-store";
import {
  dispatchRepairHandler,
  type ReconFindingRow,
} from "./repair-handlers";
import {
  getFinanceReconRepairMatrixEntry,
  listFinanceReconRepairMatrix,
  type FinanceReconRepairMode,
} from "./repair-matrix";

const REPAIR_TOTAL = "finance_recon_repair_total";

export type FinanceReconRepairEngineInput = {
  readonly findingId: string;
  readonly mode?: FinanceReconRepairMode;
  /** @deprecated prefer mode; dryRun true → preview */
  readonly dryRun?: boolean;
  readonly reason?: string;
  readonly actorUserId?: string;
  readonly approvedConfirm?: boolean;
  readonly action?: "repair" | "ignore";
};

export type FinanceReconRepairEngineResult = {
  readonly result: "ok" | "conflict" | "error" | "noop" | "unsupported" | "rejected";
  readonly mode: FinanceReconRepairMode;
  readonly dryRun: boolean;
  readonly rollbackStrategy: string;
  readonly reason: string | null;
  readonly operator: string | null;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
};

export class FinanceReconRepairRejectedError extends Error {
  readonly code = "FINANCE_RECON_REPAIR_REJECTED";
  constructor(message: string) {
    super(message);
    this.name = "FinanceReconRepairRejectedError";
  }
}

function resolveMode(input: FinanceReconRepairEngineInput): FinanceReconRepairMode {
  if (input.mode !== undefined) {
    return input.mode;
  }
  return input.dryRun === false ? "manual" : "preview";
}

function assertModeAllowed(
  mode: FinanceReconRepairMode,
  entry: NonNullable<ReturnType<typeof getFinanceReconRepairMatrixEntry>>,
  input: FinanceReconRepairEngineInput
): void {
  if (!entry.modes.includes(mode)) {
    throw new FinanceReconRepairRejectedError(
      `mode ${mode} not allowed for ${entry.code}`
    );
  }
  if (mode === "automatic" && !entry.autoSafe) {
    throw new FinanceReconRepairRejectedError(`automatic not safe for ${entry.code}`);
  }
  if (mode === "automatic" && process.env.FINANCE_RECON_AUTO_REPAIR?.trim() !== "1") {
    throw new FinanceReconRepairRejectedError("FINANCE_RECON_AUTO_REPAIR not enabled");
  }
  if (mode !== "preview") {
    const reason = input.reason?.trim() ?? "";
    if (reason.length === 0 && mode !== "automatic") {
      throw new FinanceReconRepairRejectedError("reason required for mutate modes");
    }
    if (mode === "automatic" && reason.length === 0) {
      // auto supplies synthetic reason
    }
  }
  if (mode === "approved" && input.approvedConfirm !== true) {
    throw new FinanceReconRepairRejectedError("approvedConfirm required for approved mode");
  }
  if (entry.requiresApprovedConfirm && mode === "manual") {
    throw new FinanceReconRepairRejectedError(
      `code ${entry.code} requires approved mode (not manual)`
    );
  }
}

export async function runFinanceReconRepairEngine(
  input: FinanceReconRepairEngineInput
): Promise<FinanceReconRepairEngineResult> {
  const mode = resolveMode(input);
  const preview = mode === "preview";
  const timestamp = new Date().toISOString();
  const operator = input.actorUserId?.trim() || (mode === "automatic" ? "auto-repair" : null);
  const reason =
    input.reason?.trim() ||
    (mode === "automatic" ? "automatic_safe_repair" : null) ||
    (mode === "preview" ? "preview" : null);

  const findingRaw = await getFinanceReconFinding(input.findingId);
  if (findingRaw === null) {
    return {
      result: "error",
      mode,
      dryRun: preview,
      rollbackStrategy: "ticket_only",
      reason,
      operator,
      timestamp,
      payload: { error: "not_found" },
    };
  }

  const finding = findingRaw as ReconFindingRow & {
    readonly actions?: unknown;
  };

  const entry = getFinanceReconRepairMatrixEntry(finding.code);
  if (entry === undefined) {
    return {
      result: "unsupported",
      mode,
      dryRun: preview,
      rollbackStrategy: "ticket_only",
      reason,
      operator,
      timestamp,
      payload: { code: finding.code },
    };
  }

  try {
    if (input.action === "ignore") {
      if (!preview) {
        if ((reason ?? "").length === 0) {
          throw new FinanceReconRepairRejectedError("reason required to ignore");
        }
        await markFinanceReconFindingStatus({
          findingId: finding.id,
          status: "ignored",
          resolvedBy: operator ?? "recon-ignore",
        });
      }
      const payload = { ignored: true, code: finding.code };
      await recordFinanceReconAction({
        findingId: finding.id,
        tenantId: finding.tenantId,
        action: "ignore",
        actorUserId: operator ?? undefined,
        dryRun: preview,
        mode,
        reason,
        rollbackStrategy: "ignore_ack",
        result: "ok",
        payload,
      });
      return {
        result: "ok",
        mode,
        dryRun: preview,
        rollbackStrategy: "ignore_ack",
        reason,
        operator,
        timestamp,
        payload,
      };
    }

    assertModeAllowed(mode, entry, input);

    const outcome = await dispatchRepairHandler(finding, preview, operator ?? undefined);

    if (!preview && outcome.resolveFinding === true) {
      await markFinanceReconFindingStatus({
        findingId: finding.id,
        status: "resolved",
        resolvedBy: operator ?? "recon-repair",
      });
    }

    await recordFinanceReconAction({
      findingId: finding.id,
      tenantId: finding.tenantId,
      action: entry.action,
      actorUserId: operator ?? undefined,
      dryRun: preview,
      mode,
      reason,
      rollbackStrategy: entry.rollbackStrategy,
      result: outcome.result,
      payload: {
        ...outcome.payload,
        rollbackStrategy: entry.rollbackStrategy,
        timestamp,
      },
    });

    metricsRegistry.increment(REPAIR_TOTAL, {
      action: entry.action,
      result: outcome.result,
      mode,
    });

    logger.info(
      {
        event: "finance.recon.repair",
        finding_id: finding.id,
        code: finding.code,
        mode,
        dry_run: preview,
        result: outcome.result,
        operator,
        reason,
        rollback_strategy: entry.rollbackStrategy,
        timestamp,
      },
      "finance recon repair"
    );

    return {
      result: outcome.result,
      mode,
      dryRun: preview,
      rollbackStrategy: entry.rollbackStrategy,
      reason,
      operator,
      timestamp,
      payload: outcome.payload,
    };
  } catch (error: unknown) {
    const rejected = error instanceof FinanceReconRepairRejectedError;
    const message = error instanceof Error ? error.message : String(error);
    const result = rejected ? "rejected" : "error";

    await recordFinanceReconAction({
      findingId: finding.id,
      tenantId: finding.tenantId,
      action: entry.action,
      actorUserId: operator ?? undefined,
      dryRun: preview,
      mode,
      reason,
      rollbackStrategy: entry.rollbackStrategy,
      result,
      payload: { error: message, timestamp },
    });

    metricsRegistry.increment(REPAIR_TOTAL, {
      action: entry.action,
      result,
      mode,
    });

    logger.warn(
      {
        event: "finance.recon.repair_rejected",
        finding_id: finding.id,
        code: finding.code,
        mode,
        err: message,
      },
      "finance recon repair rejected or failed"
    );

    return {
      result,
      mode,
      dryRun: preview,
      rollbackStrategy: entry.rollbackStrategy,
      reason,
      operator,
      timestamp,
      payload: { error: message },
    };
  }
}

/** Back-compat wrapper used by HTTP / auto-repair. */
export async function repairFinanceReconFinding(input: {
  readonly findingId: string;
  readonly dryRun: boolean;
  readonly actorUserId?: string;
  readonly action?: "repair" | "ignore";
  readonly mode?: FinanceReconRepairMode;
  readonly reason?: string;
  readonly approvedConfirm?: boolean;
}): Promise<{
  readonly result: FinanceReconRepairEngineResult["result"];
  readonly dryRun: boolean;
  readonly payload: Record<string, unknown>;
}> {
  const engine = await runFinanceReconRepairEngine({
    findingId: input.findingId,
    dryRun: input.dryRun,
    mode: input.mode,
    actorUserId: input.actorUserId,
    action: input.action,
    reason: input.reason ?? (input.dryRun ? "preview" : "legacy_manual_repair"),
    approvedConfirm: input.approvedConfirm,
  });
  return {
    result: engine.result,
    dryRun: engine.dryRun,
    payload: {
      ...engine.payload,
      mode: engine.mode,
      rollbackStrategy: engine.rollbackStrategy,
      reason: engine.reason,
      operator: engine.operator,
      timestamp: engine.timestamp,
    },
  };
}

export { listFinanceReconRepairMatrix };

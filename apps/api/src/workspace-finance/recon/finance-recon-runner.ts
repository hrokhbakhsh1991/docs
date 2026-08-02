/**
 * Finance reconciliation job runner — detect + upsert findings; optional auto-repair.
 */
import { getBackgroundAdminClient, BACKGROUND_ADMIN_REASON } from "../../db/background-admin-client";
import { logger } from "../../observability/logger";
import { metricsRegistry } from "../../observability/metrics";
import { FINANCE_RECON_LOOKBACK_MS } from "../finance-ops-metrics";
import { FINANCE_RECON_CODE, type FinanceReconJobId } from "./codes";
import {
  detectDoubleWallet,
  detectDupCapture,
  detectLedgerNoPayment,
  detectOutboxFailed,
  detectOutboxStale,
  detectPaidAmtMismatch,
  detectPaidBookingDrift,
  detectPaidNoLedger,
  detectPrepayBookingDegraded,
  detectPrepayNoLedger,
  detectStuckPending,
  type FinanceReconDetectOptions,
} from "./detect";
import { countOpenFinanceReconFindings, upsertFinanceReconFindings } from "./findings-store";
import { repairFinanceReconFinding } from "./repair-engine";

const FINDINGS_OPEN = "finance_recon_findings_open";

export type FinanceReconRunResult = {
  readonly job: FinanceReconJobId;
  readonly detected: number;
  readonly upserted: number;
  readonly reopened: number;
  readonly autoRepaired: number;
};

function readBatchSize(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.FINANCE_RECON_BATCH_SIZE?.trim();
  const n = raw !== undefined && raw.length > 0 ? Number.parseInt(raw, 10) : 500;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 2000) : 500;
}

function readLookbackMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.FINANCE_RECON_LOOKBACK_MS?.trim();
  if (raw !== undefined && raw.length > 0) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60_000) {
      return n;
    }
  }
  return FINANCE_RECON_LOOKBACK_MS;
}

function isAutoRepairEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FINANCE_RECON_AUTO_REPAIR?.trim() === "1";
}

export async function runFinanceReconJob(input: {
  readonly job?: FinanceReconJobId;
  readonly tenantId?: string;
} = {}): Promise<FinanceReconRunResult> {
  const job = input.job ?? "ALL";
  const options: FinanceReconDetectOptions = {
    lookbackMs: readLookbackMs(),
    batchSize: readBatchSize(),
    tenantId: input.tenantId,
    staleOutboxMs: Number.parseInt(process.env.FINANCE_RECON_STALE_OUTBOX_MS ?? "300000", 10),
  };

  const jobs: FinanceReconJobId[] =
    job === "ALL" ? ["R1", "R2", "R3", "R4", "R5", "R6"] : [job];

  let detected = 0;
  let upserted = 0;
  let reopened = 0;

  for (const id of jobs) {
    const drafts =
      id === "R1"
        ? [
            ...(await detectPaidNoLedger(options)),
            ...(await detectPaidAmtMismatch(options)),
            ...(await detectDupCapture(options)),
            ...(await detectLedgerNoPayment(options)),
          ]
        : id === "R2"
          ? await detectPrepayNoLedger(options)
          : id === "R3"
            ? await detectPaidBookingDrift(options)
            : id === "R4"
              ? await detectPrepayBookingDegraded(options)
              : id === "R5"
                ? [
                    ...(await detectOutboxFailed(options)),
                    ...(await detectOutboxStale(options)),
                    ...(await detectStuckPending(options)),
                  ]
                : await detectDoubleWallet(options);

    detected += drafts.length;
    const result = await upsertFinanceReconFindings(drafts);
    upserted += result.upserted;
    reopened += result.reopened;
  }

  let autoRepaired = 0;
  if (isAutoRepairEnabled()) {
    const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
    const openPaid = await admin.financeReconFinding.findMany({
      where: {
        status: "open",
        code: {
          in: [FINANCE_RECON_CODE.paidNoLedger, FINANCE_RECON_CODE.paidBookingDrift],
        },
        ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
      },
      take: 50,
      select: { id: true, tenantId: true },
    });
    for (const row of openPaid) {
      const repair = await repairFinanceReconFinding({
        findingId: row.id,
        tenantId: row.tenantId,
        dryRun: false,
        mode: "automatic",
        reason: "automatic_safe_repair",
        actorUserId: "auto-repair",
      });
      if (repair.result === "ok" || repair.result === "noop") {
        autoRepaired += 1;
      }
    }
  }

  const open = await countOpenFinanceReconFindings();
  metricsRegistry.observe(FINDINGS_OPEN, open);

  logger.info(
    {
      event: "finance.recon.scan",
      job,
      detected,
      upserted,
      reopened,
      auto_repaired: autoRepaired,
      open_findings: open,
    },
    "finance recon scan complete"
  );

  return { job, detected, upserted, reopened, autoRepaired };
}

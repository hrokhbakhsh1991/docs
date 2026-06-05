/**
 * Isolated subprocess for Phase 4–5 transactional crash chaos.
 *
 * Runs one `persistNewTourAtomically` and honors `P5_CHAOS_ABORT`:
 * - `pre_commit` | `before_outbox` | `outbox` — maps to `P5_ATOMIC_TX_TEST_ABORT` throw hooks
 * - `sigkill` — sleeps inside open TX (`P5_CHAOS_SLEEP_MS`) then self-SIGKILL
 *
 * Required env: `P5_CHAOS_TENANT_ID`, `P5_CHAOS_MARKER_TITLE`, `P5_CHAOS_ABORT`
 */
import { persistNewTourAtomically } from "../../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { disconnectPrisma } from "../../src/db/prisma";
import { resolveInternalErrorCode } from "../../src/observability/log-safety";
import { emitChaosHarnessError } from "./chaos-harness-stderr";

const tenantId = process.env.P5_CHAOS_TENANT_ID?.trim();
const markerTitle = process.env.P5_CHAOS_MARKER_TITLE?.trim();
const chaosAbort = process.env.P5_CHAOS_ABORT?.trim();

if (!tenantId || !markerTitle || !chaosAbort) {
  emitChaosHarnessError("chaos.boot.failed", "CHAOS_ENV_REQUIRED");
  process.exit(2);
}

process.env.STORAGE_DRIVER = "prisma";

if (chaosAbort === "pre_commit" || chaosAbort === "before_outbox" || chaosAbort === "outbox") {
  process.env.P5_ATOMIC_TX_TEST_ABORT = chaosAbort;
} else if (chaosAbort === "sigkill") {
  process.env.P5_CHAOS_ABORT = "sigkill";
}

async function main(): Promise<void> {
  const canonical = await runPreTransactionValidation({
    body: {
      data: {
        basics: { title: markerTitle },
        details: { summary: "chaos-worker" },
      },
    },
    tenantId,
    workspaceType: "starter",
  });

  await persistNewTourAtomically({ tenantId, canonical });
}

main()
  .then(async () => {
    await disconnectPrisma();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("P5_ATOMIC_TX_TEST_ABORT")) {
      process.exitCode = 1;
    } else {
      emitChaosHarnessError("chaos.persist.failed", resolveInternalErrorCode(error));
      process.exitCode = 2;
    }
    clearPreTransactionValidationGate();
    await disconnectPrisma();
  });

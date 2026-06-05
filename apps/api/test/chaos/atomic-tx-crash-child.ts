/**
 * Subprocess entry for hardened-gate chaos — simulates mid-TX process death via
 * P5_ATOMIC_TX_TEST_ABORT=process_exit (parent verifies DB rollback).
 */
import { persistNewTourAtomically } from "../../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { resolveInternalErrorCode } from "../../src/observability/log-safety";
import { emitChaosHarnessError } from "./chaos-harness-stderr";

const tenantId = process.env.CHAOS_TENANT_ID?.trim();
const markerTitle = process.env.CHAOS_MARKER_TITLE?.trim() ?? "Chaos Crash Child";

if (!tenantId) {
  emitChaosHarnessError("chaos.boot.failed", "CHAOS_ENV_REQUIRED");
  process.exit(2);
}

process.env.STORAGE_DRIVER = "prisma";
process.env.P5_ATOMIC_TX_TEST_ABORT = "process_exit";

async function main(): Promise<void> {
  const canonical = await runPreTransactionValidation({
    body: {
      data: {
        basics: { title: markerTitle },
        details: { summary: "crash-child" },
      },
    },
    tenantId,
    workspaceType: "starter",
  });

  await persistNewTourAtomically({ tenantId, canonical });
}

main()
  .catch((error: unknown) => {
    emitChaosHarnessError("chaos.persist.failed", resolveInternalErrorCode(error));
    process.exit(2);
  })
  .finally(() => {
    clearPreTransactionValidationGate();
  });

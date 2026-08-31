import { requiresProductionGradeIntegrity } from "../server/runtime-profile";

export const PRODUCTION_OUTBOX_RELAY_REQUIRED = "PRODUCTION_OUTBOX_RELAY_REQUIRED";

/**
 * MR-P0-008 / PREV-AUD-006 — production/prodlike must run outbox effects somehow.
 * Either in-process (`OUTBOX_RELAY_ENABLED=true`) or an external worker
 * (`OUTBOX_RELAY_EXTERNAL_WORKER=true` **and** `APPS_API_WORKER_ROLE=outbox-relay`).
 */
export function assertProductionOutboxRelayPosture(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (!requiresProductionGradeIntegrity(env)) {
    return;
  }
  const inProcess = env.OUTBOX_RELAY_ENABLED?.trim().toLowerCase() === "true";
  const externalWorker = env.OUTBOX_RELAY_EXTERNAL_WORKER?.trim().toLowerCase() === "true";
  if (!inProcess && !externalWorker) {
    throw new Error(PRODUCTION_OUTBOX_RELAY_REQUIRED);
  }
  if (externalWorker && !inProcess) {
    const role = env.APPS_API_WORKER_ROLE?.trim().toLowerCase() ?? "";
    if (role !== "outbox-relay") {
      throw new Error(PRODUCTION_OUTBOX_RELAY_REQUIRED);
    }
  }
}

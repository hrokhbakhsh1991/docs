export const PRODUCTION_OUTBOX_RELAY_REQUIRED = "PRODUCTION_OUTBOX_RELAY_REQUIRED";

/**
 * MR-P0-008 — production must run outbox effects somehow.
 * Either in-process (`OUTBOX_RELAY_ENABLED=true`) or an external worker
 * (`OUTBOX_RELAY_EXTERNAL_WORKER=true` with APPS_API_WORKER_ROLE=outbox-relay).
 */
export function assertProductionOutboxRelayPosture(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.NODE_ENV?.trim() !== "production") {
    return;
  }
  const inProcess = env.OUTBOX_RELAY_ENABLED?.trim().toLowerCase() === "true";
  const externalWorker = env.OUTBOX_RELAY_EXTERNAL_WORKER?.trim().toLowerCase() === "true";
  if (!inProcess && !externalWorker) {
    throw new Error(PRODUCTION_OUTBOX_RELAY_REQUIRED);
  }
}

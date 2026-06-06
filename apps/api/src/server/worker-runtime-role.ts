export type WorkerRuntimeRole = "api" | "outbox-relay";

export const OUTBOX_RELAY_WORKER_REQUIRES_RELAY_ENABLED =
  "OUTBOX_RELAY_WORKER_REQUIRES_RELAY_ENABLED";

/**
 * DEC-118 — split API vs background relay worker boot.
 * @see docs/phase-5/appendices/argo-rollouts-progressive-delivery.md
 */
export function resolveWorkerRuntimeRole(): WorkerRuntimeRole {
  const raw = process.env.WORKER_ROLE?.trim().toLowerCase();
  if (raw === "outbox-relay") {
    return "outbox-relay";
  }
  return "api";
}

export function assertOutboxRelayWorkerRelayEnabled(): void {
  if (process.env.OUTBOX_RELAY_ENABLED?.trim().toLowerCase() !== "true") {
    throw new Error(OUTBOX_RELAY_WORKER_REQUIRES_RELAY_ENABLED);
  }
}

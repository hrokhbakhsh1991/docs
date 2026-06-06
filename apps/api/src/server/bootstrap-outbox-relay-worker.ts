import { createServer } from "node:http";

import { assertProductionDatabaseIntegrity } from "../db/assert-production-database-integrity";
import { assertAuthEnvironmentIntegrity } from "../tenant-kernel/auth-env";
import { assertProductionRuntimeIntegrity } from "./production-runtime-env";
import { logger } from "../observability/logger";
import { startOutboxRelayIfEnabled } from "../outbox/start-outbox-relay";
import { startProjectionAutoReconcileIfEnabled } from "../outbox/start-projection-auto-reconcile";
import { installGracefulShutdownHandlers } from "./graceful-shutdown";
import { createRelayWorkerListener } from "./create-relay-worker-listener";
import { assertOutboxRelayWorkerRelayEnabled } from "./worker-runtime-role";

/**
 * DEC-118 — background worker: relay + projection reconcile; no tour HTTP API.
 * @see docs/phase-5/appendices/argo-rollouts-progressive-delivery.md
 */
export async function bootstrapOutboxRelayWorker(): Promise<void> {
  assertAuthEnvironmentIntegrity();
  assertProductionRuntimeIntegrity();
  await assertProductionDatabaseIntegrity();
  assertOutboxRelayWorkerRelayEnabled();

  const port = Number(process.env.PORT ?? 3001);
  const server = createServer(createRelayWorkerListener());

  const outboxRelay = startOutboxRelayIfEnabled();
  startProjectionAutoReconcileIfEnabled();

  installGracefulShutdownHandlers({ server, outboxRelay });

  server.listen(port, () => {
    logger.info(
      { event: "relay_worker.start", port, workerRole: "outbox-relay" },
      "@apps/api outbox-relay worker listening"
    );
  });
}

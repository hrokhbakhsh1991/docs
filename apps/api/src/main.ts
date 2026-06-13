import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { AppDeps } from "./app";
import { createHealthAwareServerListener } from "./boot/health-priority-ingress";
import { logger } from "./observability/logger";
import { bootstrapOutboxRelayWorker } from "./server/bootstrap-outbox-relay-worker";
import { installGracefulShutdownHandlers } from "./server/graceful-shutdown";
import { rejectRequestDuringShutdown } from "./http/shutdown-ingress";
import { resolveWorkerRuntimeRole } from "./server/worker-runtime-role";
import type { OutboxRelayHandle } from "./outbox/start-outbox-relay";

type AppRequestListener = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

async function warmPostListen(): Promise<void> {
  const [
    { startOutboxRelayIfEnabled },
    { startProjectionAutoReconcileIfEnabled },
    { bootstrapDenaliWizardTemplatesIfNeeded },
    { bootstrapOperatorSmokeCatalogIfNeeded },
    { bootstrapDenaliDevSmokeFixturesIfNeeded },
  ] = await Promise.all([
    import("./outbox/start-outbox-relay"),
    import("./outbox/start-projection-auto-reconcile"),
    import("./settings/bootstrap-denali-wizard-template"),
    import("./settings/bootstrap-operator-smoke-catalog"),
    import("./settings/bootstrap-denali-dev-smoke-fixtures"),
  ]);
  startOutboxRelayIfEnabled();
  startProjectionAutoReconcileIfEnabled();
  await bootstrapDenaliWizardTemplatesIfNeeded();
  await bootstrapOperatorSmokeCatalogIfNeeded();
  await bootstrapDenaliDevSmokeFixturesIfNeeded();
}

function createDeferredAppListener(appDeps: AppDeps): AppRequestListener {
  let fullListener: AppRequestListener | undefined;
  let fullListenerPromise: Promise<AppRequestListener> | undefined;

  const resolveFullListener = async (): Promise<AppRequestListener> => {
    if (fullListener !== undefined) {
      return fullListener;
    }
    if (fullListenerPromise === undefined) {
      fullListenerPromise = import("./app").then(({ createRequestListener }) => {
        fullListener = createRequestListener(appDeps);
        return fullListener;
      });
    }
    return fullListenerPromise;
  };

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (rejectRequestDuringShutdown(req, res)) {
      return;
    }

    const listener = await resolveFullListener();
    await listener(req, res);
  };
}

async function bootstrap(): Promise<void> {
  if (resolveWorkerRuntimeRole() === "outbox-relay") {
    await bootstrapOutboxRelayWorker();
    return;
  }

  const [
    { assertAuthEnvironmentIntegrity, isProductionAuthMode },
    { assertProductionRuntimeIntegrity },
  ] = await Promise.all([
    import("./tenant-kernel/auth-env"),
    import("./server/production-runtime-env"),
  ]);

  assertAuthEnvironmentIntegrity();
  assertProductionRuntimeIntegrity();

  const port = Number(process.env.PORT ?? 3001);
  const productionBoot = isProductionAuthMode();

  if (productionBoot) {
    const { assertProductionDatabaseIntegrity } =
      await import("./db/assert-production-database-integrity");
    await assertProductionDatabaseIntegrity();
  }

  const mapUpstreamBaseUrl = process.env.MAP_UPSTREAM_BASE_URL?.trim();
  let appDeps: AppDeps = {};
  if (mapUpstreamBaseUrl) {
    const { TenantHttpProxy } = await import("./proxy/tenant-http-proxy");
    appDeps = {
      tenantHttpProxy: new TenantHttpProxy({
        upstreamBaseUrl: mapUpstreamBaseUrl,
        cacheResponses: true,
      }),
    };
  }

  const dispatch = createDeferredAppListener(appDeps);
  const server = createServer(createHealthAwareServerListener(dispatch));

  let outboxRelay: OutboxRelayHandle = { stop: async () => {} };
  if (productionBoot) {
    const { startOutboxRelayIfEnabled } = await import("./outbox/start-outbox-relay");
    const { startProjectionAutoReconcileIfEnabled } =
      await import("./outbox/start-projection-auto-reconcile");
    outboxRelay = startOutboxRelayIfEnabled();
    startProjectionAutoReconcileIfEnabled();
  }

  installGracefulShutdownHandlers({ server, outboxRelay });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      logger.info({ event: "server.start", port }, "@apps/api listening");
      resolve();
    });
  });

  if (!productionBoot) {
    void warmPostListen();
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ event: "server.boot.failed", error: message }, "boot failed");
  process.exit(1);
});

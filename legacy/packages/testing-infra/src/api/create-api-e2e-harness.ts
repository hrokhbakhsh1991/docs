import { applyTestContainerEnv } from "../core/apply-container-env";
import { loadDotEnvTest } from "../core/load-dotenv-test";
import { resetTestDatabaseWithMigrations } from "../core/reset-database";
import { startPostgresTestContainer } from "../core/testcontainers-postgres";
import type { ApiE2eHarnessContext, ApiE2eHarnessOptions } from "../core/types";

const DEFAULT_MIGRATIONS = ["src/database/migrations/*.ts"];

/**
 * Lifecycle factory for API Testcontainers e2e: Postgres → env → optional DB reset hook.
 * Nest `createE2EApp` remains in `apps/api/test/e2e/bootstrap.ts`.
 */
export async function createApiE2eHarness(
  options: ApiE2eHarnessOptions,
): Promise<ApiE2eHarnessContext> {
  const migrations = options.migrations ?? DEFAULT_MIGRATIONS;
  let container: ApiE2eHarnessContext["container"];
  let unavailableReason: string | null = null;

  if (!options.skipContainer) {
    try {
      container = await startPostgresTestContainer(options.postgresImage);
    } catch (error: unknown) {
      unavailableReason = `testcontainers unavailable: ${String(error)}`;
    }
  }

  const applyEnv = (): void => {
    loadDotEnvTest({ cwd: options.cwd });
    if (options.envOverrides) {
      for (const [key, value] of Object.entries(options.envOverrides)) {
        process.env[key] = value;
      }
    }
    if (container) {
      applyTestContainerEnv(container, options.jwtKeys, {
        internalApiKey: options.internalApiKey,
        ...options.containerEnv,
      });
    }
  };

  return {
    container,
    unavailableReason,
    applyEnv,
    resetDatabase: async () => {
      await resetTestDatabaseWithMigrations({ migrations });
    },
    teardown: async () => {
      if (container) {
        await container.stop();
      }
    },
  };
}

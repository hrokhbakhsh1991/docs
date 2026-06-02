import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { TenantSessionBindingService } from "../../src/database/tenant-session-binding.service";
import { assignTestApiPort } from "../e2e/assign-test-api-port";
import { createE2EApp } from "../e2e/bootstrap";
import { resetTestDatabaseWithMigrations } from "../e2e/reset-test-database";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "../e2e/jwt-test-keys";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PARALLEL_WORKERS = 24;
const DATABASE_POOL_MAX = "4";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;

function applyEnvForContainer(db: StartedPostgreSqlContainer): void {
  process.env.NODE_ENV = "test";
  assignTestApiPort();
  process.env.LOG_LEVEL = "error";
  process.env.DATABASE_HOST = db.getHost();
  process.env.DATABASE_PORT = String(db.getPort());
  process.env.DATABASE_USER = db.getUsername();
  process.env.DATABASE_PASSWORD = db.getPassword();
  process.env.DATABASE_NAME = db.getDatabase();
  process.env.DATABASE_URL = db.getConnectionUri();
  process.env.DATABASE_POOL_MAX = DATABASE_POOL_MAX;
  process.env.JWT_PRIVATE_KEY = E2E_JWT_PRIVATE_KEY_PKCS8;
  process.env.JWT_PUBLIC_KEY = E2E_JWT_PUBLIC_KEY_SPKI;
  process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "test-issuer";
  process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "test-audience";
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "test-token";
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
  process.env.REDIS_PORT = process.env.REDIS_PORT ?? "6379";
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.RECONCILIATION_ENABLED = "false";
  process.env.PAYMENTS_TIMEOUT_ENABLED = "false";
}

type PoolProbeResult = {
  workerIndex: number;
  tenantId: string;
  backendPid: number;
  rowId: string;
};

async function runConcurrentPoolProbe(
  dataSource: DataSource,
  bindingService: TenantSessionBindingService,
  tableName: string,
  workerIndex: number,
): Promise<PoolProbeResult> {
  const tenantId = workerIndex % 2 === 0 ? TENANT_A : TENANT_B;
  const oppositeTenantId = tenantId === TENANT_A ? TENANT_B : TENANT_A;
  const rowId = randomUUID();
  const runner = dataSource.createQueryRunner();
  await runner.connect();

  try {
    let backendPid = 0;

    await bindingService.runInTenantContext(tenantId, async () => {
      if (workerIndex % 3 === 0) {
        await assert.rejects(
          async () => runner.query(`SELECT * FROM ${tableName} WHERE id = $1`, ["not-a-uuid"]),
          /invalid input syntax for type uuid|22P02/i,
        );
        const pidRows = (await runner.query(
          "SELECT pg_backend_pid() AS pid",
        )) as Array<{ pid: number }>;
        backendPid = Number(pidRows[0]?.pid);
        return;
      }

      await runner.query(
        `INSERT INTO ${tableName} (id, tenant_id, payload) VALUES ($1, $2, $3)`,
        [rowId, tenantId, `worker-${workerIndex}`],
      );

      const pidRows = (await runner.query(
        "SELECT pg_backend_pid() AS pid",
      )) as Array<{ pid: number }>;
      backendPid = Number(pidRows[0]?.pid);
      assert.ok(backendPid > 0, `worker ${workerIndex} must capture backend pid`);

      const scopedGuc = (await runner.query(
        "SELECT current_setting('app.tenant_id', true) AS tenant_id",
      )) as Array<{ tenant_id: string | null }>;
      assert.equal(
        scopedGuc[0]?.tenant_id,
        tenantId,
        `worker ${workerIndex} must bind its tenant GUC`,
      );

      const ownRow = (await runner.query(
        `SELECT payload FROM ${tableName} WHERE id = $1`,
        [rowId],
      )) as Array<{ payload: string }>;
      assert.equal(ownRow.length, 1, `worker ${workerIndex} must read its own row`);

      const leakedOppositeRows = (await runner.query(
        `SELECT payload FROM ${tableName} WHERE tenant_id = $1`,
        [oppositeTenantId],
      )) as Array<{ payload: string }>;
      assert.equal(
        leakedOppositeRows.length,
        0,
        `worker ${workerIndex} must not read opposite tenant rows under RLS`,
      );
    });

    return { workerIndex, tenantId, backendPid, rowId };
  } finally {
    await runner.release();
  }
}

before(async () => {
  try {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
  } catch (error: unknown) {
    e2eUnavailableReason = `testcontainers unavailable: ${String(error)}`;
    return;
  }
  applyEnvForContainer(container);
  await resetTestDatabaseWithMigrations();
  app = await createE2EApp();
});

after(async () => {
  try {
    if (app) {
      await app.close();
    }
  } catch {
    /* ignore redis/socket teardown races in test harness */
  } finally {
    app = undefined;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 1_100));
  try {
    if (container) {
      await container.stop();
    }
  } catch {
    /* ignore */
  } finally {
    container = undefined;
  }
});

test("parallel pool checkout does not leak tenant RLS context under concurrent load", async (t) => {
  if (e2eUnavailableReason || !app) {
    t.skip(e2eUnavailableReason ?? "app unavailable");
    return;
  }

  const dataSource = app.get(DataSource);
  const bindingService = app.get(TenantSessionBindingService);
  const tableName = `pool_contamination_${Date.now()}`;

  await dataSource.query(
    `CREATE TABLE ${tableName} (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      payload text NOT NULL
    )`,
  );
  await dataSource.query(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`);
  await dataSource.query(`ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY`);
  await dataSource.query(
    `CREATE POLICY tenant_isolation_policy ON ${tableName}
     USING (tenant_id = current_setting('app.tenant_id')::uuid)
     WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)`,
  );

  try {
    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL_WORKERS }, (_, workerIndex) =>
        runConcurrentPoolProbe(dataSource, bindingService, tableName, workerIndex),
      ),
    );

    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    assert.equal(
      failures.length,
      0,
      failures.map((failure) => String(failure.reason)).join("\n"),
    );

    const probes = results
      .filter((result): result is PromiseFulfilledResult<PoolProbeResult> => result.status === "fulfilled")
      .map((result) => result.value);

    assert.equal(probes.length, PARALLEL_WORKERS);
    assert.equal(process.env.DATABASE_POOL_MAX, DATABASE_POOL_MAX);

    const faultWorkers = probes.filter((probe) => probe.workerIndex % 3 === 0);
    const healthyWorkers = probes.filter((probe) => probe.workerIndex % 3 !== 0);
    assert.equal(faultWorkers.length, 8, "UUID fault-path workers must complete without top-level rejection");
    assert.equal(healthyWorkers.length, 16, "healthy workers must complete RLS-scoped inserts");

    for (const probe of faultWorkers) {
      assert.ok(probe.backendPid > 0, `fault worker ${probe.workerIndex} must capture backend pid before abort`);
    }

    for (const probe of healthyWorkers) {
      assert.ok(probe.backendPid > 0, `healthy worker ${probe.workerIndex} must capture backend pid`);
      assert.ok(probe.rowId.length > 0, `healthy worker ${probe.workerIndex} must persist a row id`);
    }

    const uniquePids = new Set(probes.map((probe) => probe.backendPid));
    assert.ok(
      uniquePids.size <= Number(DATABASE_POOL_MAX),
      `expected at most ${DATABASE_POOL_MAX} physical backends under pool cap, saw ${uniquePids.size}`,
    );
    assert.ok(
      uniquePids.size > 1,
      "parallel workers must exercise more than one pooled backend pid",
    );
  } finally {
    await dataSource.query(`DROP TABLE IF EXISTS ${tableName}`);
  }
});

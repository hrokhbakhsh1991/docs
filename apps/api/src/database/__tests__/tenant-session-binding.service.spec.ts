import assert from "node:assert/strict";
import test from "node:test";
import type { QueryRunner } from "typeorm";
import { TenantContextMissingError } from "../../common/errors/tenant-context-missing.error";
import { TenantBindingMode } from "../../common/request-context/request-context";
import { TenantSessionBindingService } from "../tenant-session-binding.service";

function createServiceWithMissingContext() {
  const dataSource = {
    createQueryRunner: () => {
      throw new Error("not used");
    }
  };
  const requestContextService = {
    getContext: () => {
      throw new TenantContextMissingError("simulated context loss");
    }
  };
  const loggerService = {
    error: () => undefined,
    warn: () => undefined
  };

  return new TenantSessionBindingService(
    dataSource as never,
    requestContextService as never,
    loggerService as never
  );
}

test("tenant binding fails closed when request context is missing", async () => {
  const service = createServiceWithMissingContext();
  const queryRunner = {} as QueryRunner;
  await assert.rejects(
    async () => service.bindTenantId(queryRunner),
    (error: unknown) => error instanceof TenantContextMissingError
  );
});

test("tenant binding skips implicit bind when context is missing before first query", async () => {
  const service = createServiceWithMissingContext();
  const queryRunner = {
    isTransactionActive: false
  } as QueryRunner;
  let queryCalled = false;

  const originalQuery = async () => {
    queryCalled = true;
    return {
      raw: [],
      records: []
    };
  };
  const originalStartTransaction = async () => undefined;

  await assert.doesNotReject(
    async () =>
      (
        service as unknown as {
          ensurePostgresTransactionAndTenantGuc: (
            q: QueryRunner,
            oq: QueryRunner["query"],
            ost: QueryRunner["startTransaction"]
          ) => Promise<void>;
        }
      ).ensurePostgresTransactionAndTenantGuc(
        queryRunner,
        originalQuery as unknown as QueryRunner["query"],
        originalStartTransaction as QueryRunner["startTransaction"]
      )
  );

  assert.equal(queryCalled, false);
});

test("normal mode requires tenant id for binding", async () => {
  const service = new TenantSessionBindingService(
    { createQueryRunner: () => ({}) } as never,
    {
      getContext: () => ({
        requestId: "req-normal",
        method: "GET",
        path: "/api/v2/tours",
        tenantBindingMode: TenantBindingMode.Normal
      })
    } as never,
    {
      error: () => undefined,
      warn: () => undefined
    } as never
  );

  await assert.rejects(
    async () => service.bindTenantId({} as QueryRunner),
    (error: unknown) => error instanceof TenantContextMissingError
  );
});

test("suppressed mode allows only tenant resolver select", () => {
  const service = new TenantSessionBindingService(
    { createQueryRunner: () => ({}) } as never,
    {
      getContext: () => ({
        requestId: "req-suppressed",
        method: "POST",
        path: "/api/v2/auth/web/session/otp",
        tenantBindingMode: TenantBindingMode.Suppressed,
        tenantBindingSuppressed: true,
        tenantBindingSuppressionReason: "tenant_host_resolution"
      })
    } as never,
    {
      error: () => undefined,
      warn: () => undefined
    } as never
  ) as unknown as {
    assertSuppressedModeQueryAllowed: (
      queryRunner: QueryRunner,
      query: Parameters<QueryRunner["query"]>[0]
    ) => void;
  };

  assert.doesNotThrow(() =>
    service.assertSuppressedModeQueryAllowed(
      {} as QueryRunner,
      'SELECT "t"."id" AS "t_id" FROM "tenants" "t" WHERE LOWER(t.subdomain) = $1 AND t.deleted_at IS NULL'
    )
  );

  assert.throws(
    () =>
      service.assertSuppressedModeQueryAllowed(
        {} as QueryRunner,
        'SELECT "u"."id" AS "u_id" FROM "user_tenants" "u" WHERE u.deleted_at IS NULL'
      ),
    /TENANT_BINDING_SUPPRESSED_QUERY_FORBIDDEN/
  );
});

test("suppressed bootstrap flow allows only bootstrap tenant lookup", () => {
  const service = new TenantSessionBindingService(
    { createQueryRunner: () => ({}) } as never,
    {
      getContext: () => ({
        requestId: "req-bootstrap",
        method: "POST",
        path: "/api/v2/tours/:id/register",
        tenantBindingMode: TenantBindingMode.Suppressed,
        tenantBindingSuppressed: true,
        tenantBindingSuppressionReason: "public_tour_bootstrap_lookup"
      })
    } as never,
    {
      error: () => undefined,
      warn: () => undefined
    } as never
  ) as unknown as {
    assertSuppressedModeQueryAllowed: (
      queryRunner: QueryRunner,
      query: Parameters<QueryRunner["query"]>[0]
    ) => void;
  };

  assert.doesNotThrow(() =>
    service.assertSuppressedModeQueryAllowed(
      {} as QueryRunner,
      `SELECT tenant_id::text AS tenant_id
         FROM tours
        WHERE id = $1::uuid
          AND deleted_at IS NULL`
    )
  );
  assert.throws(
    () =>
      service.assertSuppressedModeQueryAllowed(
        {} as QueryRunner,
        'SELECT "u"."id" AS "u_id" FROM "user_tenants" "u" WHERE u.deleted_at IS NULL'
      ),
    /TENANT_BINDING_SUPPRESSED_QUERY_FORBIDDEN/
  );
});

test("normal mode applies app.tenant_id set_config with tenant context", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const service = new TenantSessionBindingService(
    { createQueryRunner: () => ({}) } as never,
    {
      getContext: () => ({
        requestId: "req-bind",
        method: "GET",
        path: "/api/v2/tours",
        tenantId,
        tenantBindingMode: TenantBindingMode.Normal
      })
    } as never,
    {
      error: () => undefined,
      warn: () => undefined
    } as never
  ) as unknown as {
    applyTenantIdSetConfig: (
      queryRunner: QueryRunner,
      originalQuery: QueryRunner["query"]
    ) => Promise<void>;
  };

  const originalQuery = (async (sql: string, params: unknown[]) => {
    executed.push({ sql, params });
    return [];
  }) as unknown as QueryRunner["query"];

  await service.applyTenantIdSetConfig({} as QueryRunner, originalQuery);

  assert.equal(executed.length, 1);
  assert.equal(executed[0].sql, "SELECT set_config('app.tenant_id', $1, true)");
  assert.deepEqual(executed[0].params, [tenantId]);
});

test("normal request path injects app.tenant_id before first DB query", async () => {
  const tenantId = "22222222-2222-4222-8222-222222222222";
  const executed: string[] = [];

  const queryRunner = {
    isTransactionActive: false,
    isReleased: false,
    connect: async () => undefined,
    startTransaction: async () => {
      queryRunner.isTransactionActive = true;
    },
    commitTransaction: async () => {
      queryRunner.isTransactionActive = false;
    },
    rollbackTransaction: async () => {
      queryRunner.isTransactionActive = false;
    },
    release: async () => {
      queryRunner.isReleased = true;
    },
    query: async (sql: string) => {
      const normalized = sql.trim().replace(/\s+/g, " ");
      executed.push(normalized);
      if (normalized.includes("txid_current_if_assigned")) {
        return [{ in_tx: false }];
      }
      return [];
    }
  };

  const dataSource = {
    createQueryRunner: () => queryRunner
  };

  const service = new TenantSessionBindingService(
    dataSource as never,
    {
      getContext: () => ({
        requestId: "req-normal-flow",
        method: "GET",
        path: "/api/v2/auth/workspaces",
        tenantId,
        tenantBindingMode: TenantBindingMode.Normal
      })
    } as never,
    {
      error: () => undefined,
      warn: () => undefined
    } as never
  );
  service.onModuleInit();

  const patchedQueryRunner = (dataSource as { createQueryRunner: () => QueryRunner })
    .createQueryRunner();
  await patchedQueryRunner.connect();
  await patchedQueryRunner.query("SELECT 1");

  const firstSetConfigIndex = executed.findIndex((sql) =>
    sql.startsWith("SELECT set_config('app.tenant_id', $1, true)")
  );
  const firstBusinessQueryIndex = executed.findIndex((sql) => sql === "SELECT 1");
  assert.ok(firstSetConfigIndex >= 0);
  assert.ok(firstBusinessQueryIndex >= 0);
  assert.ok(firstSetConfigIndex < firstBusinessQueryIndex);
});

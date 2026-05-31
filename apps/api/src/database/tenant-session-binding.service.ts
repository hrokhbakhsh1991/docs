import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { DataSource, type QueryRunner } from "typeorm";
import { TenantContextMissingError } from "../common/errors/tenant-context-missing.error";
import { LoggerService } from "../common/logger/logger.service";
import { RequestContextService } from "../common/request-context/request-context.service";
import {
  RESET_RLS_TENANT_SQL,
  SET_LOCAL_RLS_TENANT_SQL,
} from "./rls-tenant-session";
import {
  TenantBindingMode,
  requestContextStorage
} from "../common/request-context/request-context";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TENANT_BINDING_PATCHED = Symbol("tenantBindingPatched");
const IN_TYPEORM_START_TRANSACTION = Symbol("inTypeormStartTransaction");
const TENANT_RLS_OPENED_TX_FOR_BINDING = Symbol("tenantRlsOpenedTxForBinding");
const QUERY_REENTRY = Symbol("tenantRlsQueryReentry");
const BYPASS_TENANT_ENSURE = Symbol("bypassTenantEnsure");

type QueryRunnerWithTenantSymbols = QueryRunner & {
  [IN_TYPEORM_START_TRANSACTION]?: boolean;
  [TENANT_RLS_OPENED_TX_FOR_BINDING]?: boolean;
  [QUERY_REENTRY]?: boolean;
  [BYPASS_TENANT_ENSURE]?: boolean;
};

@Injectable()
export class TenantSessionBindingService implements OnModuleInit {
  private warnedMissingAlsContext = false;
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  async runInTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    if (!normalizedTenantId) {
      throw new Error("TENANT_CONTEXT_MISSING");
    }

    const existing = requestContextStorage.getStore();
    if (existing) {
      const previousTenantId = existing.tenantId;
      const previousHostTenantId = existing.hostTenantId;
      const previousFrozen = existing.tenantContextFrozen;
      const previousMode = existing.tenantBindingMode;
      const previousSuppressed = existing.tenantBindingSuppressed;
      const previousReason = existing.tenantBindingSuppressionReason;

      existing.tenantId = normalizedTenantId;
      existing.hostTenantId = normalizedTenantId;
      existing.tenantContextFrozen = true;
      existing.tenantBindingMode = TenantBindingMode.Normal;
      existing.tenantBindingSuppressed = false;
      existing.tenantBindingSuppressionReason = undefined;
      try {
        return await fn();
      } finally {
        existing.tenantId = previousTenantId;
        existing.hostTenantId = previousHostTenantId;
        existing.tenantContextFrozen = previousFrozen;
        existing.tenantBindingMode = previousMode;
        existing.tenantBindingSuppressed = previousSuppressed;
        existing.tenantBindingSuppressionReason = previousReason;
      }
    }

    const workerRequestId = `worker-${randomUUID()}`;
    return requestContextStorage.run(
      {
        requestId: workerRequestId,
        correlationId: workerRequestId,
        tenantId: normalizedTenantId,
        hostTenantId: normalizedTenantId,
        tenantContextFrozen: true,
        tenantBindingMode: TenantBindingMode.Normal,
        tenantBindingSuppressed: false,
        tenantBindingSuppressionReason: undefined
      },
      fn
    );
  }

  onModuleInit(): void {
    if (
      (this.dataSource as DataSource & { [TENANT_BINDING_PATCHED]?: boolean })[
        TENANT_BINDING_PATCHED
      ]
    ) {
      return;
    }

    const originalCreateQueryRunner =
      this.dataSource.createQueryRunner.bind(this.dataSource);

    this.dataSource.createQueryRunner = (mode) => {
      const queryRunner = originalCreateQueryRunner(mode);
      const originalConnect = queryRunner.connect.bind(queryRunner);
      const originalStartTransaction = queryRunner.startTransaction.bind(queryRunner);
      const originalRelease = queryRunner.release.bind(queryRunner);
      const originalQuery = queryRunner.query.bind(queryRunner);
      let tenantBound = false;

      queryRunner.connect = async () => {
        const connected = await originalConnect();

        if (!tenantBound) {
          tenantBound = true;
          await this.bindTenantId(queryRunner);
        }

        return connected;
      };

      queryRunner.startTransaction = async (isolationLevel) => {
        this.assertSuppressedModeTransactionAllowed(queryRunner);
        (queryRunner as QueryRunnerWithTenantSymbols)[IN_TYPEORM_START_TRANSACTION] = true;
        try {
          await originalStartTransaction(isolationLevel);
        } finally {
          (queryRunner as QueryRunnerWithTenantSymbols)[IN_TYPEORM_START_TRANSACTION] = false;
        }
        await this.applyTenantIdSetConfig(queryRunner, originalQuery);
      };

      queryRunner.query = (async (...args: Parameters<QueryRunner["query"]>) => {
        const qr = queryRunner as QueryRunnerWithTenantSymbols;
        if (qr[QUERY_REENTRY]) {
          return await (originalQuery as (..._a: Parameters<QueryRunner["query"]>) => ReturnType<QueryRunner["query"]>).apply(
            queryRunner,
            args
          );
        }
        qr[QUERY_REENTRY] = true;
        try {
          this.assertSuppressedModeQueryAllowed(queryRunner, args[0]);
          await this.ensurePostgresTransactionAndTenantGuc(
            queryRunner,
            originalQuery,
            originalStartTransaction
          );
          return await (originalQuery as (..._a: Parameters<QueryRunner["query"]>) => ReturnType<QueryRunner["query"]>).apply(
            queryRunner,
            args
          );
        } finally {
          qr[QUERY_REENTRY] = false;
        }
      }) as QueryRunner["query"];

      queryRunner.release = async () => {
        const qr = queryRunner as QueryRunnerWithTenantSymbols;
        if (queryRunner.isTransactionActive) {
          try {
            await queryRunner.rollbackTransaction();
          } catch (error: unknown) {
            this.loggerService.warn(
              "tenant query-runner release forced rollback failed before GUC reset",
              {
                error: error instanceof Error ? error.message : String(error),
              },
            );
            if (queryRunner.isTransactionActive) {
              try {
                await queryRunner.rollbackTransaction();
              } catch {
                /* best-effort recovery before GUC reset */
              }
            }
          }
        }
        qr[TENANT_RLS_OPENED_TX_FOR_BINDING] = undefined;

        try {
          await this.resetAppTenantIdForPool(queryRunner, originalQuery);
        } catch {
          // Connection destroyed in resetAppTenantIdForPool — never return a poisoned socket.
          return;
        }
        return originalRelease();
      };

      return queryRunner;
    };

    (
      this.dataSource as DataSource & { [TENANT_BINDING_PATCHED]?: boolean }
    )[TENANT_BINDING_PATCHED] = true;
  }

  async bindTenantId(queryRunner: QueryRunner): Promise<void> {
    const context = this.tryGetRequestContext();
    if (!context) {
      return;
    }
    if (context) {
      this.assertTenantBindingModeState(context);
      if (context.tenantBindingMode === TenantBindingMode.Suppressed) {
        return;
      }
    }
    this.resolveTenantIdForBindingOrThrow(queryRunner);
  }

  private async ensurePostgresTransactionAndTenantGuc(
    queryRunner: QueryRunner,
    originalQuery: QueryRunner["query"],
    originalStartTransaction: QueryRunner["startTransaction"]
  ): Promise<void> {
    const qr = queryRunner as QueryRunnerWithTenantSymbols;
    if (qr[IN_TYPEORM_START_TRANSACTION] || qr[BYPASS_TENANT_ENSURE]) {
      return;
    }

    const context = this.tryGetRequestContext();
    if (!context) {
      return;
    }
    this.assertTenantBindingModeState(context);
    if (context.tenantBindingMode === TenantBindingMode.Suppressed) {
      return;
    }

    this.resolveTenantIdForBindingOrThrow(queryRunner);

    const inTxRows = await this.readPostgresTxStateWithRecovery(queryRunner, originalQuery);

    const inPostgresTx =
      queryRunner.isTransactionActive || inTxRows[0]?.in_tx === true;
    if (!inPostgresTx) {
      qr[BYPASS_TENANT_ENSURE] = true;
      try {
        await (originalStartTransaction as QueryRunner["startTransaction"]).call(queryRunner);
        qr[TENANT_RLS_OPENED_TX_FOR_BINDING] = true;
      } finally {
        qr[BYPASS_TENANT_ENSURE] = false;
      }
    }

    await this.applyTenantIdSetConfig(queryRunner, originalQuery);
  }

  private async readPostgresTxStateWithRecovery(
    queryRunner: QueryRunner,
    originalQuery: QueryRunner["query"]
  ): Promise<Array<{ in_tx: boolean }>> {
    try {
      return (await (originalQuery as (..._a: unknown[]) => Promise<unknown>).call(
        queryRunner,
        "SELECT (txid_current_if_assigned() IS NOT NULL) AS in_tx",
        []
      )) as Array<{ in_tx: boolean }>;
    } catch (error) {
      if (!this.isCurrentTransactionAbortedError(error)) {
        throw error;
      }
      await this.recoverAbortedTransaction(queryRunner, originalQuery);
      return (await (originalQuery as (..._a: unknown[]) => Promise<unknown>).call(
        queryRunner,
        "SELECT (txid_current_if_assigned() IS NOT NULL) AS in_tx",
        []
      )) as Array<{ in_tx: boolean }>;
    }
  }

  private isCurrentTransactionAbortedError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    return error.message.includes("current transaction is aborted");
  }

  private async recoverAbortedTransaction(
    queryRunner: QueryRunner,
    originalQuery: QueryRunner["query"]
  ): Promise<void> {
    if (queryRunner.isTransactionActive) {
      try {
        await queryRunner.rollbackTransaction();
        return;
      } catch {
        // Fallback context
      }
    }
    try {
      await (originalQuery as (..._a: unknown[]) => Promise<unknown>).call(
        queryRunner,
        "ROLLBACK",
        []
      );
    } catch {
      // Trace bypass
    }
  }

  private async applyTenantIdSetConfig(
    queryRunner: QueryRunner,
    originalQuery: QueryRunner["query"]
  ): Promise<void> {
    const context = this.tryGetRequestContext();
    if (!context) {
      return;
    }
    this.assertTenantBindingModeState(context);
    if (context.tenantBindingMode === TenantBindingMode.Suppressed) {
      return;
    }
    const tenantId = this.resolveTenantIdForBindingOrThrow(queryRunner);
    
    /**
     * UNIFIED MULTI-TENANT INFRASTRUCTURE ALIGNMENT (WAVE 8)
     * * Applies the resolved active tenant identifier to the current transaction scope.
     * Both standard tables ('tenant_id') and workspace catalog matrices ('workspace_id')
     * share this unified GUC channel ('app.tenant_id') via their respective database policies.
     */
    await (originalQuery as (..._a: unknown[]) => Promise<unknown>).call(
      queryRunner,
      SET_LOCAL_RLS_TENANT_SQL,
      [tenantId]
    );
  }

  private resolveTenantIdForBindingOrThrow(
    _queryRunner: QueryRunner
  ): string {
    const context = this.tryGetRequestContext();
    if (!context) {
      throw new TenantContextMissingError(
        "Tenant context is unavailable for implicit DB tenant binding"
      );
    }
    this.assertTenantBindingModeState(context);
    if (context.tenantBindingMode === TenantBindingMode.Suppressed) {
      throw new Error("TENANT_BINDING_SUPPRESSED");
    }
    const tenantId = context.tenantId;

    if (!tenantId || tenantId.trim() === "") {
      this.loggerService.error("tenant session binding failed: missing tenant", {
        requestId: context.requestId,
        route: context.path,
        method: context.method
      });
      throw new TenantContextMissingError(
        "Tenant context is missing tenant_id during DB binding"
      );
    }

    if (!UUID_V4_REGEX.test(tenantId)) {
      this.loggerService.error(
        "tenant session binding failed: malformed tenant id",
        {
          requestId: context.requestId,
          tenantId
        }
      );
      throw new Error("TENANT_CONTEXT_INVALID");
    }

    return tenantId;
  }

  private async resetAppTenantIdForPool(
    queryRunner: QueryRunner,
    originalQuery: QueryRunner["query"]
  ): Promise<void> {
    if (queryRunner.isReleased) {
      return;
    }
    try {
      await (originalQuery as (..._a: unknown[]) => Promise<unknown>).call(
        queryRunner,
        RESET_RLS_TENANT_SQL,
        []
      );
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.loggerService.warn(
        "Physical connection socket termination forced due to GUC reset failure",
        { error: err.message },
      );
      try {
        if (!queryRunner.isReleased && queryRunner.connection.isConnected) {
          await queryRunner.connection.destroy();
        }
      } catch {
        /* non-throwing — socket teardown is best-effort after GUC reset failure */
      }
      throw new Error("TENANT_RLS_GUC_RESET_FAILED");
    }
  }

  private getRequestContextOrThrow(): {
    requestId: string;
    path?: string;
    method?: string;
    tenantId?: string;
    tenantBindingMode: TenantBindingMode;
    tenantBindingSuppressed?: boolean;
    tenantBindingSuppressionReason?: string;
  } {
    try {
      const context = this.requestContextService.getContext();
      return {
        requestId: context.requestId,
        path: context.path,
        method: context.method,
        tenantId: context.tenantId,
        tenantBindingMode: context.tenantBindingMode ?? TenantBindingMode.Normal,
        tenantBindingSuppressed: context.tenantBindingSuppressed,
        tenantBindingSuppressionReason: context.tenantBindingSuppressionReason
      };
    } catch (error: unknown) {
      if (error instanceof TenantContextMissingError) {
        throw error;
      }
      throw new TenantContextMissingError("Tenant context retrieval failed");
    }
  }

  private assertSuppressedModeTransactionAllowed(_queryRunner: QueryRunner): void {
    const context = this.tryGetRequestContext();
    if (!context) {
      return;
    }
    this.assertTenantBindingModeState(context);
    if (context.tenantBindingMode !== TenantBindingMode.Suppressed) {
      return;
    }
    this.loggerService.error("tenant binding suppressed mode blocked transaction", {
      requestId: context.requestId,
      route: context.path,
      method: context.method,
      reason: context.tenantBindingSuppressionReason ?? "unknown"
    });
    throw new Error("TENANT_BINDING_SUPPRESSED_TRANSACTION_FORBIDDEN");
  }

  private assertSuppressedModeQueryAllowed(
    _queryRunner: QueryRunner,
    query: Parameters<QueryRunner["query"]>[0]
  ): void {
    const context = this.tryGetRequestContext();
    if (!context) {
      return;
    }
    this.assertTenantBindingModeState(context);
    if (context.tenantBindingMode !== TenantBindingMode.Suppressed) {
      return;
    }
    const reason = context.tenantBindingSuppressionReason?.trim() ?? "";
    if (!reason) {
      throw new Error("TENANT_BINDING_SUPPRESSED_REASON_REQUIRED");
    }
    const sql = typeof query === "string" ? query : "";
    if (this.isAllowedSuppressedQuery(reason, sql)) {
      return;
    }
    this.loggerService.error("tenant binding suppressed mode blocked query", {
      requestId: context.requestId,
      route: context.path,
      method: context.method,
      reason,
      query: sql.slice(0, 200)
    });
    throw new Error("TENANT_BINDING_SUPPRESSED_QUERY_FORBIDDEN");
  }

  private isAllowedSuppressedQuery(reason: string, sql: string): boolean {
    const normalized = sql.trim().replace(/\s+/g, " ").toLowerCase();
    if (!normalized.startsWith("select ")) {
      return false;
    }
    if (reason === "tenant_host_resolution") {
      const selectsTenants =
        normalized.includes(" from tenants ") ||
        normalized.includes(" from \"tenants\" ") ||
        /(?:^|\s)from\s+(?:"[^"]+"\.)?"tenants"(?:\s|$)/.test(normalized);
      const subdomainLookup = normalized.includes("subdomain");
      const softDeleteGuard =
        normalized.includes("deleted_at is null") ||
        normalized.includes("deleted_at\" is null") ||
        normalized.includes("\"deleted_at\" is null") ||
        /(?:^|\s)(?:"[^"]+"\.)?"deleted_at"\s+is\s+null(?:\s|$)/.test(normalized);
      const hasMutationKeyword =
        normalized.includes(" insert ") ||
        normalized.includes(" update ") ||
        normalized.includes(" delete ") ||
        normalized.includes(" upsert ") ||
        normalized.includes(" into ");
      return selectsTenants && subdomainLookup && softDeleteGuard && !hasMutationKeyword;
    }
    if (reason === "public_tour_bootstrap_lookup") {
      const selectsTours =
        normalized.includes(" from tours ") || normalized.includes(" from \"tours\" ");
      const byPrimaryId =
        normalized.includes(" where id =") ||
        normalized.includes(" where \"id\" =") ||
        normalized.includes(" where t.id =") ||
        normalized.includes(" where \"t\".\"id\" =");
      const deletedNull = normalized.includes("deleted_at is null");
      const referencesTenants =
        normalized.includes(" tenants ") || normalized.includes(" from \"tenants\" ");
      const allowedTenantJoin =
        !referencesTenants ||
        normalized.includes(" join tenants ") ||
        normalized.includes(" join \"tenants\" ");
      return selectsTours && byPrimaryId && deletedNull && allowedTenantJoin;
    }
    if (reason === "health_ready_probe") {
      return /^select 1(?:\s+as\s+\w+)?\s*;?$/.test(normalized);
    }
    return false;
  }

  private assertTenantBindingModeState(context: {
    tenantBindingMode: TenantBindingMode;
    tenantBindingSuppressed?: boolean;
    tenantBindingSuppressionReason?: string;
  }): void {
    const suppressed = context.tenantBindingSuppressed === true;
    if (context.tenantBindingMode === TenantBindingMode.Suppressed) {
      if (!suppressed) {
        throw new Error("TENANT_BINDING_SUPPRESSED_FLAG_REQUIRED");
      }
      if (!context.tenantBindingSuppressionReason?.trim()) {
        throw new Error("TENANT_BINDING_SUPPRESSED_REASON_REQUIRED");
      }
      return;
    }
    if (suppressed) {
      throw new Error("TENANT_BINDING_MODE_STATE_INVALID");
    }
  }

  private tryGetRequestContext():
    | {
        requestId: string;
        path?: string;
        method?: string;
        tenantId?: string;
        tenantBindingMode: TenantBindingMode;
        tenantBindingSuppressed?: boolean;
        tenantBindingSuppressionReason?: string;
      }
    | null {
    try {
      return this.getRequestContextOrThrow();
    } catch (error: unknown) {
      if (!(error instanceof TenantContextMissingError)) {
        throw error;
      }
      if (!this.warnedMissingAlsContext) {
        this.warnedMissingAlsContext = true;
        this.loggerService.warn(
          "tenant query-runner implicit binding skipped: no ALS context (expected for worker/scheduler explicit tenant scope)",
          { error: error.message }
        );
      }
      return null;
    }
  }
}
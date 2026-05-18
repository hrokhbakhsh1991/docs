import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { DataSource, type QueryRunner } from "typeorm";
import { TenantContextMissingError } from "../common/errors/tenant-context-missing.error";
import { LoggerService } from "../common/logger/logger.service";
import { RequestContextService } from "../common/request-context/request-context.service";
import {
  TenantBindingMode,
  requestContextStorage
} from "../common/request-context/request-context";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// DataSource-level idempotency marker: patch QueryRunner lifecycle only once.
const TENANT_BINDING_PATCHED = Symbol("tenantBindingPatched");
// Guards nested transaction flows when TypeORM internally triggers startTransaction.
const IN_TYPEORM_START_TRANSACTION = Symbol("inTypeormStartTransaction");
// Marks tx opened implicitly by this service (so release can safely close it).
const TENANT_RLS_OPENED_TX_FOR_BINDING = Symbol("tenantRlsOpenedTxForBinding");
// Prevents recursive query interception loops while patched query() calls originalQuery().
const QUERY_REENTRY = Symbol("tenantRlsQueryReentry");
/** Set while `ensurePostgresTransactionAndTenantGuc` runs `originalStartTransaction` so nested `query()` calls skip ensure (avoids re-entrant BEGIN). */
const BYPASS_TENANT_ENSURE = Symbol("bypassTenantEnsure");

type QueryRunnerWithTenantSymbols = QueryRunner & {
  [IN_TYPEORM_START_TRANSACTION]?: boolean;
  [TENANT_RLS_OPENED_TX_FOR_BINDING]?: boolean;
  [QUERY_REENTRY]?: boolean;
  [BYPASS_TENANT_ENSURE]?: boolean;
};

@Injectable()
/**
 * Tenant binding runtime boundary for all TypeORM QueryRunners.
 *
 * Architecture in one view:
 * - HTTP request flows rely on implicit binding: this service patches QueryRunner lifecycle
 *   and injects `app.tenant_id` before tenant-scoped SQL executes.
 * - Worker/scheduler flows rely on explicit binding: callers use `runInTenantContext(...)`
 *   (and typically `TenantDbContextService`) to create/restore scoped ALS tenant context.
 * - Suppressed mode (`runWithoutTenantBinding`) is a narrow bootstrap escape hatch with
 *   allow-listed read-only query shapes.
 *
 * Invariant:
 * - RLS tenant GUC (`app.tenant_id`) must be transaction-local and must not leak across
 *   pooled connections.
 *
 * Interception pipeline (high-level):
 * - connect() -> validate tenant-binding eligibility (no SQL mutation yet)
 * - startTransaction() -> enforce suppression policy + apply tenant GUC
 * - query() -> enforce allow-list, auto-open tx if needed, then ensure tenant GUC
 * - release() -> close implicit tx (if opened by binder) + RESET app.tenant_id
 */
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

    // Reuse current ALS context when present, but restore full prior state afterwards.
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

    // No ALS context exists (typical background flow): create a scoped worker context.
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

  /**
   * Runtime model for tenant DB binding:
   *
   * - Tenant GUC injection:
   *   `app.tenant_id` is injected via `set_config(..., true)` only when a request
   *   has a normal tenant-binding context and a real Postgres transaction exists.
   *   This keeps RLS scoping transaction-local and avoids leaking tenant scope across
   *   pooled connections.
   *
   * - QueryRunner patch strategy:
   *   We monkey-patch each created `QueryRunner` (`connect`, `startTransaction`,
   *   `query`, and `release`) to enforce a consistent pre-query binding contract
   *   without requiring every repository/service call site to remember manual setup.
   *
   * - HTTP vs worker flows:
   *   HTTP requests usually have ALS context, so implicit binding runs and validates
   *   tenant context before DB access. Worker/scheduler paths may have no ALS context;
   *   in that case implicit binding is intentionally skipped (warn-once), and those
   *   flows are expected to use explicit tenant scoping helpers.
   */
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
        // Interception point: connect
        // Do a one-time tenant-context eligibility check for this runner.
        // The actual GUC write happens only in tx/query interception.
        const connected = await originalConnect();

        if (!tenantBound) {
          tenantBound = true;
          await this.bindTenantId(queryRunner);
        }

        return connected;
      };

      queryRunner.startTransaction = async (isolationLevel) => {
        // Interception point: transaction start
        // Suppressed mode forbids explicit tx starts.
        // In normal mode: start tx first, then inject tenant GUC.
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
        // Interception point: query
        // Before each query:
        // 1) enforce suppressed-mode allow-list
        // 2) ensure active PG tx + tenant GUC in normal mode.
        const qr = queryRunner as QueryRunnerWithTenantSymbols;
        if (qr[QUERY_REENTRY]) {
          return await (originalQuery as (...a: Parameters<QueryRunner["query"]>) => ReturnType<QueryRunner["query"]>).apply(
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
          return await (originalQuery as (...a: Parameters<QueryRunner["query"]>) => ReturnType<QueryRunner["query"]>).apply(
            queryRunner,
            args
          );
        } finally {
          qr[QUERY_REENTRY] = false;
        }
      }) as QueryRunner["query"];

      queryRunner.release = async () => {
        // Interception point: release
        // Ensure this runner leaves no implicit tx/GUC state behind before pool reuse.
        const qr = queryRunner as QueryRunnerWithTenantSymbols;
        const openedForBinding = qr[TENANT_RLS_OPENED_TX_FOR_BINDING] === true;
        try {
          if (openedForBinding && queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
        } catch {
          if (openedForBinding && queryRunner.isTransactionActive) {
            try {
              await queryRunner.rollbackTransaction();
            } catch {
              /* ignore */
            }
          }
        } finally {
          qr[TENANT_RLS_OPENED_TX_FOR_BINDING] = undefined;
        }
        await this.resetAppTenantIdForPool(queryRunner, originalQuery);
        return originalRelease();
      };

      return queryRunner;
    };

    (
      this.dataSource as DataSource & { [TENANT_BINDING_PATCHED]?: boolean }
    )[TENANT_BINDING_PATCHED] = true;
  }

  /**
   * Legacy hook from `connect()` — tenant GUC is applied from `query()` / `startTransaction()`
   * so `set_config(..., true)` runs only inside a real Postgres transaction.
   */
  async bindTenantId(queryRunner: QueryRunner): Promise<void> {
    const context = this.tryGetRequestContext();
    if (!context) {
      // No ALS context (typical in e2e seed/bootstrap or worker startup): skip implicit binding.
      // Runtime tenant security is still enforced for normal HTTP request flows that have context.
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
    // Called from query interception only; guarantees tx-local set_config semantics.
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

    // TypeORM may mark a transaction active before the first SQL hits Postgres; trusting
    // only txid_current_if_assigned() would autostart a binding-only tx that release() rolls back.
    const inPostgresTx =
      queryRunner.isTransactionActive || inTxRows[0]?.in_tx === true;
    if (!inPostgresTx) {
      // Autostart a tx so set_config(..., true) remains LOCAL to this unit of work.
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

  /**
   * Defensive recovery for pooled connections that may still be in aborted tx state.
   * Without this, every subsequent query on that connection returns
   * "current transaction is aborted" until an explicit rollback is issued.
   */
  private async readPostgresTxStateWithRecovery(
    queryRunner: QueryRunner,
    originalQuery: QueryRunner["query"]
  ): Promise<Array<{ in_tx: boolean }>> {
    try {
      return (await (originalQuery as (...a: unknown[]) => Promise<unknown>).call(
        queryRunner,
        "SELECT (txid_current_if_assigned() IS NOT NULL) AS in_tx",
        []
      )) as Array<{ in_tx: boolean }>;
    } catch (error) {
      if (!this.isCurrentTransactionAbortedError(error)) {
        throw error;
      }
      await this.recoverAbortedTransaction(queryRunner, originalQuery);
      return (await (originalQuery as (...a: unknown[]) => Promise<unknown>).call(
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
        // Fallback below handles cases where TypeORM state and PG state diverge.
      }
    }
    try {
      await (originalQuery as (...a: unknown[]) => Promise<unknown>).call(
        queryRunner,
        "ROLLBACK",
        []
      );
    } catch {
      // Ignore: there may be no active tx on this connection.
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
    await (originalQuery as (...a: unknown[]) => Promise<unknown>).call(
      queryRunner,
      "SELECT set_config('app.tenant_id', $1, true)",
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

  /**
   * Clears session GUC before returning the physical connection to the pool.
   * Invoked from the patched `QueryRunner.release()` in this service only.
   */
  private async resetAppTenantIdForPool(
    queryRunner: QueryRunner,
    originalQuery: QueryRunner["query"]
  ): Promise<void> {
    if (queryRunner.isReleased) {
      return;
    }
    try {
      await (originalQuery as (...a: unknown[]) => Promise<unknown>).call(
        queryRunner,
        "RESET app.tenant_id",
        []
      );
    } catch (error: unknown) {
      this.loggerService.warn("tenant session binding reset failed", {
        error: error instanceof Error ? error.message : String(error)
      });
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
      const allowed = selectsTenants && subdomainLookup && softDeleteGuard && !hasMutationKeyword;
      return allowed;
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

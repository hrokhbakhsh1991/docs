import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { Repository } from "typeorm";
import { ConfigService } from "../../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";
import {
  getTenantScopeKey,
  isTenantRuntimeApiPath,
  isTenantRuntimeLoginRoute,
  resolveTenantRuntimePath
} from "../tenant/tenant-runtime-policy";
import { TenantUsageDailyEntity } from "./entities/tenant-usage-daily.entity";

type QuotaScope = "api_requests_per_day" | "jobs_per_day";

@Injectable()
export class TenantUsageMeteringService {
  private usageUpdatesTotal = 0;
  private quotaExceededTotal = 0;
  private readonly quotaExceededByScope = new Map<QuotaScope, number>();

  constructor(
    @InjectRepository(TenantUsageDailyEntity)
    private readonly usageRepo: Repository<TenantUsageDailyEntity>,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  private utcDateString(now = new Date()): string {
    return now.toISOString().slice(0, 10);
  }

  private resolveTenantId(req: Request): string | undefined {
    return this.requestContextService.resolveTenantContext(req).tenantId;
  }

  private bumpQuotaExceeded(scope: QuotaScope): void {
    this.quotaExceededTotal += 1;
    this.quotaExceededByScope.set(scope, (this.quotaExceededByScope.get(scope) ?? 0) + 1);
  }

  private async upsertUsage(params: {
    tenantId: string;
    apiRequestsDelta?: number;
    loginAttemptsDelta?: number;
    backgroundJobsDelta?: number;
  }): Promise<void> {
    const date = this.utcDateString();
    const apiDelta = params.apiRequestsDelta ?? 0;
    const loginDelta = params.loginAttemptsDelta ?? 0;
    const jobsDelta = params.backgroundJobsDelta ?? 0;
    await this.usageRepo.query(
      `INSERT INTO tenant_usage_daily
         (tenant_id, date, api_requests, background_jobs, storage_bytes, login_attempts)
       VALUES ($1::uuid, $2::date, $3::bigint, $4::bigint, 0, $5::bigint)
       ON CONFLICT (tenant_id, date)
       DO UPDATE SET
         api_requests = tenant_usage_daily.api_requests + EXCLUDED.api_requests,
         background_jobs = tenant_usage_daily.background_jobs + EXCLUDED.background_jobs,
         login_attempts = tenant_usage_daily.login_attempts + EXCLUDED.login_attempts`,
      [params.tenantId, date, apiDelta, jobsDelta, loginDelta]
    );
    this.usageUpdatesTotal += 1;
  }

  private throwQuotaExceeded(scope: QuotaScope, tenantId: string, req?: Request): never {
    const ip = req
      ? (getTenantScopeKey("ip", req, {
          requestContextService: this.requestContextService,
          configService: this.configService
        }) ?? "")
      : "";
    this.bumpQuotaExceeded(scope);
    this.loggerService.warn("tenant_usage_quota_exceeded", {
      tenant_id: tenantId,
      scope,
      client_ip: ip
    });
    throw new HttpException(
      {
        error: {
          code: "TENANT_QUOTA_EXCEEDED",
          message: "Tenant usage quota exceeded",
          retryability: "RETRY_WITH_BACKOFF",
          details: { quota_scope: scope }
        }
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  async enforceHttpUsageMetering(req: Request): Promise<void> {
    const path = resolveTenantRuntimePath(req);
    if (!isTenantRuntimeApiPath(path)) {
      return;
    }
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) {
      return;
    }

    const isLogin = isTenantRuntimeLoginRoute(path, req.method);
    await this.upsertUsage({
      tenantId,
      apiRequestsDelta: 1,
      loginAttemptsDelta: isLogin ? 1 : 0
    });

    const [quotaRow] = await this.usageRepo.query(
      `SELECT u.api_requests, l.api_requests_per_day
         FROM tenant_usage_daily u
         LEFT JOIN tenant_plan_limits l ON l.tenant_id = u.tenant_id
        WHERE u.tenant_id = $1::uuid
          AND u.date = $2::date`,
      [tenantId, this.utcDateString()]
    );
    const limit = quotaRow?.api_requests_per_day;
    if (limit !== null && limit !== undefined) {
      const used = Number(quotaRow?.api_requests ?? 0);
      if (used > Number(limit)) {
        this.throwQuotaExceeded("api_requests_per_day", tenantId, req);
      }
    }
  }

  async enforceAndRecordHttpRequest(req: Request): Promise<void> {
    await this.enforceHttpUsageMetering(req);
  }

  /** Returns false when tenant daily background job quota is exhausted. */
  async tryConsumeBackgroundJob(tenantId: string): Promise<boolean> {
    const tid = tenantId.trim().toLowerCase();
    await this.upsertUsage({ tenantId: tid, backgroundJobsDelta: 1 });
    const [quotaRow] = await this.usageRepo.query(
      `SELECT u.background_jobs, l.jobs_per_day
         FROM tenant_usage_daily u
         LEFT JOIN tenant_plan_limits l ON l.tenant_id = u.tenant_id
        WHERE u.tenant_id = $1::uuid
          AND u.date = $2::date`,
      [tid, this.utcDateString()]
    );
    const limit = quotaRow?.jobs_per_day;
    if (limit !== null && limit !== undefined) {
      const used = Number(quotaRow?.background_jobs ?? 0);
      if (used > Number(limit)) {
        this.bumpQuotaExceeded("jobs_per_day");
        this.loggerService.warn("tenant_usage_quota_exceeded_job", {
          tenant_id: tid,
          scope: "jobs_per_day"
        });
        return false;
      }
    }
    return true;
  }

  getPrometheusText(): string {
    const lines: string[] = [
      "# HELP tenant_usage_updates_total Successful tenant usage daily upserts.",
      "# TYPE tenant_usage_updates_total counter",
      `tenant_usage_updates_total ${this.usageUpdatesTotal}`,
      "# HELP tenant_quota_exceeded_total Quota enforcement denials.",
      "# TYPE tenant_quota_exceeded_total counter",
      `tenant_quota_exceeded_total ${this.quotaExceededTotal}`
    ];
    for (const [scope, count] of this.quotaExceededByScope.entries()) {
      lines.push(`tenant_quota_exceeded_total{scope="${scope}"} ${count}`);
    }
    return `${lines.join("\n")}\n`;
  }

  getSnapshot(): {
    tenant_usage_updates_total: number;
    tenant_quota_exceeded_total: number;
    tenant_quota_exceeded_by_scope: Record<string, number>;
  } {
    return {
      tenant_usage_updates_total: this.usageUpdatesTotal,
      tenant_quota_exceeded_total: this.quotaExceededTotal,
      tenant_quota_exceeded_by_scope: Object.fromEntries(this.quotaExceededByScope)
    };
  }
}


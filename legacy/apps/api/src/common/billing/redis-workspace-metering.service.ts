import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type Redis from "ioredis";
import { Repository } from "typeorm";
import { resolveWorkspacePlanTierLimits } from "@repo/shared";
import { REDIS_CLIENT } from "../../infra/redis/redis.constants";
import { TenantPlanLimitsEntity } from "./entities/tenant-plan-limits.entity";
import {
  WORKSPACE_METERING_PORT,
  type WorkspaceMeteringPort,
  type WorkspacePlanLimits,
  type WorkspaceUsageSnapshot,
} from "./workspace-metering.port";

const LIMITS_KEY_PREFIX = "tenant:plan:limits:";
const USAGE_KEY_PREFIX = "tenant:plan:usage:";
const LIMITS_TTL_SECONDS = 300;
const USAGE_TTL_SECONDS = 60;

function limitsKey(tenantId: string): string {
  return `${LIMITS_KEY_PREFIX}${tenantId.trim()}`;
}

function usageKey(tenantId: string): string {
  return `${USAGE_KEY_PREFIX}${tenantId.trim()}`;
}

@Injectable()
export class RedisWorkspaceMeteringService implements WorkspaceMeteringPort {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(TenantPlanLimitsEntity)
    private readonly planLimitsRepo: Repository<TenantPlanLimitsEntity>,
  ) {}

  async getCachedPlanLimits(tenantId: string): Promise<WorkspacePlanLimits> {
    const key = limitsKey(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as WorkspacePlanLimits;
    }
    const row = await this.planLimitsRepo.findOne({ where: { tenantId } });
    const limits = resolveWorkspacePlanTierLimits({
      planTier: row?.planTier ?? null,
      maxActiveTours: row?.maxActiveTours ?? null,
      maxUsers: row?.maxUsers ?? null,
    });
    await this.redis.set(key, JSON.stringify(limits), "EX", LIMITS_TTL_SECONDS);
    return limits;
  }

  async getCachedUsageSnapshot(tenantId: string): Promise<WorkspaceUsageSnapshot> {
    const key = usageKey(tenantId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as WorkspaceUsageSnapshot;
    }
    const snapshot = await this.loadUsageFromDatabase(tenantId);
    await this.redis.set(key, JSON.stringify(snapshot), "EX", USAGE_TTL_SECONDS);
    return snapshot;
  }

  private async loadUsageFromDatabase(tenantId: string): Promise<WorkspaceUsageSnapshot> {
    const [tourRow] = (await this.planLimitsRepo.query(
      `
      SELECT COUNT(*)::int AS count
        FROM tours
       WHERE tenant_id = $1::uuid
         AND deleted_at IS NULL
         AND lifecycle_status IN ('DRAFT', 'OPEN')
      `,
      [tenantId],
    )) as Array<{ count: number }>;
    const [userRow] = (await this.planLimitsRepo.query(
      `
      SELECT COUNT(*)::int AS count
        FROM user_tenants
       WHERE tenant_id = $1::uuid
         AND deleted_at IS NULL
         AND membership_status = 'ACTIVE'
      `,
      [tenantId],
    )) as Array<{ count: number }>;
    return {
      activeTours: Number(tourRow?.count ?? 0),
      users: Number(userRow?.count ?? 0),
    };
  }
}

export const workspaceMeteringProvider = {
  provide: WORKSPACE_METERING_PORT,
  useExisting: RedisWorkspaceMeteringService,
};

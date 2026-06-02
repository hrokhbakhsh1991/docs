import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "tenant_plan_limits" })
export class TenantPlanLimitsEntity {
  @PrimaryColumn({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "bigint", name: "api_requests_per_day", nullable: true })
  apiRequestsPerDay!: string | null;

  @Column({ type: "bigint", name: "jobs_per_day", nullable: true })
  jobsPerDay!: string | null;

  @Column({ type: "bigint", name: "storage_limit", nullable: true })
  storageLimit!: string | null;

  @Column({ type: "text", name: "plan_tier", nullable: true })
  planTier!: string | null;

  @Column({ type: "bigint", name: "max_active_tours", nullable: true })
  maxActiveTours!: string | null;

  @Column({ type: "bigint", name: "max_users", nullable: true })
  maxUsers!: string | null;
}


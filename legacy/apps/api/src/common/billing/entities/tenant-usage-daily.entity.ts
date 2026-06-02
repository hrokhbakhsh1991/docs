import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "tenant_usage_daily" })
export class TenantUsageDailyEntity {
  @PrimaryColumn({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @PrimaryColumn({ type: "date", name: "date" })
  date!: string;

  @Column({ type: "bigint", name: "api_requests", default: () => "0" })
  apiRequests!: string;

  @Column({ type: "bigint", name: "background_jobs", default: () => "0" })
  backgroundJobs!: string;

  @Column({ type: "bigint", name: "storage_bytes", default: () => "0" })
  storageBytes!: string;

  @Column({ type: "bigint", name: "login_attempts", default: () => "0" })
  loginAttempts!: string;
}


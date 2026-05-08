import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { LoggerService } from "../common/logger/logger.service";
import { ConfigService } from "../config/config.service";

type RequiredColumn = {
  table: string;
  column: string;
};

const REQUIRED_COLUMNS: RequiredColumn[] = [
  { table: "users", column: "last_login_at" },
  { table: "users", column: "phone" },
  { table: "users", column: "is_phone_verified" },
  { table: "user_tenants", column: "membership_status" },
  { table: "user_tenants", column: "invited_at" },
  { table: "user_tenants", column: "joined_at" },
  { table: "user_tenants", column: "suspended_at" },
  { table: "user_tenants", column: "session_version" }
];

@Injectable()
export class RuntimeSchemaGuardService implements OnModuleInit {
  private missingColumns: string[] = [];
  private degraded = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(LoggerService) private readonly loggerService: LoggerService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  getMissingColumns(): string[] {
    return [...this.missingColumns];
  }

  isDegraded(): boolean {
    return this.degraded;
  }

  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.dataSource.query(
        `
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND (table_name, column_name) IN (
              ${REQUIRED_COLUMNS.map((_c, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(", ")}
            )
        `,
        REQUIRED_COLUMNS.flatMap((c) => [c.table, c.column])
      );
      const existing = new Set<string>(
        (rows as Array<{ table_name: string; column_name: string }>).map(
          (r) => `${r.table_name}.${r.column_name}`
        )
      );
      const missing = REQUIRED_COLUMNS.filter((c) => !existing.has(`${c.table}.${c.column}`)).map(
        (c) => `${c.table}.${c.column}`
      );
      this.missingColumns = missing;
      if (missing.length > 0) {
        const mode = this.configService.getSchemaGuardMode();
        this.degraded = mode === "degraded";
        this.loggerService.error("runtime_schema_guard_missing_columns", {
          missing_columns: missing,
          mode
        });
        if (mode === "fail_fast") {
          throw new Error(`runtime_schema_guard_fail_fast: ${missing.join(", ")}`);
        }
      } else {
        this.degraded = false;
        this.loggerService.info("runtime_schema_guard_ok", {
          checked_columns: REQUIRED_COLUMNS.length
        });
      }
    } catch (error: unknown) {
      this.loggerService.error("runtime_schema_guard_failed", {
        error_name: error instanceof Error ? error.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

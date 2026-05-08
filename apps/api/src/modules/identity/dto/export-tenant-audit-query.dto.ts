import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator";
import { TENANT_AUDIT_EXPORT_MAX_ROWS } from "../../../common/audit/tenant-audit-events.service";

export class ExportTenantAuditQueryDto {
  @ApiPropertyOptional({
    description: "Inclusive lower bound (ISO-8601)",
    example: "2026-01-01T00:00:00.000Z"
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: "Inclusive upper bound (ISO-8601)",
    example: "2026-12-31T23:59:59.999Z"
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: ["csv", "ndjson", "json"], default: "csv" })
  @IsOptional()
  @IsIn(["csv", "ndjson", "json"])
  format?: "csv" | "ndjson" | "json";

  @ApiPropertyOptional({
    description: `Hard cap ${TENANT_AUDIT_EXPORT_MAX_ROWS}`,
    maximum: TENANT_AUDIT_EXPORT_MAX_ROWS
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TENANT_AUDIT_EXPORT_MAX_ROWS)
  limit?: number;
}

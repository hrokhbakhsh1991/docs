import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator";
import {
  TENANT_AUDIT_CONFLICTS_MAX_LIMIT,
} from "../../../common/audit/tenant-audit-events.service";

export class ListDraftConflictsQueryDto {
  @ApiPropertyOptional({
    description: "Inclusive lower bound (ISO-8601)",
    example: "2026-01-01T00:00:00.000Z",
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: "Inclusive upper bound (ISO-8601)",
    example: "2026-12-31T23:59:59.999Z",
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description: "Maximum rows returned",
    maximum: TENANT_AUDIT_CONFLICTS_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TENANT_AUDIT_CONFLICTS_MAX_LIMIT)
  limit?: number;
}

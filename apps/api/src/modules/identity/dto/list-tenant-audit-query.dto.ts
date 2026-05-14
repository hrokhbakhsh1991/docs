import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { TENANT_AUDIT_LIST_MAX_LIMIT } from "../../../common/audit/tenant-audit.constants";

export class ListTenantAuditQueryDto {
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

  @ApiPropertyOptional({ description: "Page size (default 50)", maximum: TENANT_AUDIT_LIST_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TENANT_AUDIT_LIST_MAX_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    description: "Opaque cursor from the previous page (`nextCursor`)"
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({ description: "Exact `action` filter" })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  action?: string;

  @ApiPropertyOptional({ description: "Exact `resource_type` filter" })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  resourceType?: string;

  @ApiPropertyOptional({ description: "Exact `resource_id` filter" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  resourceId?: string;

  @ApiPropertyOptional({
    description: "Case-insensitive substring match on `actor` (wildcards not allowed)"
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  actorContains?: string;
}

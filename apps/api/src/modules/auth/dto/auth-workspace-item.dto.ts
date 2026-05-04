import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

/**
 * Response item for GET /api/v2/auth/workspaces (user_tenants + tenants projection).
 */
export class AuthWorkspaceItemDto {
  @ApiProperty({
    format: "uuid",
    description: "Tenant identifier from user_tenants.tenant_id",
    example: "11111111-1111-4111-8111-111111111111"
  })
  @IsUUID()
  tenant_id!: string;

  @ApiProperty({
    description: "Display name from tenants.name",
    example: "Mountain Collective"
  })
  @IsString()
  @IsNotEmpty()
  tenant_name!: string;

  @ApiProperty({
    description: "Tenant-scoped role from user_tenants.role",
    example: "leader"
  })
  @IsString()
  @IsNotEmpty()
  role!: string;
}

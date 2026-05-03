import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";

const ALLOWED_ROLES = ["owner", "admin", "member"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export class UpdateUserRoleDto {
  @ApiProperty({
    example: "member",
    enum: ALLOWED_ROLES,
    description: "Tenant-scoped role in user_tenants.role"
  })
  @IsString()
  @IsIn(ALLOWED_ROLES)
  role!: AllowedRole;
}

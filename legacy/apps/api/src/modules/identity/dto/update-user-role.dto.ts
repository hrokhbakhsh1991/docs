import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";
import { GENERAL_PATCH_ASSIGNABLE_ROLES } from "../../../common/rbac/workspace-membership-rbac.policy";

const ALLOWED_ROLES = GENERAL_PATCH_ASSIGNABLE_ROLES;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export class UpdateUserRoleDto {
  @ApiProperty({
    example: "member",
    enum: [...ALLOWED_ROLES],
    description:
      "New tenant-scoped role for the target user. The `owner` role cannot be assigned here; " +
      "successful updates bump `user_tenants.session_version`, invalidating prior JWTs for that membership (`sess_ver`)."
  })
  @IsString()
  @IsIn([...ALLOWED_ROLES])
  role!: AllowedRole;
}

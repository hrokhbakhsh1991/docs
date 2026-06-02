import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";
import { GENERAL_PATCH_ASSIGNABLE_ROLES } from "../../../common/rbac/workspace-membership-rbac.policy";

const OWNER_PATCH_ASSIGNABLE_ROLES = GENERAL_PATCH_ASSIGNABLE_ROLES;
type OwnerPatchAssignableRole = (typeof OWNER_PATCH_ASSIGNABLE_ROLES)[number];

export class PatchWorkspaceUserRoleDto {
  @ApiProperty({
    example: "member",
    enum: [...OWNER_PATCH_ASSIGNABLE_ROLES],
    description:
      "New tenant-scoped role. Owner-only route; bumps `session_version` so stale JWTs fail membership checks."
  })
  @IsString()
  @IsIn([...OWNER_PATCH_ASSIGNABLE_ROLES])
  role!: OwnerPatchAssignableRole;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsString } from "class-validator";

import { INVITE_ASSIGNABLE_ROLES } from "../../../common/rbac/workspace-membership-rbac.policy";

const ALLOWED_WORKSPACE_ROLES = [...INVITE_ASSIGNABLE_ROLES] as const;
type AllowedWorkspaceRole = (typeof ALLOWED_WORKSPACE_ROLES)[number];

export class CreateWorkspaceInviteDto {
  @ApiProperty({
    example: "invitee@example.com",
    description: "Email address to invite into the tenant workspace"
  })
  @IsEmail()
  @IsString()
  email!: string;

  @ApiProperty({
    example: "member",
    enum: ALLOWED_WORKSPACE_ROLES,
    description: "Tenant-scoped role to assign on invite acceptance"
  })
  @IsString()
  @IsIn(ALLOWED_WORKSPACE_ROLES)
  role!: AllowedWorkspaceRole;
}

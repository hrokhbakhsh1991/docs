import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { INVITE_ASSIGNABLE_ROLES } from "../../../common/rbac/workspace-membership-rbac.policy";

const ALLOWED_WORKSPACE_ROLES = [...INVITE_ASSIGNABLE_ROLES] as const;
type AllowedWorkspaceRole = (typeof ALLOWED_WORKSPACE_ROLES)[number];

export class InviteUserDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsIn(ALLOWED_WORKSPACE_ROLES)
  role!: AllowedWorkspaceRole;
}


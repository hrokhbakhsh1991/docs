import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { PERSISTED_WORKSPACE_MEMBERSHIP_ROLES } from "../../../common/rbac/workspace-membership-rbac.policy";
import { MembershipStatus } from "../membership-status.enum";

const USER_LIST_ROLE_FILTERS = PERSISTED_WORKSPACE_MEMBERSHIP_ROLES;
type UserListRoleFilter = (typeof USER_LIST_ROLE_FILTERS)[number];
const USER_LIST_STATUS_FILTERS = Object.values(MembershipStatus) as MembershipStatus[];

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    description: "Page size for cursor pagination",
    minimum: 1,
    maximum: 100,
    default: 50
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Opaque cursor from previous response `nextCursor`"
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: "Case-insensitive search across full name and email"
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: [...USER_LIST_ROLE_FILTERS],
    description: "Filter by tenant-scoped role"
  })
  @IsOptional()
  @IsString()
  @IsIn([...USER_LIST_ROLE_FILTERS])
  role?: UserListRoleFilter;

  @ApiPropertyOptional({
    enum: USER_LIST_STATUS_FILTERS,
    description: "Filter by membership lifecycle status"
  })
  @IsOptional()
  @IsString()
  @IsIn(USER_LIST_STATUS_FILTERS)
  status?: MembershipStatus;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description: "Include users with last login at or after this timestamp (inclusive)."
  })
  @IsOptional()
  @IsDateString()
  lastLoginFrom?: string;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description: "Include users with last login at or before this timestamp (inclusive)."
  })
  @IsOptional()
  @IsDateString()
  lastLoginTo?: string;
}

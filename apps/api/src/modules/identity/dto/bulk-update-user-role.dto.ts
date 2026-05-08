import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsIn, IsString } from "class-validator";
import { IsUUID } from "class-validator";
import { GENERAL_PATCH_ASSIGNABLE_ROLES } from "../../../common/rbac/workspace-membership-rbac.policy";

const ALLOWED_ROLES = GENERAL_PATCH_ASSIGNABLE_ROLES;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export class BulkUpdateUserRoleDto {
  @ApiProperty({
    type: [String],
    example: ["7f9a71aa-5fae-4da5-99dd-ef0bd19f1e1c", "4b8a8b8d-1ad5-4ce4-9c0c-3ec529ff5ab6"],
    description: "Tenant-scoped target user IDs for bulk role update."
  })
  @IsArray()
  @ArrayNotEmpty()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === "string" ? item.trim() : item))
          .filter((item) => typeof item === "string" && item.length > 0)
      : value
  )
  @IsString({ each: true })
  @IsUUID("4", { each: true })
  userIds!: string[];

  @ApiProperty({
    example: "member",
    enum: [...ALLOWED_ROLES],
    description:
      "New tenant-scoped role for all target users. The `owner` role cannot be assigned here; " +
      "only changed memberships bump `session_version`."
  })
  @IsString()
  @IsIn([...ALLOWED_ROLES])
  role!: AllowedRole;
}

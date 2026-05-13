import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../common/auth/user-role.enum";
import { MembershipStatus } from "../membership-status.enum";

export class UserResponseDto {
  @ApiProperty({ example: "11111111-1111-4111-8111-111111111111" })
  id!: string;

  @ApiProperty({ example: "Ava Chen" })
  name!: string;

  @ApiProperty({ example: "ava.chen@example.com" })
  email!: string;

  @ApiPropertyOptional({ nullable: true, example: "+989121236598" })
  phone?: string | null;

  @ApiPropertyOptional({ example: true, description: "Phone verification flag for OTP-capable accounts." })
  isPhoneVerified?: boolean;

  @ApiProperty({ example: UserRole.Owner, enum: UserRole, description: "Tenant-scoped role from user_tenants.role" })
  role!: UserRole;

  @ApiPropertyOptional({
    example: 1,
    description: "Optimistic concurrency token from `users.profile_row_version` (for ETag / If-Match)."
  })
  profileRowVersion?: number;
  status!: MembershipStatus;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
    description: "Last successful login timestamp when available."
  })
  lastLoginAt?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
    description: "Timestamp when membership joined/activated."
  })
  joinedAt?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
    description: "Timestamp when invite was issued for membership."
  })
  invitedAt?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
    description: "Timestamp when membership was suspended."
  })
  suspendedAt?: Date | null;

  @ApiPropertyOptional({
    type: [String],
    description: "Tenant-scoped membership labels from `user_tenants.labels` (e.g. club_member)."
  })
  labels?: string[];

  @ApiPropertyOptional({
    example: false,
    description: "True when the user account has a linked Telegram id (for in-app indicators)."
  })
  telegramLinked?: boolean;
}

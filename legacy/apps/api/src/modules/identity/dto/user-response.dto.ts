import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../common/auth/user-role.enum";
import { MembershipStatus } from "../membership-status.enum";
import { PROFILE_GENDER_VALUES } from "../constants/profile-gender";

export class UserResponseDto {
  @ApiProperty({ example: "11111111-1111-4111-8111-111111111111" })
  id!: string;

  @ApiProperty({ example: "Ava Chen" })
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: "ava.chen@example.com" })
  email!: string | null;

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
    nullable: true,
    enum: PROFILE_GENDER_VALUES,
    description: "Self-reported gender for avatar fallbacks when no profile image is set."
  })
  gender?: (typeof PROFILE_GENDER_VALUES)[number] | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Profile image URL when set on the user record."
  })
  profileImageUrl?: string | null;

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
    description: "Last authenticated request timestamp (async middleware touch)."
  })
  lastActiveAt?: Date | null;

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
    example: 10,
    minimum: 0,
    maximum: 100,
    description: "Permanent discount percent from `membership_metadata.permanentDiscountPercentage`."
  })
  permanentDiscountPercentage?: number;

  @ApiPropertyOptional({
    type: [String],
    description: "Reward badge tags from `membership_metadata.badges` (e.g. VIP_MEMBER)."
  })
  rewardBadges?: string[];

  @ApiPropertyOptional({
    example: false,
    description: "True when the user account has a linked Telegram id (for in-app indicators)."
  })
  telegramLinked?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      "True when `capability.is_selectable_leader` is stored on membership metadata (tour leader picker eligibility)."
  })
  isSelectableLeader?: boolean;

  @ApiPropertyOptional({
    example: "1250000",
    description: "Live member wallet balance in minor units from `account_balances` (`member:{userId}`)."
  })
  walletBalanceMinor?: string;

  @ApiPropertyOptional({
    example: "IRR",
    description: "Currency code for `walletBalanceMinor`."
  })
  walletCurrency?: string;

  @ApiPropertyOptional({
    example: 12,
    description: "All registrations matched via synthetic booking phone / Telegram."
  })
  totalTrips?: number;

  @ApiPropertyOptional({
    example: 8,
    description: "Past departures with non-terminal cancellation status."
  })
  completedTrips?: number;

  @ApiPropertyOptional({
    example: 2,
    description: "Registrations cancelled or rejected."
  })
  cancelledTrips?: number;
}

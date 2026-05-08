import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MembershipStatus } from "../membership-status.enum";
import { WorkspaceInviteStatus } from "../entities/workspace-invite.entity";

export class InviteUserResultDto {
  @ApiProperty({ format: "uuid" })
  inviteId!: string;

  @ApiProperty({ format: "uuid" })
  tenantId!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  inviteToken!: string;

  @ApiProperty({ enum: WorkspaceInviteStatus })
  status!: WorkspaceInviteStatus;

  @ApiProperty({ format: "date-time" })
  expiresAt!: string;

  @ApiPropertyOptional({ enum: MembershipStatus, nullable: true })
  membershipStatus!: MembershipStatus | null;
}

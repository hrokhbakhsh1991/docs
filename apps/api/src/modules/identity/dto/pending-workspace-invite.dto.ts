import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WorkspaceInviteStatus } from "../entities/workspace-invite.entity";

export class PendingWorkspaceInviteDto {
  @ApiProperty()
  inviteId!: string;

  @ApiProperty({ description: "Normalized phone stored in `workspace_invites.email` for phone invites." })
  phone!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ enum: WorkspaceInviteStatus })
  status!: WorkspaceInviteStatus;

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: string;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  invitedAt!: string | null;

  @ApiPropertyOptional({
    description: "Tenant user id when an INVITED membership already exists for this phone."
  })
  userId!: string | null;
}

export class ListPendingWorkspaceInvitesResponseDto {
  @ApiProperty({ type: [PendingWorkspaceInviteDto] })
  data!: PendingWorkspaceInviteDto[];
}

import { ApiProperty } from "@nestjs/swagger";

export class CancelWorkspaceInviteResponseDto {
  @ApiProperty()
  inviteId!: string;

  @ApiProperty({ example: "EXPIRED" })
  status!: string;
}

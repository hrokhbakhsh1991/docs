import { ApiProperty } from "@nestjs/swagger";

export class UserRoleHistoryItemDto {
  @ApiProperty({ example: "2bc6f9f4-7568-4a65-99c6-236f2d7dcbd5" })
  actorUserId!: string;

  @ApiProperty({ example: "owner@workspace.test" })
  actorEmail!: string;

  @ApiProperty({ example: "member" })
  oldRole!: string;

  @ApiProperty({ example: "admin" })
  newRole!: string;

  @ApiProperty({ example: "2026-05-05T07:32:00.000Z" })
  createdAt!: string;
}

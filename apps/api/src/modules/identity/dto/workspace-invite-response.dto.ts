import { ApiProperty } from "@nestjs/swagger";

export class WorkspaceInviteResponseDto {
  @ApiProperty({
    format: "uuid",
    example: "11111111-1111-4111-8111-111111111111"
  })
  id!: string;

  @ApiProperty({
    format: "uuid",
    example: "22222222-2222-4222-8222-222222222222"
  })
  tenant_id!: string;

  @ApiProperty({
    example: "invitee@example.com"
  })
  email!: string;

  @ApiProperty({
    example: "member"
  })
  role!: string;

  @ApiProperty({
    example: "https://app.example.com/auth/invite?token=inv_abc123"
  })
  invite_link!: string;

  @ApiProperty({
    example: "2026-06-01T12:00:00.000Z"
  })
  expires_at!: string;
}

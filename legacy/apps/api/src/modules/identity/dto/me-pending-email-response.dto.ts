import { ApiProperty } from "@nestjs/swagger";

export class MePendingEmailVerificationResponseDto {
  @ApiProperty({ enum: ["pending_email_verification"] })
  status!: "pending_email_verification";

  @ApiProperty({
    description: "`users.profile_row_version` after persisting ancillary profile fields tied to verification start."
  })
  profile_row_version!: number;
}

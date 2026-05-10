import { ApiProperty } from "@nestjs/swagger";

export class MeChangeMobileChallengeResponseDto {
  @ApiProperty({
    description: "Opaque challenge identifier for OTP verification",
    format: "uuid"
  })
  challenge_id!: string;
}

export class MeMobileChangedResponseDto {
  @ApiProperty({ enum: ["mobile_changed"] })
  status!: "mobile_changed";

  @ApiProperty({ description: "New verified mobile number (normalized)", example: "+989121234567" })
  mobile!: string;
}

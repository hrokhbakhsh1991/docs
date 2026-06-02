import { ApiProperty } from "@nestjs/swagger";

export class MeEmailVerifiedResponseDto {
  @ApiProperty({ enum: ["email_verified"] })
  status!: "email_verified";

  @ApiProperty({ format: "email" })
  email!: string;
}

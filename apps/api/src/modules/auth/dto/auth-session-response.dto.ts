import { ApiProperty } from "@nestjs/swagger";

export class WebSessionResponseDto {
  @ApiProperty()
  session_token!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty()
  tenant_id!: string;

  @ApiProperty({ enum: ["web"] })
  entry_mode!: "web";

  @ApiProperty({
    required: false,
    description:
      "When true, OTP verification succeeded but account completion is required before issuing a session"
  })
  requires_registration?: boolean;

  @ApiProperty({
    required: false,
    description: "Short-lived onboarding token used by registration completion endpoint"
  })
  onboarding_token?: string;
}

export class TelegramSessionResponseDto {
  @ApiProperty()
  session_token!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty()
  tenant_id!: string;

  @ApiProperty({ enum: ["telegram"] })
  entry_mode!: "telegram";
}

export class LinkTelegramResponseDto {
  @ApiProperty()
  user_id!: string;

  @ApiProperty()
  linked_telegram_user_id!: string;

  @ApiProperty({ enum: ["Linked"] })
  link_status!: "Linked";

  @ApiProperty()
  linked_at!: string;
}

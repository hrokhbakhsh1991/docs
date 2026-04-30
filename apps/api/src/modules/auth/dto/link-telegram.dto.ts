import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LinkTelegramDto {
  @ApiProperty({
    example:
      "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456789%7D&auth_date=1714000000&hash=abcdef"
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  telegram_init_payload!: string;

  @ApiPropertyOptional({
    example: "User requested account linking from profile settings"
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  link_reason?: string;
}

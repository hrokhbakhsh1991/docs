import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class TelegramSessionDto {
  @ApiProperty({
    example: "telegram",
    enum: ["telegram"]
  })
  @IsIn(["telegram"])
  entry_mode!: "telegram";

  @ApiProperty({
    example:
      "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456789%7D&auth_date=1714000000&hash=abcdef",
    description: "Telegram init data payload from Telegram WebApp"
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  telegram_init_payload!: string;

  @ApiPropertyOptional({
    example: "11111111-1111-4111-8111-111111111111"
  })
  @IsOptional()
  @IsUUID()
  asserted_tenant_id?: string;
}

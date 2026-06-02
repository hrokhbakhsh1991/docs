import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

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
}

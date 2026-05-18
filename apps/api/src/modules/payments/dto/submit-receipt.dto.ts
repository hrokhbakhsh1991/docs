import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class SubmitReceiptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  note?: string;
}

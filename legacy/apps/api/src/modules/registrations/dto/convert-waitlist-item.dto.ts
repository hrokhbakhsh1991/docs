import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class ConvertWaitlistItemDto {
  @ApiPropertyOptional({
    description: "Optional conversion reason",
    example: "capacity_available"
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversionReason?: string;
}

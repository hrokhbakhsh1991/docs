import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelWaitlistItemDto {
  @ApiPropertyOptional({
    description: "Optional cancellation reason",
    example: "participant_requested"
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  cancelReason?: string;
}

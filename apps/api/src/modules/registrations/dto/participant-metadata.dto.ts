import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/** Traveler-reported peak history for Peak-Experience auto-approval (Phase 16.9). */
export class ParticipantMetadataDto {
  @ApiPropertyOptional({
    description:
      "Count of successful peak climbs with this agency (0 = none, 4 = four or more). Used with tour tripDetails.requirements.minRequiredPeaks.",
    minimum: 0,
    maximum: 4,
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  userPastPeaksCount?: number;
}

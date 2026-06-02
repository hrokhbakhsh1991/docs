import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

/** Private-car intake persisted under `participant_metadata.transportIntake`. */
export class RegistrationTransportIntakeMetadataDto {
  @ApiPropertyOptional({ description: "Whether the registrant drives their own vehicle." })
  @IsOptional()
  @IsBoolean()
  isDriver?: boolean;

  @ApiPropertyOptional({ description: "Vehicle plate when isDriver is true.", maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  plateNumber?: string;

  @ApiPropertyOptional({
    description: "Passenger willingness to share fuel cost (دنگ); optional.",
  })
  @IsOptional()
  @IsBoolean()
  shareFuelCost?: boolean;
}

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

  @ApiPropertyOptional({
    description: "Private-car registration details when transportMode is self_vehicle.",
    type: RegistrationTransportIntakeMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RegistrationTransportIntakeMetadataDto)
  transportIntake?: RegistrationTransportIntakeMetadataDto;
}

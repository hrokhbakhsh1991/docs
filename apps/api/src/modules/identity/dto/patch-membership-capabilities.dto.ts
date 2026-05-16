import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";

export class PatchMembershipCapabilitiesDto {
  @ApiProperty({
    type: [String],
    description: "Explicit workspace capability grants stored on membership metadata.",
    example: ["tour.regional.manage", "tour.update.tripDetails"],
  })
  @IsArray()
  @IsString({ each: true })
  capabilities!: string[];

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    description: "Required when granting tour.regional.manage — limits tour list/detail/PATCH scope.",
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  allowedRegionIds?: string[];
}

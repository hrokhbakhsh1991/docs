import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

/** Root-level `CreateTourDto.itinerary` / `UpdateTourDto.itinerary` row (legacy flat day list). */
export class TourItineraryItemDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  day!: number;

  @ApiPropertyOptional({ example: "Base camp approach", maxLength: 500 })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: "Drive and acclimatization hike.",
    maxLength: 10_000,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 8, minimum: 0, maximum: 50_000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50_000)
  distanceKm?: number;

  @ApiPropertyOptional({ example: 450, minimum: -10_000, maximum: 30_000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-10_000)
  @Max(30_000)
  elevationGainM?: number;
}

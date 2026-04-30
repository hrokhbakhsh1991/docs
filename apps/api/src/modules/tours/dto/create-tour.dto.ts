import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from "class-validator";
import { TourLifecycleStatus } from "../entities/tour.entity";

export class CreateTourDto {
  @ApiProperty({
    example: "Spring Camp 2026"
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 30,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  total_capacity!: number;

  @ApiProperty({
    example: "Draft",
    description: "Accepted values: Draft or Open"
  })
  @Transform(({ value }) => {
    if (value === "Draft") {
      return TourLifecycleStatus.DRAFT;
    }
    if (value === "Open") {
      return TourLifecycleStatus.OPEN;
    }
    return value;
  })
  @IsIn([TourLifecycleStatus.DRAFT, TourLifecycleStatus.OPEN])
  lifecycle_status!: TourLifecycleStatus.DRAFT | TourLifecycleStatus.OPEN;

  @ApiPropertyOptional({
    example: "A two-day nature tour for members."
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "https://t.me/joinchat/example"
  })
  @IsOptional()
  @IsString()
  chat_link?: string;

  @ApiPropertyOptional({
    example: {
      currency: "USD",
      totalCost: 1200
    }
  })
  @IsOptional()
  @IsObject()
  cost_context?: Record<string, unknown>;
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";
import { TourLifecycleStatus } from "../entities/tour.entity";

export class UpdateTourDto {
  @ApiPropertyOptional({
    example: "Spring Camp 2026 - Updated"
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 40,
    minimum: 0
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  total_capacity?: number;

  @ApiPropertyOptional({
    example: "OPEN",
    enum: ["DRAFT", "OPEN", "CLOSED", "CANCELLED"]
  })
  @IsOptional()
  @IsIn([
    TourLifecycleStatus.DRAFT,
    TourLifecycleStatus.OPEN,
    TourLifecycleStatus.CLOSED,
    TourLifecycleStatus.CANCELLED
  ])
  lifecycle_status?:
    | TourLifecycleStatus.DRAFT
    | TourLifecycleStatus.OPEN
    | TourLifecycleStatus.CLOSED
    | TourLifecycleStatus.CANCELLED;

  @ApiPropertyOptional({
    example: "Updated description"
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "https://t.me/joinchat/updated"
  })
  @IsOptional()
  @IsString()
  chat_link?: string;

  @ApiPropertyOptional({
    example: { currency: "USD", discount: 10 }
  })
  @IsOptional()
  @IsObject()
  cost_context?: Record<string, unknown>;
}

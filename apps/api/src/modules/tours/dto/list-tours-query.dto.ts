import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/** Matches web tour list URL `status` (excluding `all`, which omits the param). */
export const LIST_TOURS_STATUS_VALUES = ["active", "completed", "archived"] as const;
export type ListToursStatusFilter = (typeof LIST_TOURS_STATUS_VALUES)[number];

export class ListToursQueryDto {
  @ApiPropertyOptional({
    description: "Case-insensitive match against tour title and description",
    maxLength: 200
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ description: "1-based page index", default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return 1;
    const n = Number(value);
    return Number.isFinite(n) ? n : 1;
  })
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: "Page size", default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return 10;
    const n = Number(value);
    return Number.isFinite(n) ? n : 10;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @ApiPropertyOptional({
    enum: LIST_TOURS_STATUS_VALUES,
    description:
      "Lifecycle bucket: active → DRAFT, completed → OPEN, archived → CLOSED or CANCELLED"
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    return typeof value === "string" ? value.trim() : value;
  })
  @IsIn([...LIST_TOURS_STATUS_VALUES], {
    message: "status must be one of: active, completed, archived"
  })
  status?: ListToursStatusFilter;
}

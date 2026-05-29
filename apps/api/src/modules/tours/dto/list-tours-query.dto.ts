import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from "class-validator";
import { TOUR_TYPES } from "@repo/types";
import type {
  SortDir,
  TourCategory,
  TourDifficulty,
  TourFilter,
  TourListStatus,
  TourSort,
  TourSortField,
} from "@repo/shared-contracts";

const TOUR_SORT_FIELD_VALUES = ["created_at", "title", "price", "difficulty", "category"] as const;
const SORT_DIR_VALUES = ["asc", "desc"] as const;
const TOUR_DIFFICULTY_VALUES = ["easy", "moderate", "hard", "technical"] as const;
const TOUR_CATEGORY_VALUES = [...TOUR_TYPES] as const;
const TOUR_LIST_STATUS_VALUES = ["active", "completed", "archived"] as const;

/** Matches web tour list URL `status` (excluding `all`, which omits the param). */
export const LIST_TOURS_STATUS_VALUES = TOUR_LIST_STATUS_VALUES;
export type ListToursStatusFilter = TourListStatus;

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

  @ApiPropertyOptional({
    enum: TOUR_SORT_FIELD_VALUES,
    description: "Sort field (created_at, title, price, difficulty, category)",
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsIn([...TOUR_SORT_FIELD_VALUES], {
    message: "sort_by must be one of: created_at, title, price, difficulty, category",
  })
  sort_by?: TourSortField;

  @ApiPropertyOptional({
    enum: SORT_DIR_VALUES,
    description: "Sort direction",
    default: "desc",
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsIn([...SORT_DIR_VALUES], {
    message: "sort_dir must be one of: asc, desc",
  })
  sort_dir?: SortDir;

  @ApiPropertyOptional({
    description: "Comma-separated category filter",
    type: String,
    example: "mountain,nature",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    return value
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  })
  @IsIn([...TOUR_CATEGORY_VALUES], {
    each: true,
    message: `category must contain only: ${TOUR_CATEGORY_VALUES.join(", ")}`,
  })
  category?: TourCategory[];

  @ApiPropertyOptional({
    description: "Comma-separated difficulty filter",
    type: String,
    example: "hard,technical",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    return value
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  })
  @IsIn([...TOUR_DIFFICULTY_VALUES], {
    each: true,
    message: `difficulty must contain only: ${TOUR_DIFFICULTY_VALUES.join(", ")}`,
  })
  difficulty?: TourDifficulty[];

  @ApiPropertyOptional({
    description: "Keyset cursor: tour id from the last item of the previous page (use with cursor_created_at)"
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null && String(v).trim() !== "")
  @IsUUID()
  cursor_id?: string;

  @ApiPropertyOptional({
    description: "Keyset cursor: ISO-8601 created_at of that tour row (use with cursor_id)"
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null && String(v).trim() !== "")
  @IsDateString()
  cursor_created_at?: string;

  @ApiPropertyOptional({
    description:
      "When false, skips an extra COUNT query; `total` in the response is -1 (unknown). Default true.",
    default: true
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") {
      return true;
    }
    if (value === false || value === "false" || value === 0 || value === "0") {
      return false;
    }
    return true;
  })
  @IsBoolean()
  include_total?: boolean;

}

export function toTourSort(query: ListToursQueryDto): TourSort | undefined {
  if (!query.sort_by) {
    return undefined;
  }
  return {
    field: query.sort_by,
    dir: query.sort_dir ?? "desc",
  };
}

export function toTourFilter(query: ListToursQueryDto): TourFilter {
  const normalizeList = (input: unknown): string[] | undefined => {
    if (Array.isArray(input)) {
      const out = input
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean);
      return out.length > 0 ? out : undefined;
    }
    if (typeof input === "string" && input.trim() !== "") {
      const out = input
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      return out.length > 0 ? out : undefined;
    }
    return undefined;
  };

  const category = normalizeList((query as unknown as Record<string, unknown>).category) as
    | TourCategory[]
    | undefined;
  const difficulty = normalizeList((query as unknown as Record<string, unknown>).difficulty) as
    | TourDifficulty[]
    | undefined;

  return {
    status: query.status,
    search: query.search,
    ...(category?.length ? { category } : {}),
    ...(difficulty?.length ? { difficulty } : {}),
  };
}

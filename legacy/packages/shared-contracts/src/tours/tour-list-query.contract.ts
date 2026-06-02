import { TOUR_TYPES } from "@repo/types";

export const TOUR_SORT_FIELD_VALUES = [
  "created_at",
  "title",
  "price",
  "difficulty",
  "category",
] as const;
export type TourSortField = (typeof TOUR_SORT_FIELD_VALUES)[number];

export const SORT_DIR_VALUES = ["asc", "desc"] as const;
export type SortDir = (typeof SORT_DIR_VALUES)[number];

export type TourSort = {
  field: TourSortField;
  dir: SortDir;
};

export const TOUR_CATEGORY_VALUES = [...TOUR_TYPES] as const;
export type TourCategory = (typeof TOUR_CATEGORY_VALUES)[number];

export const TOUR_DIFFICULTY_VALUES = ["easy", "moderate", "hard", "technical"] as const;
export type TourDifficulty = (typeof TOUR_DIFFICULTY_VALUES)[number];

export const TOUR_LIST_STATUS_VALUES = ["active", "completed", "archived"] as const;
export type TourListStatus = (typeof TOUR_LIST_STATUS_VALUES)[number];

export const TOUR_SEASON_VALUES = ["spring", "summer", "autumn", "winter"] as const;
export type TourSeason = (typeof TOUR_SEASON_VALUES)[number];

export type TourFilter = {
  status?: TourListStatus;
  search?: string;
  category?: TourCategory[];
  difficulty?: TourDifficulty[];
  season?: TourSeason[];
  requiresTechnicalGear?: boolean;
  maxAltitudeM?: {
    min?: number;
    max?: number;
  };
};

export type TourListQueryContract = {
  page?: number;
  limit?: number;
  includeTotal?: boolean;
  cursorId?: string;
  cursorCreatedAt?: string;
  sort?: TourSort[];
  filter?: TourFilter;
};


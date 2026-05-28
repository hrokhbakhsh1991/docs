import { AUDIENCE_GROUP_VALUES, type AudienceGroup } from "@/features/tours/domain/audience-groups";
import {
  computeTourDurationDays,
} from "@/features/tours/domain/computeTourDurationDays";
import {
  DIFFICULTY_RATING_VALUES,
  formatDifficultyRating,
  type DifficultyRating,
} from "@/features/tours/domain/difficulty-rating";

export type AudienceGroupUi = AudienceGroup;
export { AUDIENCE_GROUP_VALUES };
export { DIFFICULTY_RATING_VALUES };
export type { DifficultyRating };

export function selectDerivedDurationDays(
  departureYmd: string | undefined,
  returnYmd: string | undefined,
): number | undefined {
  return computeTourDurationDays(departureYmd, returnYmd);
}

export function formatDifficultyRatingForUi(value: number): string {
  return formatDifficultyRating(value);
}

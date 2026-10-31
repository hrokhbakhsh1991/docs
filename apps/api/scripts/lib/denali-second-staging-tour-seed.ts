import { assertSecondStagingFixtureRowMatches } from "./denali-second-staging-data-plan";

type SeedableTour = Readonly<{ id: string; tenantId: string; canonical: unknown }>;

export async function seedRunScopedTourIfMissing<T extends SeedableTour>(
  tour: T,
  repository: Readonly<{
    getById: (id: string, tenantId: string) => Promise<T | null>;
    createOnly: (tour: T) => Promise<void>;
  }>
): Promise<void> {
  const existing = await repository.getById(tour.id, tour.tenantId);
  if (existing !== null) {
    assertSecondStagingFixtureRowMatches(
      { canonical: existing.canonical },
      { canonical: tour.canonical },
      ["canonical"],
      "DENALI_SECOND_STAGING_FIXTURE_TOUR_COLLISION"
    );
    return;
  }
  await repository.createOnly(tour);
}

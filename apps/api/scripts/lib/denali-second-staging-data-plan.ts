import { buildDenaliBookingScenarioTour } from "../../src/fixtures/operator-smoke-published-tour.fixture";
import { SECOND_STAGING_TENANT } from "./denali-second-staging-fixtures";
import { buildSecondStagingRunFixtureIds } from "./denali-second-staging-run-fixtures";

const FIXTURE_CREATED_AT = new Date("2026-10-29T00:00:00.000Z");
const FIXTURE_TOUR_REFERENCE_DATE = new Date("2030-01-01T00:00:00.000Z");

function stableJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item instanceof Date) return item.toISOString();
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, nested]) => [key, normalize(nested)])
      );
    }
    return item;
  };
  return JSON.stringify(normalize(value)) ?? "undefined";
}

export function assertSecondStagingFixtureRowMatches(
  current: Readonly<Record<string, unknown>> | null,
  expected: Readonly<Record<string, unknown>>,
  fields: readonly string[],
  conflictCode: string
): boolean {
  if (current === null) return false;
  if (fields.some((field) => stableJson(current[field]) !== stableJson(expected[field]))) {
    throw new Error(conflictCode);
  }
  return true;
}

export function isSecondStagingWizardTemplateReady(
  payload: unknown,
  minPublishedSteps: number
): boolean {
  return (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "published" in payload &&
    payload.published === true &&
    "steps" in payload &&
    Array.isArray(payload.steps) &&
    payload.steps.length >= minPublishedSteps
  );
}

export function buildSecondStagingDataPlan(input: {
  runId: string;
  identityUserIds: Readonly<{ owner: string; finance: string; member: string }>;
}) {
  const ids = buildSecondStagingRunFixtureIds({
    tenantId: SECOND_STAGING_TENANT.id,
    runId: input.runId,
    identityUserIds: input.identityUserIds,
  });
  const createdAt = FIXTURE_CREATED_AT.toISOString();
  const resourceName = `QA2 ${input.runId}`;
  const catalogs = {
    equipment: {
      id: ids.resources.equipment,
      tenantId: ids.tenantId,
      name: `${resourceName} Hiking Equipment`,
      category: "hiking",
      iconKey: null,
      themeIds: [ids.resources.theme],
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    },
    theme: {
      id: ids.resources.theme,
      tenantId: ids.tenantId,
      name: `${resourceName} Mountain Theme`,
      slug: `qa2-${ids.resources.theme.slice(0, 8)}`,
      formProfile: "mountain_multi",
      iconKey: null,
      isActive: true,
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    },
    region: {
      id: ids.resources.region,
      tenantId: ids.tenantId,
      name: `${resourceName} Region`,
      country: "IR",
      isActive: true,
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    },
    destination: {
      id: ids.resources.destination,
      tenantId: ids.tenantId,
      regionId: ids.resources.region,
      name: `${resourceName} Summit`,
      locationType: "peak",
      altitudeM: 3962,
      typicalTrailDistanceKm: 12,
      isActive: true,
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    },
    preset: {
      id: ids.resources.preset,
      tenantId: ids.tenantId,
      name: `${resourceName} Preset`,
      description: "Synthetic tenant-isolation fixture.",
      themeId: ids.resources.theme,
      isActive: true,
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    },
  } as const;

  const catalog = {
    destinationId: ids.resources.destination,
    themeId: ids.resources.theme,
    peakHeight: 3962,
  } as const;
  const tourInput = {
    tenantId: ids.tenantId,
    registrationApproval: "auto" as const,
    catalog,
    now: FIXTURE_TOUR_REFERENCE_DATE,
    createdAt,
  };
  const tours = {
    free: buildDenaliBookingScenarioTour({
      ...tourInput,
      id: ids.tours.free,
      title: `${resourceName} Free Tour`,
      paymentCollection: "free",
    }),
    paid: buildDenaliBookingScenarioTour({
      ...tourInput,
      id: ids.tours.paid,
      title: `${resourceName} Offline Receipt Tour`,
      paymentCollection: "offline",
    }),
  } as const;
  const departureAt = new Date(FIXTURE_TOUR_REFERENCE_DATE.getTime() + 14 * 24 * 60 * 60 * 1000);
  const registrations = {
    free: {
      id: ids.registrations.free,
      tenantId: ids.tenantId,
      tourId: tours.free.id,
      tourTitle: `${resourceName} Free Tour`,
      guestLabel: `${resourceName} Free Member Fixture`,
      guestEmail: null,
      guestPhone: null,
      partySize: 1,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt,
      submittedAt: FIXTURE_CREATED_AT,
      submittedByUserId: ids.identities.member,
      registrationIntake: {
        source: "denali-second-staging",
        runId: ids.runId,
        fixture: true,
        registrantTarget: "self",
      },
    },
    paid: {
      id: ids.registrations.paid,
      tenantId: ids.tenantId,
      tourId: tours.paid.id,
      tourTitle: `${resourceName} Offline Receipt Tour`,
      guestLabel: `${resourceName} Paid Member Fixture`,
      guestEmail: null,
      guestPhone: null,
      partySize: 1,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt,
      submittedAt: FIXTURE_CREATED_AT,
      submittedByUserId: ids.identities.member,
      registrationIntake: {
        source: "denali-second-staging",
        runId: ids.runId,
        fixture: true,
        registrantTarget: "self",
      },
    },
  } as const;

  return { ids, catalogs, tours, registrations } as const;
}

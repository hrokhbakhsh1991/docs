/**
 * Seeds four realistic Denali UI-test tours via the same BFF POST pipeline as the create wizard.
 * Browser: call `window.__seedDenaliUiTestTours()` from DevTools (localhost only).
 */

import { denaliTourKindToIsMultiDay, type DenaliTourKind } from "@repo/types";

import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { assertSubmitValidDenaliWizardForm } from "@/features/tours/testing/denaliSubmitTestHelpers";
import { mapDenaliWizardToCreateTourPayload } from "@/features/tours/wizard/domain/mapDenaliWizardToCreateTourPayload";
import {
  computeDenaliTourDayCountFromKind,
  syncDenaliItineraryRows,
} from "@/features/tours/wizard/denali/denaliItinerarySync";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliCore.schema";
import { mergeDenaliFormDefaults } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { buildCreateTourPostBody } from "@/lib/services/tours.service";

import {
  DENALI_UI_TEST_TOUR_FIXTURES,
  type DenaliUiTestTourCatalog,
  type DenaliUiTestTourFixture,
} from "./denaliUiTestTourFixtures";

export type SeedDenaliUiTestToursResult = {
  ok: boolean;
  created: Array<{ fixtureId: string; tourId: string; title: string }>;
  failed: Array<{ fixtureId: string; title: string; error: string }>;
};

type ThemeRow = { id: string; name: string; slug?: string; isActive?: boolean };
type DestinationRow = { id: string; name?: string; isActive?: boolean };

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include", cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function resolveDestinationId(): Promise<string> {
  const destinations = await fetchJson<DestinationRow[]>("/api/settings/destinations");
  const active = destinations.filter((row) => row.isActive !== false);
  const id = active[0]?.id;
  if (!id) {
    throw new Error("No active workspace destination — add one in Settings → Locations.");
  }
  return id;
}

async function resolveTheme(fixture: DenaliUiTestTourFixture): Promise<{ id: string; name: string }> {
  const themes = await fetchJson<ThemeRow[]>("/api/settings/tour-themes");
  const active = themes.filter((row) => row.isActive !== false && row.id && row.name);
  const slugs = [...fixture.themeSlugs, ...(fixture.themeSlugFallbacks ?? [])];
  for (const slug of slugs) {
    const hit = active.find((row) => row.slug === slug);
    if (hit) {
      return { id: hit.id, name: hit.name };
    }
  }
  const fallback = active[0];
  if (!fallback) {
    throw new Error("No active workspace tour theme — run provision:denali or add themes in Settings.");
  }
  return { id: fallback.id, name: fallback.name };
}

export async function fetchDenaliUiTestTourCatalog(
  fixture: DenaliUiTestTourFixture,
): Promise<DenaliUiTestTourCatalog> {
  const [destinationId, theme] = await Promise.all([resolveDestinationId(), resolveTheme(fixture)]);
  return { destinationId, themeId: theme.id, themeName: theme.name };
}

function applyMultiDayItinerary(
  form: DenaliCreateTourWizardForm,
  fixture: DenaliUiTestTourFixture,
): void {
  const dayCount = computeDenaliTourDayCountFromKind(
    form.basicInfo.tourType as DenaliTourKind,
    form.basicInfo.startDateTime,
    form.basicInfo.endDateTime,
  );
  const rows = syncDenaliItineraryRows(undefined, dayCount);
  form.programNature.itinerary = rows.map((row, index) => ({
    ...row,
    activities:
      fixture.itineraryDays?.[index]?.trim() ||
      `برنامه روز ${row.day} — ${fixture.title}`,
  }));
}

/** Builds a submit-valid Denali wizard form from a UI-test fixture + workspace catalog IDs. */
export function buildDenaliUiTestTourForm(
  fixture: DenaliUiTestTourFixture,
  catalog: DenaliUiTestTourCatalog,
): DenaliCreateTourWizardForm {
  const base = buildDenaliTourCreateDefaultValues();
  const isMulti = denaliTourKindToIsMultiDay(fixture.tourType);
  const isMountain = fixture.tourType.startsWith("mountain_");

  const patch: Partial<DenaliCreateTourWizardForm> = {
    basicInfo: {
      ...base.basicInfo,
      title: fixture.title,
      tourType: fixture.tourType,
      destinationId: catalog.destinationId,
      startDateTime: fixture.startDateTime,
      endDateTime: isMulti ? fixture.endDateTime : undefined,
      capacityMax: fixture.capacityMax,
      meetingPoint: fixture.meetingPoint,
      requiresLocalGuide: Boolean(fixture.localGuideName?.trim()),
      localGuideName: fixture.localGuideName,
      publishStatus: "draft",
    },
    programNature: {
      ...base.programNature,
      themeIds: [catalog.themeId],
      shortDescription: fixture.shortDescription,
      longDescription: fixture.longDescription,
      difficultyLevel: fixture.difficultyLevel,
      hikingHoursApprox: fixture.hikingHoursApprox,
      photos: [],
    },
    transport: {
      ...base.transport,
      transportMode: fixture.transportMode,
    },
    pricingPayment: {
      ...base.pricingPayment,
      requiresPayment: true,
      basePricePerPerson: fixture.basePricePerPerson,
      paymentMode: "offline_receipt",
      includesTourInsurance: fixture.includesTourInsurance === true,
    },
    participantRequirements: {
      ...base.participantRequirements,
      minimumAge: fixture.minimumAge,
      fitnessLevel: isMountain ? fixture.fitnessLevel : undefined,
      sportsInsuranceRequired: isMountain ? fixture.sportsInsuranceRequired : undefined,
      gearItems: [],
    },
    policies: {
      policiesText:
        "لغو تا ۴۸ ساعت قبل از حرکت: استرداد ۸۰٪. کمتر از ۴۸ ساعت: بدون استرداد. شرایط جوی نامساعد: تعویق یا استرداد.",
    },
    photosData: {
      photos: [],
    },
    tripDetails: {
      ...base.tripDetails,
      overview: {
        ...base.tripDetails.overview,
        customServiceLabels: fixture.customServiceLabels ? [...fixture.customServiceLabels] : [],
        ...(fixture.peakHeight != null ? { peakHeight: fixture.peakHeight } : {}),
      },
      metrics: {},
      logistics: {
        gatheringPoints: [],
      },
    },
  };

  const merged = mergeDenaliFormDefaults(base, patch);
  if (isMulti) {
    applyMultiDayItinerary(merged, fixture);
  }
  return assertSubmitValidDenaliWizardForm(merged);
}

async function createTourViaBff(
  form: DenaliCreateTourWizardForm,
  themeCatalog: readonly { id: string; name: string }[],
  idempotencyKey: string,
): Promise<{ id: string; title: string }> {
  const clientDto = mapDenaliWizardToCreateTourPayload(form);
  const prepared = mapCreateTourDto(clientDto, { themeCatalog });
  const wire = buildCreateTourPostBody(prepared);

  const res = await fetch("/api/tours", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(wire),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST /api/tours → ${res.status}: ${text.slice(0, 500)}`);
  }

  const body = text ? (JSON.parse(text) as { id?: string; title?: string }) : {};
  if (!body.id) {
    throw new Error("POST /api/tours succeeded but response had no tour id");
  }
  return { id: body.id, title: body.title ?? form.basicInfo.title };
}

/** Creates all four UI-test tours sequentially via BFF (session cookie auth). */
export async function seedDenaliUiTestTours(): Promise<SeedDenaliUiTestToursResult> {
  const created: SeedDenaliUiTestToursResult["created"] = [];
  const failed: SeedDenaliUiTestToursResult["failed"] = [];
  const runId = Date.now();

  for (const fixture of DENALI_UI_TEST_TOUR_FIXTURES) {
    try {
      const catalog = await fetchDenaliUiTestTourCatalog(fixture);
      const form = buildDenaliUiTestTourForm(fixture, catalog);
      const tour = await createTourViaBff(form, [{ id: catalog.themeId, name: catalog.themeName }], `ui-test-seed-${fixture.id}-${runId}`);
      created.push({ fixtureId: fixture.id, tourId: tour.id, title: tour.title });
    } catch (error: unknown) {
      failed.push({
        fixtureId: fixture.id,
        title: fixture.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: failed.length === 0, created, failed };
}

export function isDenaliUiTestSeedHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return host === "localhost" || host.endsWith(".localhost");
}

/** Registers `window.__seedDenaliUiTestTours` on localhost for DevTools use. */
export function registerDenaliUiTestTourSeedBridge(): void {
  if (!isDenaliUiTestSeedHost()) {
    return;
  }
  type SeedWindow = Window & {
    __seedDenaliUiTestTours?: () => Promise<SeedDenaliUiTestToursResult>;
  };
  (window as SeedWindow).__seedDenaliUiTestTours = seedDenaliUiTestTours;
}

import {
  denaliCanonicalBasicsFromTourKind,
  denaliTourKindToIsMultiDay,
  isDenaliEventTourKind,
  type DenaliTourKind,
} from "@repo/types";
import { expect, type Locator, type Page } from "@playwright/test";

import { buildCreateTourPostBody } from "../../../../../lib/services/tours.service";
import {
  assertSubmitValidDenaliWizardForm,
  buildDenaliTourCreateDefaultValues,
  mapCreateTourDto,
  mapDenaliWizardToCreateTourPayload,
  mergeDenaliFormDefaults,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/testing/public-test-api";

const DEFAULT_OTP = "1234";

async function setNativeSelectValue(locator: Locator, value: string): Promise<void> {
  await locator.evaluate(
    (select: HTMLSelectElement, v: string) => {
      select.value = v;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
}

async function selectMainTourThemeInWizard(
  page: Page,
  theme: { id: string; name: string; formProfile: string },
): Promise<void> {
  const selector = 'select[name="overview.mainTourThemeId"]';
  await expect(page.locator(selector)).toBeVisible({ timeout: 20_000 });
  
  // Wait for the specific option to be present in the DOM.
  await expect(page.locator(`${selector} option[value="${theme.id}"]`)).toHaveCount(1, {
    timeout: 30_000,
  });

  // Use toPass to retry selection if detachment occurs during React re-render.
  await expect(async () => {
    await page.selectOption(selector, theme.id);
  }).toPass({ timeout: 45_000 });

  // Wait for the UI to reflect the profile change.
  await expect(page.getByTestId("wizard-form-profile")).toHaveAttribute("data-form-profile", theme.formProfile, {
    timeout: 45_000,
  });
}

export const REAL_TENANT_PROJECTS = [
  { slug: "denali", phone: "+989121000001" },
  { slug: "urban-demo", phone: "+989121000002" },
  { slug: "mix-demo", phone: "+989121000003" },
] as const;

export function ownerPhoneFromProject(metadata: Record<string, unknown>): string {
  const phone = metadata.ownerPhone;
  if (typeof phone !== "string" || !phone.trim()) {
    throw new Error("Playwright project metadata.ownerPhone is required");
  }
  return phone.trim();
}

export function tenantSlugFromProject(metadata: Record<string, unknown>): string {
  const slug = metadata.tenantSlug;
  if (typeof slug !== "string" || !slug.trim()) {
    throw new Error("Playwright project metadata.tenantSlug is required");
  }
  return slug.trim();
}

/** Phone + OTP login against real BFF (API path avoids fa digit input timing flakes). */
export async function loginWithPhoneOtp(
  page: Page,
  phone: string,
  otp: string = DEFAULT_OTP,
): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/workspace-not-found/);

  const origin = new URL(page.url()).origin;

  const otpRequest = await page.request.post(`${origin}/api/auth/request-otp`, {
    data: { phone },
  });
  expect(otpRequest.ok(), `request-otp failed: ${otpRequest.status()}`).toBeTruthy();
  const otpBody = (await otpRequest.json()) as { challenge_id?: string };
  const challengeId =
    typeof otpBody.challenge_id === "string" ? otpBody.challenge_id.trim() : "";

  const session = await page.request.post(`${origin}/api/auth/login-web-session`, {
    data: {
      phone,
      otp,
      ...(challengeId ? { challenge_id: challengeId } : {}),
    },
  });
  expect(session.ok(), `login-web-session failed: ${session.status()}`).toBeTruthy();

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/(dashboard|tours)/, { timeout: 45_000 });
  await expect
    .poll(
      async () => {
        const session = await page.request.get(`${origin}/api/auth/session`);
        if (!session.ok()) return "";
        const body = (await session.json()) as { user?: { role?: string } };
        return body.user?.role ?? "";
      },
      { timeout: 15_000 },
    )
    .toMatch(/owner|admin/i);
}

export async function expectTourWizardShell(page: Page): Promise<void> {
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/workspace-not-found/);
  await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("tour-create-wizard")).toHaveAttribute(
    "data-tenant-advanced-trip-details",
    "1",
    { timeout: 45_000 },
  );
}

type LocationIds = { regionId: string; mainDestinationId: string };

async function readLocationIdsFromSettings(page: Page): Promise<LocationIds | null> {
  const regionsRes = await page.request.get("/api/settings/regions");
  if (!regionsRes.ok()) {
    return null;
  }
  const regionsBody = (await regionsRes.json()) as unknown;
  const regions = Array.isArray(regionsBody)
    ? regionsBody
    : ((regionsBody as { items?: unknown[] })?.items ?? []);
  const regionId = (regions[0] as { id?: string })?.id;
  if (!regionId) {
    return null;
  }

  const destRes = await page.request.get("/api/settings/destinations");
  if (!destRes.ok()) {
    return null;
  }
  const destBody = (await destRes.json()) as unknown;
  const destinations = (Array.isArray(destBody) ? destBody : []).filter(
    (d) => (d as { isActive?: boolean }).isActive !== false
  );
  const match = destinations.find(
    (d) =>
      (d as { regionId?: string }).regionId === regionId ||
      (d as { region_id?: string }).region_id === regionId,
  ) as { id?: string } | undefined;
  const mainDestinationId = match?.id ?? (destinations[0] as { id?: string })?.id;
  if (!mainDestinationId) {
    return null;
  }
  return { regionId, mainDestinationId };
}

async function seedMinimalWizardLocationViaApi(page: Page): Promise<void> {
  const suffix = `${Date.now()}`;
  const regionRes = await page.request.post("/api/settings/regions", {
    data: {
      name: `Integration QA Region ${suffix}`,
      country: "IR",
      sortOrder: 0,
      isActive: true,
    },
  });
  expect(regionRes.ok(), `create region failed: ${regionRes.status()}`).toBeTruthy();
  const region = (await regionRes.json()) as { id: string };

  const destRes = await page.request.post("/api/settings/destinations", {
    data: {
      name: `Integration QA Destination ${suffix}`,
      regionId: region.id,
      type: null,
      altitudeM: null,
      sortOrder: 1,
      isActive: true,
    },
  });
  expect(destRes.ok(), `create destination failed: ${destRes.status()}`).toBeTruthy();
}

/** Resolves region/destination IDs; seeds minimal catalog via API when provision omitted locations. */
export async function fetchWizardLocationIds(page: Page): Promise<LocationIds> {
  const existing = await readLocationIdsFromSettings(page);
  if (existing) {
    return existing;
  }
  await seedMinimalWizardLocationViaApi(page);
  const afterSeed = await readLocationIdsFromSettings(page);
  if (!afterSeed) {
    throw new Error("Wizard location catalog still empty after API seed");
  }
  return afterSeed;
}

export async function fetchFirstTourThemeId(page: Page): Promise<string | undefined> {
  const res = await page.request.get("/api/settings/tour-themes");
  if (!res.ok()) {
    return undefined;
  }
  const body = (await res.json()) as unknown;
  const themes = Array.isArray(body) ? body : [];
  return (themes[0] as { id?: string })?.id;
}

export async function fetchTourThemeIdForProfile(
  page: Page,
  formProfile: string,
): Promise<string | undefined> {
  const row = await fetchTourThemeForProfile(page, formProfile);
  return row?.id;
}

export async function fetchTourThemeForProfile(
  page: Page,
  formProfile: string,
): Promise<{ id: string; name: string; formProfile: string } | undefined> {
  const themes = await fetchTourThemes(page);
  const match = themes.find((t) => t.formProfile === formProfile);
  return match;
}

export async function fetchTourThemes(
  page: Page,
): Promise<Array<{ id: string; name: string; formProfile: string; slug: string }>> {
  const res = await page.request.get("/api/settings/tour-themes");
  if (!res.ok()) {
    return [];
  }
  const body = (await res.json()) as unknown;
  const themes = Array.isArray(body) ? body : [];
  return themes
    .map((t) => {
      const row = t as { id?: string; name?: string; formProfile?: string; slug?: string };
      if (!row.id || !row.name || !row.formProfile || !row.slug) {
        return null;
      }
      return { id: row.id, name: row.name, formProfile: row.formProfile, slug: row.slug };
    })
    .filter((t): t is { id: string; name: string; formProfile: string; slug: string } => t != null);
}

export async function fetchTourThemeBySlug(
  page: Page,
  slug: string,
): Promise<{ id: string; name: string; formProfile: string; slug: string } | undefined> {
  const row = (await fetchTourThemes(page)).find((t) => t.slug === slug);
  if (!row) {
    return undefined;
  }
  return { id: row.id, name: row.name, formProfile: row.formProfile, slug: row.slug };
}

/**
 * Resolve a workspace theme for Denali integration tests when preset slugs are missing.
 * Tries `preferredSlugs` first, then `formProfiles` (e.g. after partial provision).
 */
export async function resolveDenaliIntegrationTheme(
  page: Page,
  options: {
    preferredSlugs?: string[];
    formProfiles?: string[];
  },
): Promise<{ id: string; name: string; formProfile: string; slug: string } | undefined> {
  const themes = await fetchTourThemes(page);
  for (const slug of options.preferredSlugs ?? []) {
    const hit = themes.find((t) => t.slug === slug);
    if (hit) return hit;
  }
  for (const profile of options.formProfiles ?? []) {
    const hit = themes.find((t) => t.formProfile === profile);
    if (hit) return hit;
  }
  return undefined;
}

export type BuildDenaliSubmitFormOptions = {
  mainTourThemeId?: string;
  tourType?: DenaliTourKind;
  meetingPoint?: string;
  transportMode?: "organizer_vehicle" | "shared_cars" | "none";
  dongAmount?: number;
  peakHeight?: number;
  itinerary?: Array<{ day: number; activities: string }>;
  gearItems?: Array<{ id: string; isRequired: boolean }>;
  leaderUserIds?: string[];
  localGuideName?: string;
  gatheringPoint?: { addressText: string; latitude?: number | null; longitude?: number | null };
};

export function buildDenaliSubmitFormPatch(
  location: LocationIds,
  titleSuffix: string,
  options?: BuildDenaliSubmitFormOptions,
): Partial<DenaliCreateTourWizardForm> {
  const tourType = options?.tourType ?? "mountain_day";
  const isMulti = denaliTourKindToIsMultiDay(tourType);
  const isEvent = isDenaliEventTourKind(tourType);
  const isMountain = tourType.startsWith("mountain_");
  const themeId = options?.mainTourThemeId;
  const meetingPoint = options?.meetingPoint ?? "نقطه ملاقات integration";

  return {
    basicInfo: {
      ...buildDenaliTourCreateDefaultValues().basicInfo,
      title: `1234567890 تست integration ${titleSuffix}`,
      tourType,
      destinationId: location.mainDestinationId,
      startDateTime: "2026-08-10T08:00:00.000Z",
      endDateTime: isMulti ? "2026-08-12T18:00:00.000Z" : undefined,
      capacityMax: 12,
      meetingPoint,
      ...(options?.leaderUserIds != null && options.leaderUserIds.length > 0
        ? { leaderUserIds: options.leaderUserIds }
        : {}),
      ...(options?.localGuideName?.trim()
        ? { requiresLocalGuide: true, localGuideName: options.localGuideName.trim() }
        : {}),
      ...(options?.gatheringPoint
        ? {
            gatheringPoint: {
              addressText: options.gatheringPoint.addressText,
              latitude: options.gatheringPoint.latitude ?? null,
              longitude: options.gatheringPoint.longitude ?? null,
            },
          }
        : {}),
    },
    programNature: {
      shortDescription: "خلاصهٔ تست ارسال integration دنالی",
      longDescription:
        "توضیح کامل تست برای عبور از اعتبارسنجی ویزارد ۶ تب Denali روی استک واقعی.",
      difficultyLevel: isEvent ? undefined : 5,
      hikingHoursApprox: isEvent ? undefined : 4,
      ...(isMulti
        ? {
            itinerary: options?.itinerary ?? [
              { day: 1, activities: "روز اول integration" },
              { day: 2, activities: "روز دوم integration" },
              { day: 3, activities: "روز سوم integration" },
            ],
          }
        : {}),
      ...(themeId ? { themeIds: [themeId] } : { themeIds: [] }),
    },
    transport: {
      transportMode: options?.transportMode ?? "organizer_vehicle",
      ...(options?.transportMode === "shared_cars"
        ? { dongAmount: options?.dongAmount ?? 150_000 }
        : {}),
    },
    pricingPayment: {
      requiresPayment: true,
      basePricePerPerson: 100_000,
      paymentMode: "offline_receipt",
    },
    participantRequirements: {
      minimumAge: isEvent ? 16 : 18,
      fitnessLevel: isEvent ? "low" : "medium",
      sportsInsuranceRequired: tourType.startsWith("mountain_"),
      ...(options?.gearItems != null && options.gearItems.length > 0
        ? { gearItems: options.gearItems }
        : {}),
    },
    policies: {
      policiesText: "سیاست لغو تست integration.",
    },
    tripDetails: {
      overview: {
        customServiceLabels: [],
        ...(isMountain && !isEvent ? { peakHeight: options?.peakHeight ?? 4_200 } : {}),
      },
      metrics: {},
      logistics: { gatheringPoints: [] },
    },
  };
}

/** Opens Denali create wizard and applies a localhost-only integration form patch. */
export async function openDenaliCreateWizardWithFormPatch(
  page: Page,
  location: LocationIds,
  titleSuffix: string,
  options?: BuildDenaliSubmitFormOptions,
): Promise<void> {
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });
  const patch = buildDenaliSubmitFormPatch(location, titleSuffix, options);
  await page.evaluate((patchJson) => {
    const apply = (
      window as Window & {
        __integrationApplyDenaliWizardPatch?: (_patch: unknown) => void;
      }
    ).__integrationApplyDenaliWizardPatch;
    if (!apply) {
      throw new Error("integration wizard patch bridge unavailable (localhost only)");
    }
    apply(JSON.parse(patchJson));
  }, JSON.stringify(patch));
  await expect(page.getByLabel("نام تور")).toHaveValue(/تست integration/, { timeout: 20_000 });
}

/** Creates a Denali tour via BFF POST (keeps UI session intact for tours list E2E). */
export async function createDenaliTourViaApi(
  page: Page,
  location: LocationIds,
  titleSuffix: string,
  options?: BuildDenaliSubmitFormOptions,
): Promise<string> {
  const patch = buildDenaliSubmitFormPatch(location, titleSuffix, options);
  const form = assertSubmitValidDenaliWizardForm(
    mergeDenaliFormDefaults(buildDenaliTourCreateDefaultValues(), patch),
  );
  const mapped = mapCreateTourDto(
    mapDenaliWizardToCreateTourPayload(form),
    options?.mainTourThemeId
      ? { themeCatalog: [{ id: options.mainTourThemeId, name: "integration-theme" }] }
      : undefined,
  );
  const res = await page.request.post("/api/tours", {
    data: buildCreateTourPostBody(mapped),
    headers: { "Idempotency-Key": `pw-denali-tour-${Date.now()}-${titleSuffix}` },
  });
  const text = await res.text();
  expect(res.ok(), `POST /api/tours failed: ${res.status()} ${text.slice(0, 500)}`).toBeTruthy();
  let id: string | undefined;
  try {
    id = extractCreatedTourId(JSON.parse(text));
  } catch {
    id = undefined;
  }
  expect(id, "POST /api/tours must return tour id").toBeTruthy();
  return id!;
}

/**
 * Preset seeds enable private car + dong; PersianNumberInput may not sync preset values to RHF
 * when the transport step is only visited in passing. Uncheck private car (mountain E2E shape).
 */
export async function fillDenaliTransportStepGaps(page: Page): Promise<void> {
  const w = page.getByTestId("denali-create-tour-wizard");
  const privateCar = w.getByRole("checkbox", { name: /خودرو شخصی|ماشین شخصی/i });
  if (await privateCar.isVisible().catch(() => false) && (await privateCar.isChecked())) {
    await privateCar.uncheck();
  }
  const dongInput = w.getByTestId("denali-transport-dong-amount");
  if (await dongInput.isVisible().catch(() => false)) {
    await dongInput.fill("150000");
    await dongInput.blur();
  }
  const modeSelect = w.getByTestId("denali-transport-mode");
  if (await modeSelect.isVisible().catch(() => false)) {
    const value = await modeSelect.inputValue().catch(() => "");
    if (value === "shared_cars" && !(await dongInput.isVisible().catch(() => false))) {
      await setNativeSelectValue(modeSelect, "shared_cars");
    }
  }
}

/** Mountain tours require sports insurance; ensure checkbox state matches schema. */
export async function fillDenaliParticipantsStepGaps(page: Page, tourType?: string): Promise<void> {
  const w = page.getByTestId("denali-create-tour-wizard");
  const insurance = w.getByRole("checkbox", { name: /بیمه ورزشی/i });
  if (await insurance.isVisible().catch(() => false)) {
    const isMountain = tourType ? tourType.startsWith("mountain_") : true;
    if (isMountain) {
      await insurance.check();
    }
  }
}

/** Program step: altitude + per-day itinerary when visible (map.md phases 1–2). */
export async function fillDenaliProgramStepGaps(
  page: Page,
  options?: { tourType?: DenaliTourKind },
): Promise<void> {
  const w = page.getByTestId("denali-create-tour-wizard");
  const altitude = w.getByTestId("denali-program-altitude");
  if (await altitude.isVisible().catch(() => false)) {
    await altitude.fill("4200");
    await altitude.blur();
  }

  const itineraryRoot = w.getByTestId("denali-daily-itinerary");
  if (await itineraryRoot.isVisible().catch(() => false)) {
    const dayFields = w.locator('[data-testid^="denali-itinerary-day-"]');
    const count = await dayFields.count();
    for (let i = 0; i < count; i += 1) {
      const input = dayFields.nth(i).getByRole("textbox");
      if (!(await input.isVisible().catch(() => false))) {
        continue;
      }
      const current = await input.inputValue().catch(() => "");
      if (current.trim().length > 0) {
        continue;
      }
      await input.fill(`فعالیت روز ${i + 1} — integration QA`, { timeout: 10_000 });
    }
  }

  void options;
}

export async function fetchActiveEquipment(
  page: Page,
): Promise<Array<{ id: string; name: string; slug: string }>> {
  const res = await page.request.get("/api/settings/equipment");
  if (!res.ok()) {
    return [];
  }
  const body = (await res.json()) as unknown;
  const rows = Array.isArray(body) ? body : [];
  return rows
    .filter((row) => (row as { isActive?: boolean }).isActive !== false)
    .map((row) => {
      const r = row as { id?: string; name?: string; slug?: string };
      if (!r.id || !r.name) return null;
      return { id: r.id, name: r.name, slug: r.slug ?? r.id };
    })
    .filter((r): r is { id: string; name: string; slug: string } => r != null);
}

export async function ensureActiveEquipment(
  page: Page,
): Promise<{ id: string; name: string; slug: string }> {
  const existing = await fetchActiveEquipment(page);
  if (existing.length > 0) {
    return existing[0]!;
  }
  const suffix = Date.now();
  const res = await page.request.post("/api/settings/equipment", {
    data: {
      name: `Integration QA Gear ${suffix}`,
      slug: `integration-qa-gear-${suffix}`,
      description: "تجهیز تست integration",
      isActive: true,
    },
  });
  expect(res.ok(), `create equipment failed: ${res.status()}`).toBeTruthy();
  const row = (await res.json()) as { id: string; name: string; slug?: string };
  return { id: row.id, name: row.name, slug: row.slug ?? row.id };
}

/** Logistics step: select first gear item when list is shown (phase 3). */
export async function fillDenaliGearStepGaps(page: Page): Promise<void> {
  const w = page.getByTestId("denali-create-tour-wizard");
  const gearList = w.getByTestId("denali-gear-list");
  if (!(await gearList.isVisible().catch(() => false))) {
    return;
  }
  const firstRow = gearList.getByRole("checkbox").first();
  if (await firstRow.isVisible().catch(() => false)) {
    await firstRow.check();
  }
}

export async function fetchTourTripDetails(
  page: Page,
  tourId: string,
): Promise<Record<string, unknown> | null> {
  const res = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
  if (!res.ok()) {
    return null;
  }
  const body = (await res.json()) as Record<string, unknown>;
  const data = body.data ?? body;
  if (data == null || typeof data !== "object") {
    return null;
  }
  const row = data as {
    tripDetails?: Record<string, unknown>;
    details?: { tripDetails?: Record<string, unknown> } | null;
  };
  return row.tripDetails ?? row.details?.tripDetails ?? null;
}

export async function selectDenaliDestination(
  page: Page,
  destinationId: string,
): Promise<void> {
  const destRes = await page.request.get("/api/settings/destinations");
  expect(destRes.ok()).toBeTruthy();
  const destinations = (await destRes.json()) as Array<{ id: string; name: string }>;
  const dest = destinations.find((d) => d.id === destinationId);
  expect(dest, `destination ${destinationId}`).toBeTruthy();

  const w = page.getByTestId("denali-create-tour-wizard");
  const destInput = w.getByPlaceholder(/جستجوی مقصد/i);
  await destInput.click();
  await destInput.fill(dest!.name);
  const escaped = dest!.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await w.getByRole("option", { name: new RegExp(escaped) }).first().click();
}

export async function advanceDenaliWizardToReview(
  page: Page,
  options?: {
    mainTourTheme?: { id: string; name: string; formProfile: string };
    tourType?: DenaliTourKind;
    titlePattern?: RegExp;
    destinationId?: string;
  },
): Promise<void> {
  const w = page.getByTestId("denali-create-tour-wizard");
  await expect(w).toBeVisible({ timeout: 20_000 });

  const tourType = options?.tourType ?? "mountain_day";
  const basics = denaliCanonicalBasicsFromTourKind(tourType);
  if (basics != null) {
    await setNativeSelectValue(w.getByTestId("denali-basics-category"), basics.category);
    await setNativeSelectValue(w.getByTestId("denali-basics-duration"), basics.duration);
    if (basics.eventVariant != null) {
      await setNativeSelectValue(w.getByTestId("denali-basics-event-variant"), basics.eventVariant);
    }
  }
  const titlePattern = options?.titlePattern ?? /تست integration/;
  await expect(page.getByLabel("نام تور")).toHaveValue(titlePattern, { timeout: 20_000 });

  if (options?.destinationId) {
    await selectDenaliDestination(page, options.destinationId);
  } else if (basics != null) {
    const destRes = await page.request.get("/api/settings/destinations");
    if (destRes.ok()) {
      const destinations = (await destRes.json()) as Array<{ id: string }>;
      const first = destinations[0];
      if (first?.id) {
        await selectDenaliDestination(page, first.id);
      }
    }
  }

  await page.getByRole("button", { name: /Next|بعدی/ }).click();
  await expect(page.locator("form h2").first()).toContainText(/برنامه/, { timeout: 20_000 });

  if (options?.mainTourTheme) {
    const themeCheckbox = w.getByTestId(`denali-theme-select-${(options.mainTourTheme as any).slug}`);
    await expect(themeCheckbox).toBeVisible({ timeout: 30_000 });
    await themeCheckbox.check();
  }

  await fillDenaliProgramStepGaps(page, { tourType });

  const stepHeadings: Array<{ pattern: RegExp; fill?: () => Promise<void> }> = [
    {
      pattern: /لجستیک|خدمات/,
      fill: async () => {
        await fillDenaliTransportStepGaps(page);
        await fillDenaliGearStepGaps(page);
      },
    },
    {
      pattern: /هزینه/,
      fill: () => fillDenaliParticipantsStepGaps(page, tourType),
    },
    { pattern: /عکس/ },
    { pattern: /بازبینی/ },
  ];

  for (const step of stepHeadings) {
    await page.getByRole("button", { name: /Next|بعدی/ }).click();
    await expect(page.locator("form h2").first()).toContainText(step.pattern, { timeout: 20_000 });
    if (step.fill) {
      await step.fill();
    }
  }
}

export async function clickDenaliWizardFinalSubmit(page: Page): Promise<void> {
  const w = page.getByTestId("denali-create-tour-wizard");
  await expect(w).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("denali-step-review")).toBeVisible({ timeout: 20_000 });
  const btn = w.getByTestId("denali-wizard-final-submit");
  await expect(btn).toBeVisible({ timeout: 20_000 });
  await btn.click();
}

export async function advanceMountainWizardToReview(
  page: Page,
  options?: { mainTourTheme?: { id: string; name: string; formProfile: string } },
): Promise<void> {
  const w = page.getByTestId("tour-create-wizard");
  const tourTypeSelect = w.locator('select[name="overview.tourType"]');
  await setNativeSelectValue(tourTypeSelect, "mountain");
  await tourTypeSelect.dispatchEvent("change");
  await expect(page.getByLabel("عنوان تور")).toHaveValue(/تست integration/, { timeout: 20_000 });

  await page.getByRole("button", { name: /Next|بعدی/ }).click();
  await expect(page.locator("form h2").first()).toContainText(/تم/, { timeout: 20_000 });
  if (options?.mainTourTheme) {
    await selectMainTourThemeInWizard(page, options.mainTourTheme);
  }
  await expect(page.getByLabel("مراحل ایجاد تور")).toContainText("برنامه سفر", { timeout: 30_000 });

  const stepHeadings = [/قیمت|ظرفیت/, /مکان/, /برنامه/, /شرکت/, /لجستیک/, "قوانین", /بازبینی/];
  for (const heading of stepHeadings) {
    await page.getByRole("button", { name: /Next|بعدی/ }).click();
    await expect(page.locator("form h2").first()).toContainText(heading, { timeout: 20_000 });
  }
}

export async function clickWizardFinalSubmit(page: Page): Promise<void> {
  await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });
  const btn = page.getByRole("button", { name: "ثبت نهایی تور" });
  await expect(btn).toBeVisible({ timeout: 20_000 });
  await btn.evaluate((el) => (el as HTMLButtonElement).click());
}

function extractCreatedTourId(payload: unknown): string | undefined {
  if (payload == null || typeof payload !== "object") return undefined;
  const row = payload as Record<string, unknown>;
  if (typeof row.id === "string" && row.id.trim()) return row.id.trim();
  const data = row.data;
  if (data != null && typeof data === "object" && typeof (data as { id?: string }).id === "string") {
    return (data as { id: string }).id.trim();
  }
  return undefined;
}

/** Clicks final submit; asserts API 201 and tour list navigation. Returns created tour id when present. */
export async function submitWizardAndExpectTourList(page: Page): Promise<string | undefined> {
  const waitForCreate = () =>
    page.waitForResponse(
      (res) => {
        const path = new URL(res.url()).pathname;
        return (
          res.request().method() === "POST" &&
          (path === "/api/tours" || path === "/api/v2/tours") &&
          !path.includes("/register")
        );
      },
      { timeout: 90_000 },
    );

  const denaliWizard = page.getByTestId("denali-create-tour-wizard");
  const isDenali = await denaliWizard.isVisible().catch(() => false);
  const createResponse = await Promise.all([
    waitForCreate(),
    isDenali ? clickDenaliWizardFinalSubmit(page) : clickWizardFinalSubmit(page),
  ]).then(([res]) => res);

  const responseText = await createResponse.text();
  if (createResponse.status() !== 201 && isDenali) {
    const inlineAlert = page.locator('[data-testid="denali-create-tour-wizard"] [role="alert"]');
    const alertText = (await inlineAlert.textContent().catch(() => null))?.trim();
    expect(
      createResponse.status(),
      `POST tours expected 201, got ${createResponse.status()}: ${responseText.slice(0, 800)}${alertText ? ` | UI: ${alertText}` : ""}`,
    ).toBe(201);
  } else {
    expect(
      createResponse.status(),
      `POST tours expected 201, got ${createResponse.status()}: ${responseText.slice(0, 800)}`,
    ).toBe(201);
  }
  await expect(page).toHaveURL(/\/tours\/?(\?.*)?$/, { timeout: 45_000 });
  try {
    return extractCreatedTourId(JSON.parse(responseText));
  } catch {
    return undefined;
  }
}

export async function advanceUrbanWizardToReview(
  page: Page,
  options?: { mainTourTheme?: { id: string; name: string; formProfile: string } },
): Promise<void> {
  const w = page.getByTestId("tour-create-wizard");
  const tourTypeSelect = w.locator('select[name="overview.tourType"]');
  await setNativeSelectValue(tourTypeSelect, "city");
  await tourTypeSelect.dispatchEvent("change");
  await expect(page.getByLabel("عنوان تور")).toHaveValue(/تست integration/, { timeout: 20_000 });

  await page.getByRole("button", { name: /Next|بعدی/ }).click();
  await expect(page.locator("form h2").first()).toContainText(/تم/, { timeout: 20_000 });
  if (options?.mainTourTheme) {
    await selectMainTourThemeInWizard(page, options.mainTourTheme);
  }
  await page.getByRole("button", { name: /Next|بعدی/ }).click();
  await expect(page.locator("form h2").first()).toContainText(/مکان/, { timeout: 20_000 });
  await page.getByRole("button", { name: /Next|بعدی/ }).click();
  await expect(page.locator("form h2").first()).toContainText("قوانین", { timeout: 20_000 });
  await page.getByRole("button", { name: /Next|بعدی/ }).click();
  await expect(page.locator("form h2").first()).toContainText(/بازبینی/, { timeout: 20_000 });
}

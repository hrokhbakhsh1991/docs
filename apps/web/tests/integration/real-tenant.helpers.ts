import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";
import { expect, type Locator, type Page } from "@playwright/test";

import { wizardDraftStorageKey } from "../../src/features/tours/wizard/tourWizardDraftEnvelope";

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

/** Phone + OTP login against real BFF/API (fa locale labels). */
export async function loginWithPhoneOtp(
  page: Page,
  phone: string,
  otp: string = DEFAULT_OTP,
): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/workspace-not-found/);

  const phoneField = page.locator('input[name="phone"]');
  await expect(phoneField).toBeVisible({ timeout: 20_000 });
  await phoneField.fill(phone);

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("request-otp") && res.ok(), {
      timeout: 45_000,
    }),
    page.getByRole("button", { name: /ادامه|Continue/i }).click(),
  ]);

  const otpField = page.locator('input[name="otp"]');
  if (!(await otpField.isVisible())) {
    const backupOtpField = page.getByLabel(/رمز یک‌بارمصرف|^OTP$/i);
    await expect(backupOtpField).toBeVisible({ timeout: 20_000 });
    await backupOtpField.fill(otp);
  } else {
    await otpField.fill(otp);
  }
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/(dashboard|tours)/, { timeout: 45_000 });
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
  const destinations = Array.isArray(destBody) ? destBody : [];
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
  const res = await page.request.get("/api/settings/tour-themes");
  if (!res.ok()) {
    return undefined;
  }
  const body = (await res.json()) as unknown;
  const themes = Array.isArray(body) ? body : [];
  const match = themes.find(
    (t) => (t as { formProfile?: string }).formProfile === formProfile,
  ) as { id?: string; name?: string; formProfile?: string } | undefined;
  const id = match?.id;
  const name = match?.name;
  const profile = match?.formProfile;
  if (!id || !name || !profile) {
    return undefined;
  }
  return { id, name, formProfile: profile };
}

export function buildUrbanSubmitDraftJson(
  location: LocationIds,
  titleSuffix: string,
  options?: { mainTourThemeId?: string },
): string {
  return JSON.stringify({
    overview: {
      title: `1234567890 تست integration ${titleSuffix}`,
      shortDescription: "خلاصهٔ تست ارسال integration",
      longDescription:
        "توضیح کامل تست برای عبور از اعتبارسنجی گام اطلاعات پایه در مسیر شهری روی استک واقعی.",
      tourType: "city",
      ...(options?.mainTourThemeId ? { mainTourThemeId: options.mainTourThemeId } : {}),
    },
    _wizardMeta: {
      resolvedFormProfile: "urban_event",
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    },
    pricing: { basePrice: 100_000, currency: "TOMAN", discountNotes: "" },
    schedule: {
      startDate: "2026-08-10",
      endDate: "2026-08-11",
      departureMeetingTime: "",
      returnMeetingTime: "",
    },
    location: {
      regionId: location.regionId,
      mainDestinationId: location.mainDestinationId,
      secondaryDestinationIds: [],
      meetingPoint: "",
      returnPoint: "",
      displayLocation: "",
    },
    policies: {
      cancellationPolicy: "سیاست لغو تست integration.",
      refundPolicy: "سیاست استرداد تست integration.",
      safetyNotes: "یادداشت ایمنی تست integration.",
      attendanceRules: "",
      lateArrivalPolicy: "",
      noShowPolicy: "",
      confirmationPolicy: "",
      capacityPolicy: "",
      weatherPolicy: "",
      reservationRules: "",
      riskDisclaimer: "",
      safetyPolicy: "",
    },
  });
}

/** Clears server + tenant-scoped local draft so integration seed is not overwritten. */
export async function clearWizardDrafts(page: Page, tenantSlug: string): Promise<void> {
  const del = await page.request.delete("/api/settings/tour-wizard-draft");
  expect(del.ok(), `clear server wizard draft failed: ${del.status()}`).toBeTruthy();
  const key = wizardDraftStorageKey(tenantSlug);
  await page.evaluate((storageKey) => {
    localStorage.removeItem(storageKey);
  }, key);
}

export async function seedWizardDraft(
  page: Page,
  tenantSlug: string,
  draftJson: string,
): Promise<void> {
  const key = wizardDraftStorageKey(tenantSlug);
  await page.evaluate(
    ({ storageKey, json }) => {
      localStorage.setItem(storageKey, json);
    },
    { storageKey: key, json: draftJson },
  );
}

export function buildMountainSubmitDraftJson(
  location: LocationIds,
  titleSuffix: string,
  options?: { mainTourThemeId?: string },
): string {
  return JSON.stringify({
    overview: {
      title: `1234567890 تست integration ${titleSuffix}`,
      shortDescription: "خلاصهٔ تست ارسال integration",
      longDescription:
        "توضیح کامل تست برای عبور از اعتبارسنجی گام اطلاعات پایه در مسیر کوهنوردی روی استک واقعی.",
      tourType: "mountain",
      ...(options?.mainTourThemeId ? { mainTourThemeId: options.mainTourThemeId } : {}),
    },
    _wizardMeta: {
      resolvedFormProfile: "mountain_outdoor",
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      savedAt: new Date().toISOString(),
      ...(options?.mainTourThemeId
        ? { themeIds: { main: options.mainTourThemeId } }
        : {}),
    },
    pricing: { basePrice: 100_000, currency: "TOMAN", discountNotes: "" },
    schedule: {
      startDate: "2026-08-10",
      endDate: "2026-08-11",
      departureMeetingTime: "",
      returnMeetingTime: "",
    },
    location: {
      regionId: location.regionId,
      mainDestinationId: location.mainDestinationId,
      secondaryDestinationIds: [],
      meetingPoint: "نقطه ملاقات integration",
      returnPoint: "",
      displayLocation: "",
    },
    itinerary: {
      days: [
        {
          dayNumber: 1,
          title: "روز ۱",
          description: "برنامه روز اول integration",
          segments: [
            {
              title: "صعود",
              description: "بخش اصلی",
              activityType: "",
              startTime: "",
              endTime: "",
            },
          ],
        },
      ],
    },
    participation: {
      minimumAge: 18,
      requiredExperienceLevel: "intermediate",
      requiredFitnessLevel: "moderate",
    },
    logistics: {
      primaryTransportMode: "bus",
      groupSizeMax: 12,
    },
    policies: {
      cancellationPolicy: "سیاست لغو تست integration.",
      refundPolicy: "سیاست استرداد تست integration.",
      safetyNotes: "یادداشت ایمنی تست integration.",
      attendanceRules: "",
      lateArrivalPolicy: "",
      noShowPolicy: "",
      confirmationPolicy: "",
      capacityPolicy: "",
      weatherPolicy: "",
      reservationRules: "",
      riskDisclaimer: "",
      safetyPolicy: "",
    },
  });
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

  await page.getByRole("button", { name: "بعدی" }).click();
  await expect(page.locator("form h2").first()).toContainText(/تم/, { timeout: 20_000 });
  if (options?.mainTourTheme) {
    await selectMainTourThemeInWizard(page, options.mainTourTheme);
  }
  await expect(page.getByLabel("مراحل ایجاد تور")).toContainText("برنامه سفر", { timeout: 30_000 });

  const stepHeadings = [/قیمت|ظرفیت/, /مکان/, /برنامه/, /شرکت/, /لجستیک/, "قوانین", /بازبینی/];
  for (const heading of stepHeadings) {
    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText(heading, { timeout: 20_000 });
  }
}

export async function clickWizardFinalSubmit(page: Page): Promise<void> {
  await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });
  const btn = page.getByRole("button", { name: "ثبت نهایی تور" });
  await expect(btn).toBeVisible({ timeout: 20_000 });
  await btn.evaluate((el) => (el as HTMLButtonElement).click());
}

/** Clicks final submit; asserts API 201 and tour list navigation. */
export async function submitWizardAndExpectTourList(page: Page): Promise<void> {
  const createResponsePromise = page.waitForResponse(
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
  await clickWizardFinalSubmit(page);
  const createResponse = await createResponsePromise;
  const responseText = await createResponse.text();
  expect(
    createResponse.status(),
    `POST tours expected 201, got ${createResponse.status()}: ${responseText.slice(0, 800)}`,
  ).toBe(201);
  await expect(page).toHaveURL(/\/tours\/?(\?.*)?$/, { timeout: 45_000 });
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

  await page.getByRole("button", { name: "بعدی" }).click();
  await expect(page.locator("form h2").first()).toContainText(/تم/, { timeout: 20_000 });
  if (options?.mainTourTheme) {
    await selectMainTourThemeInWizard(page, options.mainTourTheme);
  }
  await page.getByRole("button", { name: "بعدی" }).click();
  await expect(page.locator("form h2").first()).toContainText(/مکان/, { timeout: 20_000 });
  await page.getByRole("button", { name: "بعدی" }).click();
  await expect(page.locator("form h2").first()).toContainText("قوانین", { timeout: 20_000 });
  await page.getByRole("button", { name: "بعدی" }).click();
  await expect(page.locator("form h2").first()).toContainText(/بازبینی/, { timeout: 20_000 });
}

import { expect, test } from "@playwright/test";

import {
  advanceDenaliWizardToReview,
  createDenaliTourViaApi,
  fetchTourThemeForProfile,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  ownerPhoneFromProject,
  submitWizardAndExpectTourList,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

test.describe("real-stack denali clone tour", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test.beforeEach(async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    if (slug !== "denali") {
      test.skip(true, "denali project only");
    }
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
  });

  test("?clone= → denali wizard pre-filled → submit", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `clone-query-${Date.now()}`;
    const theme = await fetchTourThemeForProfile(page, "denali_pilot");
    expect(theme).toBeTruthy();
    const location = await fetchWizardLocationIds(page);

    const leaderId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const sourceTourId = await createDenaliTourViaApi(page, location!, `${slug}-source-${runId}`, {
      mainTourThemeId: theme!.id,
      leaderUserIds: [leaderId],
      localGuideName: "Integration local guide",
      gatheringPoint: {
        addressText: "نقطه تجمع clone integration",
        latitude: 35.6892,
        longitude: 51.389,
      },
    });
    const sourceTourRes = await page.request.get(`/api/tours/${sourceTourId}`);
    expect(sourceTourRes.ok()).toBeTruthy();
    const sourcePayload = (await sourceTourRes.json()) as {
      details?: { tripDetails?: { overview?: Record<string, unknown> } };
    };
    const overview = sourcePayload.details?.tripDetails?.overview ?? {};
    expect(Array.isArray(overview.leaderUserIds)).toBeTruthy();
    expect((overview.leaderUserIds as string[]).length).toBeGreaterThan(0);
    expect(overview.localGuideName).toBe("Integration local guide");


    await page.goto(`/tours/new?clone=${encodeURIComponent(sourceTourId)}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(/در حال بارگذاری تور برای کپی/)).toBeHidden({ timeout: 45_000 });
    await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });

    const sourceTour = (await sourceTourRes.json()) as { title?: string };
    expect(sourceTour.title ?? "", "created tour must expose title for clone").toMatch(/1234567890/);

    const titleInput = page.locator('input[name="basicInfo.title"]');
    await expect(titleInput).toHaveValue(new RegExp(sourceTour.title!.slice(0, 10)), {
      timeout: 15_000,
    });
    await titleInput.fill(`1234567890 clone ${runId}`);

    await advanceDenaliWizardToReview(page, {
      mainTourTheme: theme!,
      tourType: "mountain_day",
      titlePattern: /1234567890 clone/,
      destinationId: location!.mainDestinationId,
    });
    await submitWizardAndExpectTourList(page);
  });

  test("tours list Duplicate navigates to ?clone=", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `clone-list-${Date.now()}`;
    const theme = await fetchTourThemeForProfile(page, "denali_pilot");
    expect(theme).toBeTruthy();
    const location = await fetchWizardLocationIds(page);
    expect(location?.mainDestinationId).toBeTruthy();

    const sourceTourId = await createDenaliTourViaApi(page, location!, `${slug}-${runId}`, {
      mainTourThemeId: theme!.id,
    });

    await page.goto(`/tours?search=${encodeURIComponent("1234567890")}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("searchbox", { name: /Search tours/i })).toBeVisible({
      timeout: 45_000,
    });
    const duplicateBtn = page.getByTestId(`tour-duplicate-${sourceTourId}`);
    await expect(duplicateBtn).toBeVisible({ timeout: 90_000 });
    await duplicateBtn.click();
    await expect(page).toHaveURL(new RegExp(`clone=${sourceTourId}`), { timeout: 30_000 });
    await expect(page.getByText(/در حال بارگذاری تور برای کپی/)).toBeHidden({ timeout: 45_000 });
    await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });
  });
});

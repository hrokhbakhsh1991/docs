import { expect, test } from "@playwright/test";

import {
  advanceDenaliWizardToReview,
  clearWizardDrafts,
  fetchTourThemeBySlug,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  ownerPhoneFromProject,
  submitWizardAndExpectTourList,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

test.describe("real-stack denali create tour from settings preset", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test.beforeEach(async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    if (slug !== "denali") {
      test.skip(true, "denali project only");
    }
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
    await clearWizardDrafts(page, slug);
  });

  test("owner opens mountain_day preset → wizard pre-filled → submit", async ({ page }) => {

    const runId = `preset-mountain-day-${Date.now()}`;
    const theme = await fetchTourThemeBySlug(page, "mountain");
    expect(theme).toBeTruthy();

    await page.goto("/settings/tour-presets", { waitUntil: "domcontentloaded" });
    const createBtn = page.getByTestId(/tour-preset-create-tour-/).first();
    await expect(createBtn).toBeVisible({ timeout: 30_000 });
    await createBtn.click();

    await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });

    const titleInput = page.getByLabel("نام تور");
    await expect(titleInput).toHaveValue("");
    await titleInput.fill(`1234567890 preset ${runId}`);

    const location = await fetchWizardLocationIds(page);
    expect(location?.mainDestinationId).toBeTruthy();

    await advanceDenaliWizardToReview(page, {
      mainTourTheme: theme!,
      tourType: "mountain_day",
      titlePattern: /1234567890 preset/,
      destinationId: location!.mainDestinationId,
    });
    await submitWizardAndExpectTourList(page);
  });
});

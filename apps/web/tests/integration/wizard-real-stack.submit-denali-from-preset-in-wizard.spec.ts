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
const PRESET_SHORT_DESCRIPTION = "توضیح کوتاه پیش‌فرض قالب دنالی برای تست E2E";

test.describe("real-stack denali in-wizard preset select", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test.beforeEach(async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    if (slug !== "denali") {
      test.skip(true, "denali project only");
    }
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
    await clearWizardDrafts(page, slug);
  });

  test("owner selects settings preset in wizard → fields match Denali shape → submit", async ({
    page,
  }) => {
    const runId = `in-wizard-preset-${Date.now()}`;
    const theme = await fetchTourThemeBySlug(page, "mountain");
    expect(theme).toBeTruthy();

    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });

    const presetSelect = page.getByTestId("denali-wizard-preset-select");
    await expect(presetSelect).toBeVisible({ timeout: 30_000 });
    await presetSelect.selectOption({ label: "دنالی — کوه یک‌روزه" });
    await page.getByTestId("denali-wizard-preset-apply").click();

    const w = page.getByTestId("denali-create-tour-wizard");
    await expect(w.getByTestId("denali-basics-category")).toHaveValue("outdoor", { timeout: 15_000 });
    await expect(w.getByTestId("denali-basics-duration")).toHaveValue("single_day");

    const titleInput = page.getByLabel("نام تور");
    await expect(titleInput).toHaveValue("");
    await titleInput.fill(`1234567890 in-wizard ${runId}`);

    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText(/برنامه/, { timeout: 20_000 });
    await expect(page.getByLabel("توضیح کوتاه")).toHaveValue(PRESET_SHORT_DESCRIPTION, {
      timeout: 15_000,
    });

    const location = await fetchWizardLocationIds(page);
    expect(location?.mainDestinationId).toBeTruthy();

    await page.getByRole("button", { name: "قبلی" }).click();
    await expect(page.locator("form h2").first()).toContainText(/اطلاعات پایه|پایه/, {
      timeout: 20_000,
    });

    await advanceDenaliWizardToReview(page, {
      mainTourTheme: theme!,
      tourType: "mountain_day",
      titlePattern: /1234567890 in-wizard/,
      destinationId: location!.mainDestinationId,
    });
    await submitWizardAndExpectTourList(page);
  });
});

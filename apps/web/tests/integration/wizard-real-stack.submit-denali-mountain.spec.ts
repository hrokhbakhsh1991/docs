import { expect, test } from "@playwright/test";

import {
  advanceDenaliWizardToReview,
  buildDenaliSubmitDraftJson,
  clearWizardDrafts,
  fetchTourThemeForProfile,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  ownerPhoneFromProject,
  seedWizardDraft,
  submitWizardAndExpectTourList,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

test.describe("real-stack denali 6-tab wizard submit", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test("review step POST /api/tours returns 201 and navigates to /tours", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    if (slug !== "denali") {
      test.skip(true, "denali project only");
    }

    const runId = Date.now().toString();
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
    await clearWizardDrafts(page, slug);

    const location = await fetchWizardLocationIds(page);
    const theme = await fetchTourThemeForProfile(page, "denali_pilot");
    expect(theme, "denali workspace must expose a denali_pilot theme").toBeTruthy();

    const draftJson = buildDenaliSubmitDraftJson(location, `${slug}-${runId}`, {
      mainTourThemeId: theme!.id,
    });
    await seedWizardDraft(page, slug, draftJson);

    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });

    await advanceDenaliWizardToReview(page, { mainTourTheme: theme! });
    await submitWizardAndExpectTourList(page);
  });
});

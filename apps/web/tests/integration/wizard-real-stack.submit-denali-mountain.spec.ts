import { expect, test } from "@playwright/test";

import {
  advanceMountainWizardToReview,
  buildMountainSubmitDraftJson,
  clearWizardDrafts,
  submitWizardAndExpectTourList,
  fetchTourThemeForProfile,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  ownerPhoneFromProject,
  seedWizardDraft,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

test.describe("real-stack denali mountain wizard submit", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test("review step POST /api/tours returns 201 and navigates to /tours", async ({ page }, testInfo) => {
    page.on("console", (msg) => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = Date.now().toString();
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
    await clearWizardDrafts(page, slug);

    const location = await fetchWizardLocationIds(page);
    const theme = await fetchTourThemeForProfile(page, "mountain_outdoor");
    expect(theme, "denali workspace must expose a mountain_outdoor theme").toBeTruthy();
    const draftJson = buildMountainSubmitDraftJson(location, `${slug}-${runId}`, {
      mainTourThemeId: theme!.id,
    });
    await seedWizardDraft(page, slug, draftJson);

    await page.goto("/tours/new?e2eTourType=mountain", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 45_000 });

    await advanceMountainWizardToReview(page, { mainTourTheme: theme! });

    await submitWizardAndExpectTourList(page);
  });
});

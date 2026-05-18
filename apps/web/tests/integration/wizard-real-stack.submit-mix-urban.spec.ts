import { expect, test } from "@playwright/test";

import {
  advanceUrbanWizardToReview,
  buildUrbanSubmitDraftJson,
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

test.describe("real-stack mix-demo urban wizard submit", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test("review step POST /api/tours returns 201 and navigates to /tours", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = Date.now().toString();
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
    await clearWizardDrafts(page, slug);

    const location = await fetchWizardLocationIds(page);
    const theme = await fetchTourThemeForProfile(page, "urban_event");
    expect(theme, "mix-demo workspace must expose an urban_event theme").toBeTruthy();
    const draftJson = buildUrbanSubmitDraftJson(location, `${slug}-${runId}`, {
      mainTourThemeId: theme!.id,
    });
    await seedWizardDraft(page, slug, draftJson);

    await page.goto("/tours/new?e2eTourType=city", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 45_000 });

    await advanceUrbanWizardToReview(page, { mainTourTheme: theme! });

    await submitWizardAndExpectTourList(page);
  });
});

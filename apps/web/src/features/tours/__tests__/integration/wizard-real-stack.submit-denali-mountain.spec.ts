import { expect, test } from "@playwright/test";

import {
  advanceDenaliWizardToReview,
  fetchTourThemeForProfile,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  openDenaliCreateWizardWithFormPatch,
  ownerPhoneFromProject,
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

    const location = await fetchWizardLocationIds(page);
    const theme = await fetchTourThemeForProfile(page, "denali_pilot");
    expect(theme, "denali workspace must expose a denali_pilot theme").toBeTruthy();

    await openDenaliCreateWizardWithFormPatch(page, location, `${slug}-${runId}`, {
      mainTourThemeId: theme!.id,
    });

    await advanceDenaliWizardToReview(page, { mainTourTheme: theme! });
    await submitWizardAndExpectTourList(page);
  });
});

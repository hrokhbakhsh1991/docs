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

test.describe("real-stack urban wizard submit", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test("review step POST /api/tours returns 201 and navigates to /tours", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = Date.now().toString();
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));

    const location = await fetchWizardLocationIds(page);
    const theme = await fetchTourThemeForProfile(page, "urban_event");
    expect(theme, "urban workspace must expose an urban_event theme").toBeTruthy();

    await openDenaliCreateWizardWithFormPatch(page, location, `${slug}-${runId}`, {
      tourType: "event_reading",
      mainTourThemeId: theme!.id,
      meetingPoint: "کافه کتابخانه — میز اصلی",
    });

    await advanceDenaliWizardToReview(page, {
      mainTourTheme: theme!,
      tourType: "event_reading",
    });

    await submitWizardAndExpectTourList(page);
  });
});

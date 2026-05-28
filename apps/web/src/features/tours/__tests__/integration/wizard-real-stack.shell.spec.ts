import { test } from "@playwright/test";

import {
  expectTourWizardShell,
  loginWithPhoneOtp,
  ownerPhoneFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

test.describe("real-stack tour wizard shell", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test("OTP login and wizard shell with form_builder", async ({ page }, testInfo) => {
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
    await expectTourWizardShell(page);
  });
});

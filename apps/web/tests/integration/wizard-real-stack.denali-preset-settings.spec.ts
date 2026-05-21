import { expect, test } from "@playwright/test";

import {
  loginWithPhoneOtp,
  ownerPhoneFromProject,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

test.describe("real-stack denali settings tour presets", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test("owner sees create-tour-from-preset on /settings/tour-presets", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    if (slug !== "denali") {
      test.skip(true, "denali project only");
    }

    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
    await page.goto("/settings/tour-presets", { waitUntil: "domcontentloaded" });

    const createBtn = page.getByTestId(/tour-preset-create-tour-/).first();
    await expect(createBtn).toBeVisible({ timeout: 30_000 });
    await expect(createBtn).toBeEnabled();
  });
});

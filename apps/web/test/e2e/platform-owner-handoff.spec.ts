/**
 * P1 EPIC H — Owner invite → club admin login → dashboard → create-tour wizard.
 */
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { OPERATOR_INVITEE_MOBILE, loginOperatorWithPhone } from "../fixtures/operator-owner-session";
import {
  loginPlatformOps,
  uniquePlatformSubdomain,
} from "../fixtures/platform-ops-session";

test.describe("platform-owner-handoff.spec.ts — P1 EPIC H", () => {
  test.setTimeout(240_000);

  test("invite login dashboard then wizard shell", async ({ page, browser }) => {
    const subdomain = uniquePlatformSubdomain("handoff");

    await loginPlatformOps(page);
    const createRes = await page.request.post("/api/platform/tenants", {
      headers: { "Idempotency-Key": randomUUID() },
      data: {
        subdomain,
        workspaceType: "denali",
        ownerPhone: OPERATOR_INVITEE_MOBILE,
      },
    });
    const createText = await createRes.text();
    expect(createRes.ok(), createText).toBeTruthy();
    const createBody = JSON.parse(createText) as {
      invite?: { inviteToken?: string };
    };
    const inviteToken = createBody.invite?.inviteToken;
    expect(typeof inviteToken).toBe("string");
    expect((inviteToken ?? "").length).toBeGreaterThan(0);

    const clubContext = await browser.newContext({
      baseURL: `http://${subdomain}.admin.localhost:3000`,
    });
    const clubPage = await clubContext.newPage();

    await loginOperatorWithPhone(clubPage, OPERATOR_INVITEE_MOBILE, {
      inviteToken: inviteToken!,
      skipAbilityPreflight: true,
    });

    const templateRes = await clubPage.request.get("/api/settings/tour-wizard-template");
    const templateText = await templateRes.text();
    expect(templateRes.ok(), templateText).toBeTruthy();
    const templateBody = JSON.parse(templateText) as {
      payload?: { published?: boolean; steps?: unknown[] };
    };
    expect(templateBody.payload?.published).toBe(true);
    expect((templateBody.payload?.steps ?? []).length).toBeGreaterThanOrEqual(6);

    await expect(clubPage.getByTestId("operator-welcome-dialog")).toBeVisible({ timeout: 60_000 });
    await clubPage.getByTestId("operator-welcome-primary-cta").click();
    await clubPage.waitForURL(/\/tours\/new/, { timeout: 120_000, waitUntil: "commit" });
    await expect(
      clubPage.locator("[data-workspace-wizard-loading], [data-workspace-wizard]").first()
    ).toBeVisible({ timeout: 120_000 });

    if (await clubPage.locator("[data-workspace-wizard]").isVisible()) {
      const stepNext = clubPage.getByTestId("workspace-wizard-step-next");
      await expect(stepNext).toBeVisible({ timeout: 60_000 });
      await stepNext.click();
      await expect(clubPage.getByTestId("workspace-wizard-step-panel")).toBeVisible({
        timeout: 30_000,
      });
    }

    await clubContext.close();
  });
});

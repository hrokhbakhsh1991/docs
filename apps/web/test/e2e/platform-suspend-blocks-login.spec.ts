/**
 * P1 product exit — suspend blocks operator login on club admin host.
 */
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { OPERATOR_INVITEE_MOBILE, loginOperatorWithPhone } from "../fixtures/operator-owner-session";
import {
  loginPlatformOps,
  uniquePlatformSubdomain,
} from "../fixtures/platform-ops-session";

test.describe("platform-suspend-blocks-login.spec.ts — P1 exit", () => {
  test("request-otp rejected after platform suspend", async ({ page, browser }) => {
    const subdomain = uniquePlatformSubdomain("suspend");

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
      tenant?: { id?: string };
    };
    const tenantId = createBody.tenant?.id;
    expect(typeof tenantId).toBe("string");

    const suspendRes = await page.request.patch(`/api/platform/tenants/${tenantId}/status`, {
      data: { status: "suspended" },
    });
    const suspendText = await suspendRes.text();
    expect(suspendRes.ok(), suspendText).toBeTruthy();

    const clubContext = await browser.newContext({
      baseURL: `http://${subdomain}.admin.localhost:3000`,
    });
    const clubPage = await clubContext.newPage();

    const otpRes = await clubPage.request.post("/api/auth/request-otp", {
      data: { phone: OPERATOR_INVITEE_MOBILE },
    });
    const otpText = await otpRes.text();
    expect(otpRes.status()).toBe(403);
    expect(otpText).toContain("AUTH_TENANT_SUSPENDED");

    await clubContext.close();
  });

  test("existing operator session revoked after platform suspend", async ({ page, browser }) => {
    const subdomain = uniquePlatformSubdomain("suspend-live");

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
      tenant?: { id?: string };
      invite?: { inviteToken?: string };
    };
    const tenantId = createBody.tenant?.id;
    const inviteToken = createBody.invite?.inviteToken;
    expect(typeof tenantId).toBe("string");
    expect(typeof inviteToken).toBe("string");

    const clubContext = await browser.newContext({
      baseURL: `http://${subdomain}.admin.localhost:3000`,
    });
    const clubPage = await clubContext.newPage();

    await loginOperatorWithPhone(clubPage, OPERATOR_INVITEE_MOBILE, {
      inviteToken: inviteToken!,
      skipAbilityPreflight: true,
    });

    const suspendRes = await page.request.patch(`/api/platform/tenants/${tenantId}/status`, {
      data: { status: "suspended" },
    });
    expect(suspendRes.ok()).toBeTruthy();

    const dashboardRes = await clubPage.request.get("/api/auth/membership-ability-context");
    expect(dashboardRes.status()).toBeGreaterThanOrEqual(401);

    await clubContext.close();
  });
});

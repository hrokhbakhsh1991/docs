import { expect, test } from "@playwright/test";

import {
  OPERATOR_PUBLISHED_TOUR_TITLE,
  completePortalCatalogRegistration,
} from "./fixtures/complete-portal-registration";

const REGISTRATION_EMAIL = `smk-ptl-02-${Date.now()}@denali-smoke.local`;
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-PTL-02 member /me lists registration after catalog intake (VS-04)", async ({
  page,
}) => {
  await completePortalCatalogRegistration(page, {
    email: REGISTRATION_EMAIL,
    fullName: "Portal Member Smoke",
    phone: DEV_PHONE,
  });

  await page.locator('[data-public-registration-success] a[href="/me/registrations"]').click();
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(OPERATOR_PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(page.getByRole("link", { name: OPERATOR_PUBLISHED_TOUR_TITLE })).toBeVisible();
});

test("SMK-PTL-05 portal home redirects authenticated member to /me/registrations", async ({
  page,
}) => {
  const email = `smk-ptl-05-${Date.now()}@denali-smoke.local`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await completePortalCatalogRegistration(page, {
    email,
    fullName: "Portal Home Redirect Smoke",
    phone,
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 60_000 });
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });
});

const RECEIPT_EMAIL = `smk-ptl-04-${Date.now()}@denali-smoke.local`;
const RECEIPT_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-PTL-04 member uploads offline receipt on registration detail (VS-05)", async ({
  page,
}) => {
  await completePortalCatalogRegistration(page, {
    email: RECEIPT_EMAIL,
    fullName: "Portal Receipt Smoke",
    phone: RECEIPT_PHONE,
  });

  await page.locator('[data-public-registration-success] a[href="/me/registrations"]').click();
  await page.getByRole("link", { name: OPERATOR_PUBLISHED_TOUR_TITLE }).click();
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-portal-member-receipt-submit]")).toBeVisible();
  await page.waitForLoadState("networkidle");

  const [uploadRes] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/me/registrations/") &&
        res.url().includes("/receipt") &&
        res.request().method() === "POST"
    ),
    (async () => {
      await page.locator("#receipt-file").setInputFiles({
        name: "proof.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("smoke-receipt-jpeg"),
      });
      await page.locator("[data-portal-member-receipt-submit]").click();
    })(),
  ]);
  const uploadBody = await uploadRes.text();
  expect(uploadRes.ok(), `receipt upload ${uploadRes.status()} ${uploadBody.slice(0, 300)}`).toBe(true);
  await expect(page.locator("[data-portal-member-receipt-success]")).toBeVisible({
    timeout: 60_000,
  });
});

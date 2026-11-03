import { expect, test } from "@playwright/test";
import { openNativeSessionBrowser } from "./fixtures/native-session-browser";
import { fillCatalogOtp, submitCatalogPhoneForOtp } from "./fixtures/catalog-registration-otp";

const marketingBase = process.env.SESSION_SYNC_MARKETING_URL ?? "http://denali.localhost:3102";
const portal = process.env.SESSION_SYNC_PORTAL_URL ?? "http://portal.denali.localhost:3103";
const tour = process.env.SESSION_SYNC_TOUR_ID ?? "00000000-0000-4000-8000-000000000220";
const phone = process.env.SESSION_SYNC_PHONE;
const otp = process.env.SESSION_SYNC_OTP;

test.beforeEach(async () => {
  const control = process.env.SESSION_SYNC_FAULT_CONTROL_URL;
  if (control) {
    const response = await fetch(`${control}/__session_sync_test/mode/normal`, { method: "POST" });
    expect(response.status).toBe(204);
  }
});

test("open marketing PDP and header follow portal logout", async ({ page, context }) => {
  expect(phone, "SESSION_SYNC_PHONE must identify a synthetic test account").toBeTruthy();
  expect(otp, "SESSION_SYNC_OTP must contain its test OTP").toBeTruthy();
  await page.goto("/");
  await page.getByRole("link", { name: "ورود", exact: true }).first().click();
  await page.getByLabel("موبایل").fill(phone!);
  await page.getByRole("button", { name: "ارسال کد" }).click();
  const otpBox = page.getByRole("group", { name: "کد یک‌بارمصرف" });
  await expect(otpBox).toBeVisible({ timeout: 60_000 });
  await otpBox.getByRole("textbox").first().fill(otp!);
  await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 30_000 });

  const home = await context.newPage();
  await home.goto("/");
  await expect(home.locator("[data-marketing-member-authenticated]")).toBeVisible();
  const pdp = await context.newPage();
  await pdp.goto(`/tours/${tour}`);
  await expect(pdp.locator("[data-marketing-member-authenticated]")).toBeVisible();
  const beforeMode = await pdp
    .locator("[data-marketing-tour-detail-cta-mode]")
    .first()
    .getAttribute("data-marketing-tour-detail-cta-mode");
  expect(beforeMode).toMatch(/^member-/);
  await expect(pdp.locator("[data-marketing-header-member]").first()).toBeVisible();
  await pdp.screenshot({ path: test.info().outputPath("pdp-member.png") });

  const portalUrl = new URL(portal);
  if (portalUrl.hostname.endsWith(".localhost")) {
    const otherTenant = await context.newPage();
    const response = await otherTenant.goto(
      `http://portal.urban.localhost:${portalUrl.port}/api/public-auth/session`
    );
    expect(response?.status()).toBe(200);
    expect(await response?.json()).toEqual({ ok: true, ready: false });
    expect(
      (await context.cookies(`http://portal.urban.localhost:${portalUrl.port}`)).some(
        (cookie) => cookie.name === "atour_mb_session"
      )
    ).toBe(false);
    const memberCookie = (await context.cookies(portal)).find(
      (cookie) => cookie.name === "atour_mb_session"
    );
    expect(memberCookie).toBeTruthy();
    await context.addCookies([{ ...memberCookie!, domain: "urban.localhost" }]);
    // The production fixture has one explicit canonical marketing origin.
    // An unrelated tenant portal origin must still not read this portal.
    const crossTenantReadable = await otherTenant.evaluate(async (url) => {
      try {
        await fetch(url, { credentials: "include" });
        return true;
      } catch {
        return false;
      }
    }, `${portal}/api/public-auth/session`);
    expect(crossTenantReadable, "an unrelated tenant origin must not read this portal").toBe(false);
    const foreignProbe = await otherTenant.goto(
      `http://portal.urban.localhost:${portalUrl.port}/api/public-auth/session`
    );
    expect(foreignProbe?.status()).toBe(200);
    expect(await foreignProbe?.json()).toEqual({ ok: true, ready: false });
    await otherTenant.goto(`http://portal.urban.localhost:${portalUrl.port}/me/profile`);
    await expect(otherTenant).toHaveURL(/\/login/);
    expect(
      (await context.cookies(portal)).some((cookie) => cookie.name === "atour_mb_session")
    ).toBe(true);
    await otherTenant.close();
  }

  await page.bringToFront();
  const profileResponse = await page.goto(`${portal}/me/profile`);
  expect(profileResponse?.status()).toBe(200);
  expect((await profileResponse!.allHeaders())["set-cookie"]).toBeUndefined();
  let logoutCompletedAt = 0;
  page.on("response", (response) => {
    if (
      response.url().includes("/api/public-auth/logout") &&
      response.request().method() === "POST"
    ) {
      logoutCompletedAt = Date.now();
    }
  });
  await page
    .locator('[data-public-auth-logout][data-public-auth-logout-ready="true"]')
    .first()
    .click();
  await expect(page.locator("[data-marketing-member-authenticated]")).toHaveCount(0);
  await pdp.bringToFront();
  await expect(pdp.locator("[data-marketing-member-authenticated]")).toHaveCount(0, {
    timeout: 5_000,
  });
  await expect(pdp.locator("[data-marketing-tour-detail-cta-mode]").first()).not.toHaveAttribute(
    "data-marketing-tour-detail-cta-mode",
    /^member-/,
    { timeout: 5_000 }
  );
  await expect(pdp.locator("[data-marketing-header-member]")).toHaveCount(0);
  await expect(pdp.locator("[data-marketing-header-sign-in]").first()).toBeVisible();
  expect(logoutCompletedAt).toBeGreaterThan(0);
  expect(Date.now() - logoutCompletedAt).toBeLessThanOrEqual(5_000);
  await home.bringToFront();
  await expect(home.locator("[data-marketing-member-authenticated]")).toHaveCount(0, {
    timeout: 5_000,
  });
  await pdp.screenshot({ path: test.info().outputPath("pdp-guest-after-logout.png") });
  await pdp.reload();
  await expect(pdp.locator("[data-marketing-member-authenticated]")).toHaveCount(0);
  await expect(pdp.locator("[data-marketing-tour-detail-cta-mode]").first()).not.toHaveAttribute(
    "data-marketing-tour-detail-cta-mode",
    /^member-/
  );
  await pdp.goto("/tours");
  await pdp.goBack();
  await expect(pdp.locator("[data-marketing-member-authenticated]")).toHaveCount(0);
  await page.bringToFront();
  await page.goto(`${portal}/me/profile`);
  await expect(page).toHaveURL(/\/login/);

  // Re-authenticate in the same context after logout, without reloading the old PDP.
  await page.getByLabel("موبایل").fill(phone!);
  await page.getByRole("button", { name: "ارسال کد" }).click();
  await expect(otpBox).toBeVisible({ timeout: 60_000 });
  await otpBox.getByRole("textbox").first().fill(otp!);
  await expect(page).toHaveURL(/\/me\/profile/, { timeout: 30_000 });
  await pdp.bringToFront();
  await expect(pdp.locator("[data-marketing-header-member]").first()).toBeVisible({
    timeout: 5_000,
  });
  await expect(pdp.locator("[data-marketing-tour-detail-cta-mode]").first()).toHaveAttribute(
    "data-marketing-tour-detail-cta-mode",
    /^member-/,
    { timeout: 5_000 }
  );
});

for (const viewport of [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
] as const) {
  test(`PDP login synchronizes an already-open marketing tab (${viewport.label})`, async ({
    page,
    context,
  }) => {
    expect(phone, "SESSION_SYNC_PHONE must identify a synthetic test account").toBeTruthy();
    expect(otp, "SESSION_SYNC_OTP must contain its test OTP").toBeTruthy();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const home = await context.newPage();
    await home.goto("/");
    await expect(home.locator("[data-marketing-member-authenticated]")).toHaveCount(0);
    await page.bringToFront();
    await page.goto(`/tours/${tour}`);
    const cta = page.locator(
      viewport.label === "mobile"
        ? "[data-marketing-catalog-detail-sticky-cta] [data-marketing-register][data-marketing-register-ready='true']"
        : "[data-marketing-catalog-detail-booking-rail-cta] [data-marketing-register][data-marketing-register-ready='true']"
    );
    await expect(cta).toBeVisible();
    await cta.click();
    await submitCatalogPhoneForOtp(page, phone!);
    await fillCatalogOtp(page, otp!);
    await expect(page).toHaveURL(/\/catalog\/[^/]+\/register/, { timeout: 30_000 });
    await home.bringToFront();
    await expect(home.locator("[data-marketing-member-authenticated]")).toBeVisible({
      timeout: 5_000,
    });
    await page.bringToFront();
    await page.goto(`${portal}/me/profile`);
    await page
      .locator('[data-public-auth-logout][data-public-auth-logout-ready="true"]')
      .first()
      .click();
    await home.bringToFront();
    await expect(home.locator("[data-marketing-member-authenticated]")).toHaveCount(0, {
      timeout: 5_000,
    });
  });
}

test("probe failures preserve the current UI and unsaved filter until a confirmed change", async ({
  page,
  context,
}) => {
  const control = process.env.SESSION_SYNC_FAULT_CONTROL_URL;
  test.skip(!control, "a local fault-injection proxy is required");
  expect(phone, "SESSION_SYNC_PHONE must identify a synthetic test account").toBeTruthy();
  expect(otp, "SESSION_SYNC_OTP must contain its test OTP").toBeTruthy();
  const setFault = async (mode: string) => {
    const response = await fetch(`${control}/__session_sync_test/mode/${mode}`, { method: "POST" });
    expect(response.status).toBe(204);
  };
  try {
    await setFault("normal");
    await page.goto(`${portal}/login?portalReturn=%2Fme%2Fregistrations`);
    await page.getByLabel("موبایل").fill(phone!);
    await page.getByRole("button", { name: "ارسال کد" }).click();
    const otpBox = page.getByRole("group", { name: "کد یک‌بارمصرف" });
    await expect(otpBox).toBeVisible({ timeout: 60_000 });
    await otpBox.getByRole("textbox").first().fill(otp!);
    await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 30_000 });

    const list = await context.newPage();
    await list.goto("/tours");
    await expect(list.locator("[data-marketing-member-authenticated]")).toBeVisible();
    let refreshes = 0;
    list.on("request", (request) => {
      if (request.headers()["rsc"] === "1" && !request.headers()["next-router-prefetch"]) {
        refreshes += 1;
      }
    });
    let scenario: "error" | "invalid" | "offline" = "error";
    const attempts = { error: 0, invalid: 0, offline: 0 };
    list.on("response", (response) => {
      if (response.url().includes("/api/public-auth/session")) attempts[scenario] += 1;
    });
    list.on("requestfailed", (request) => {
      if (request.url().includes("/api/public-auth/session")) attempts[scenario] += 1;
    });
    const search = list.locator('input[type="search"][name="q"]');
    await search.fill("unsaved search");
    await setFault("error");
    await page.bringToFront();
    await page.goto(`${portal}/me/profile`);
    await page
      .locator('[data-public-auth-logout][data-public-auth-logout-ready="true"]')
      .first()
      .click();
    await list.bringToFront();
    for (const mode of ["error", "invalid", "offline"] as const) {
      scenario = mode;
      await setFault(mode);
      await list.waitForTimeout(5_500);
      expect(attempts[mode]).toBeGreaterThan(0);
      await expect(list.locator("[data-marketing-member-authenticated]")).toBeVisible();
      await expect(search).toHaveValue("unsaved search");
    }
    await setFault("normal");
    await list.bringToFront();
    await expect(list.locator("[data-marketing-member-authenticated]")).toHaveCount(0, {
      timeout: 5_000,
    });
    await expect(search).toHaveValue("unsaved search");
    // Settled session state must not keep refreshing the page on each probe.
    const settledRefreshes = refreshes;
    await list.waitForTimeout(6_500);
    expect(refreshes).toBe(settledRefreshes);
    await expect(search).toHaveValue("unsaved search");
  } finally {
    await setFault("normal");
  }
});

test("an expired member cookie updates marketing and protects portal routes", async ({
  page,
  context,
}) => {
  expect(phone, "SESSION_SYNC_PHONE must identify a synthetic test account").toBeTruthy();
  expect(otp, "SESSION_SYNC_OTP must contain its test OTP").toBeTruthy();
  await page.goto(`${portal}/login?portalReturn=%2Fme%2Fregistrations`);
  await page.getByLabel("موبایل").fill(phone!);
  await page.getByRole("button", { name: "ارسال کد" }).click();
  const otpBox = page.getByRole("group", { name: "کد یک‌بارمصرف" });
  await expect(otpBox).toBeVisible({ timeout: 60_000 });
  await otpBox.getByRole("textbox").first().fill(otp!);
  await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 30_000 });
  const pdp = await context.newPage();
  await pdp.goto(`/tours/${tour}`);
  await expect(pdp.locator("[data-marketing-member-authenticated]")).toBeVisible();
  const memberCookie = (await context.cookies(portal)).find(
    (cookie) => cookie.name === "atour_mb_session"
  );
  expect(memberCookie).toBeTruthy();
  const expiresAt = Math.floor(Date.now() / 1000) + 2;
  await context.addCookies([{ ...memberCookie!, expires: expiresAt }]);
  await pdp.bringToFront();
  await expect(pdp.locator("[data-marketing-member-authenticated]")).toHaveCount(0, {
    timeout: 7_000,
  });
  await expect(pdp.locator("[data-marketing-tour-detail-cta-mode]").first()).not.toHaveAttribute(
    "data-marketing-tour-detail-cta-mode",
    /^member-/
  );
  expect(Date.now() - expiresAt * 1000).toBeLessThanOrEqual(5_000);
  await page.bringToFront();
  await page.goto(`${portal}/me/profile`);
  await expect(page).toHaveURL(/\/login/);
});

test("a late pre-logout session response cannot restore authentication", async ({
  page,
  context,
}) => {
  const control = process.env.SESSION_SYNC_FAULT_CONTROL_URL;
  test.skip(!control, "a local fault-injection proxy is required");
  expect(phone).toBeTruthy();
  expect(otp).toBeTruthy();
  const setMode = async (mode: string) => {
    expect(
      (await fetch(`${control}/__session_sync_test/mode/${mode}`, { method: "POST" })).status
    ).toBe(204);
  };
  try {
    await page.goto(`${portal}/login?portalReturn=%2Fme%2Fregistrations`);
    await page.getByLabel("موبایل").fill(phone!);
    await page.getByRole("button", { name: "ارسال کد" }).click();
    const otpBox = page.getByRole("group", { name: "کد یک‌بارمصرف" });
    await expect(otpBox).toBeVisible({ timeout: 60_000 });
    await otpBox.getByRole("textbox").first().fill(otp!);
    await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 30_000 });
    await page.goto(`${portal}/me/profile`);
    await setMode("hold");
    const marketing = await context.newPage();
    await marketing.goto("/");
    const delayedProbe = marketing.evaluate(async (portalOrigin) => {
      const response = await fetch(
        `${portalOrigin}/api/public-auth/session?session_sync_test=late`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      return { status: response.status, body: await response.json() };
    }, portal);
    await expect
      .poll(async () => (await (await fetch(`${control}/__session_sync_test/held`)).json()).marked)
      .toBeGreaterThan(0);
    await page.bringToFront();
    const loggedOut = page.waitForResponse(
      (response) => response.url().includes("/api/public-auth/logout") && response.status() === 200
    );
    await page
      .locator('[data-public-auth-logout][data-public-auth-logout-ready="true"]')
      .first()
      .click();
    await loggedOut;
    await expect(page).toHaveURL(new URL("/", marketingBase).href);
    expect((await context.cookies()).some((cookie) => cookie.name === "atour_mb_session")).toBe(
      false
    );
    await setMode("normal");
    expect(await delayedProbe).toEqual({ status: 200, body: { ok: true, ready: true } });
    expect(
      (await context.cookies()).some((cookie) => cookie.name === "atour_mb_session"),
      "a read-only probe must not resurrect the cleared cookie"
    ).toBe(false);
    await page.goto(`${portal}/me/profile`);
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await setMode("normal");
  }
});

test("a genuinely hidden marketing tab pauses probes and updates when activated", async ({}, testInfo) => {
  const native = await openNativeSessionBrowser(testInfo.outputDir);
  try {
    const context = native.context;
    const page = context.pages()[0] ?? (await context.newPage());
    expect(phone).toBeTruthy();
    expect(otp).toBeTruthy();
    let probes = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/public-auth/session")) probes += 1;
    });
    await page.goto(new URL("/", marketingBase).href);
    await expect.poll(() => probes).toBeGreaterThan(0);
    const portalPage = await context.newPage();
    await portalPage.goto(`${portal}/login?portalReturn=%2Fme%2Fregistrations`);
    await portalPage.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden");
    const before = probes;
    await portalPage.waitForTimeout(6_500);
    expect(probes).toBe(before);
    await portalPage.getByLabel("موبایل").fill(phone!);
    await portalPage.getByRole("button", { name: "ارسال کد" }).click();
    const otpBox = portalPage.getByRole("group", { name: "کد یک‌بارمصرف" });
    await expect(otpBox).toBeVisible({ timeout: 60_000 });
    await otpBox.getByRole("textbox").first().fill(otp!);
    await expect(portalPage).toHaveURL(/\/me\/registrations/, { timeout: 30_000 });
    expect(probes).toBe(before);
    await page.bringToFront();
    await expect(page.locator("[data-marketing-member-authenticated]")).toBeVisible({
      timeout: 5_000,
    });
  } finally {
    await native.close();
  }
});

test("a session that marketing SSR cannot read does not create a refresh loop", async ({
  page,
  context,
}) => {
  const control = process.env.SESSION_SYNC_FAULT_CONTROL_URL;
  test.skip(!control, "a local fault-injection proxy is required");
  let refreshes = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/" &&
      request.headers()["rsc"] === "1" &&
      !request.headers()["next-router-prefetch"]
    )
      refreshes += 1;
  });
  try {
    expect(
      (await fetch(`${control}/__session_sync_test/mode/ready`, { method: "POST" })).status
    ).toBe(204);
    await page.goto("/");
    await expect.poll(() => refreshes).toBe(1);
    await page.waitForTimeout(6_500);
    expect(refreshes).toBe(1);
    await expect(page.locator("[data-marketing-member-authenticated]")).toHaveCount(1);
    expect((await context.cookies()).some((cookie) => cookie.name === "atour_mb_session")).toBe(
      false
    );
  } finally {
    expect(
      (await fetch(`${control}/__session_sync_test/mode/normal`, { method: "POST" })).status
    ).toBe(204);
  }
});

for (const path of ["visible polling", "tab activation"] as const) {
  test(`an older in-flight probe cannot delay logout synchronization (${path})`, async ({
    page: defaultPage,
    context: defaultContext,
  }, testInfo) => {
    const control = process.env.SESSION_SYNC_FAULT_CONTROL_URL;
    test.skip(!control, "a local fault-injection proxy is required");
    const native =
      path === "tab activation" ? await openNativeSessionBrowser(testInfo.outputDir) : null;
    const context = native?.context ?? defaultContext;
    const page = native ? (context.pages()[0] ?? (await context.newPage())) : defaultPage;

    const mode = async (value: string) =>
      expect(
        (await fetch(`${control}/__session_sync_test/mode/${value}`, { method: "POST" })).status
      ).toBe(204);
    try {
      await page.goto(`${portal}/login?portalReturn=%2Fme%2Fprofile`);
      await page.getByLabel("موبایل").fill(phone!);
      await page.getByRole("button", { name: "ارسال کد" }).click();
      const otpBox = page.getByRole("group", { name: "کد یک‌بارمصرف" });
      await expect(otpBox).toBeVisible({ timeout: 60_000 });
      await otpBox.getByRole("textbox").first().fill(otp!);
      await expect(page).toHaveURL(/\/me\/profile/, { timeout: 30_000 });
      const logout = page
        .locator('[data-public-auth-logout][data-public-auth-logout-ready="true"]')
        .first();
      await expect(logout).toBeVisible();
      const marketing = await context.newPage();
      const initialized = marketing.waitForResponse(
        (response) =>
          response.url().includes("/api/public-auth/session") && response.status() === 200
      );
      await marketing.goto(new URL("/", marketingBase).href);
      await initialized;
      await expect(marketing.locator("[data-marketing-header-member]").first()).toBeVisible();
      await mode("hold");
      await expect
        .poll(async () => (await (await fetch(`${control}/__session_sync_test/held`)).json()).count)
        .toBeGreaterThan(0);
      // New probes can succeed while the earlier authenticated response remains held.
      await mode("drain");
      const loggedOut = page.waitForResponse(
        (response) =>
          response.url().includes("/api/public-auth/logout") && response.status() === 200
      );
      if (path === "tab activation") {
        await page.bringToFront();
        await expect.poll(() => marketing.evaluate(() => document.visibilityState)).toBe("hidden");
        await logout.click();
      } else {
        // Keep marketing active: the real Portal-origin request clears browser cookies.
        expect(
          await page.evaluate(
            async () => (await fetch("/api/public-auth/logout", { method: "POST" })).status
          )
        ).toBe(200);
      }
      await loggedOut;
      const completedAt = Date.now();
      if (path === "tab activation") await marketing.bringToFront();
      else expect(await marketing.evaluate(() => document.visibilityState)).toBe("visible");
      await expect(marketing.locator("[data-marketing-header-member]")).toHaveCount(0, {
        timeout: 5_000,
      });
      await expect(marketing.locator("[data-marketing-header-sign-in]").first()).toBeVisible();
      expect(Date.now() - completedAt).toBeLessThanOrEqual(5_000);
      await mode("normal");
      await expect(marketing.locator("[data-marketing-header-member]")).toHaveCount(0);
    } finally {
      try {
        await mode("normal");
      } finally {
        await native?.close();
      }
    }
  });
}

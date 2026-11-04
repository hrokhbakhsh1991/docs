import { expect, test, type Locator, type Page } from "@playwright/test";

const phone = process.env.SESSION_SYNC_PHONE ?? "+15550001996";
const portal = process.env.SESSION_SYNC_PORTAL_URL ?? "http://portal.denali.localhost:3203";
const admin = process.env.SESSION_SYNC_ADMIN_URL ?? "http://denali.admin.localhost:3200";
const tour = process.env.SESSION_SYNC_TOUR_ID ?? "00000000-0000-4000-8000-000000000220";
const code = "654321"; // Local/CI fixture only; these tests never call an SMS provider.

async function completeIssuedCode(page: Page, group: Locator, expectedChallengeId?: string) {
  const cells = group.getByRole("textbox");
  await expect(cells).toHaveCount(6);
  await page.screenshot({ path: test.info().outputPath("six-digit-input.png") });
  let verifies = 0;
  page.on("request", (request) => {
    if (/\/api\/(auth\/login|public-auth\/verify-otp)/.test(request.url())) verifies += 1;
  });
  for (let index = 0; index < 4; index++) await cells.nth(index).fill(code[index]!);
  expect(verifies, "four digits must not auto-submit a six-digit challenge").toBe(0);
  const verified = page.waitForResponse(
    (response) =>
      /\/api\/(auth\/login|public-auth\/verify-otp)/.test(response.url()) &&
      response.request().method() === "POST" &&
      response.request().postDataJSON()?.otp === code &&
      (expectedChallengeId === undefined ||
        response.request().postDataJSON()?.challenge_id === expectedChallengeId),
    { timeout: 60_000 }
  );
  await cells.nth(4).fill(code[4]!);
  await cells.nth(5).fill(code[5]!);
  const response = await verified;
  const payload = (await response.json().catch(() => ({}))) as {
    code?: unknown;
    error?: { code?: unknown };
  };
  expect(
    response.status(),
    `OTP verification failed with ${String(payload.code ?? payload.error?.code ?? "unknown")}`
  ).toBe(200);
}

test("six-digit OTP completes admin login with the issued code", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/request-otp")) requests += 1;
  });
  await page.goto(`${admin}/auth/login`);
  const phoneInput = page.getByRole("textbox", { name: "شماره موبایل", exact: true });
  expect(requests, "Admin must not request a development OTP before user action").toBe(0);
  await phoneInput.fill(phone);
  const requested = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/request-otp") && response.request().method() === "POST",
    { timeout: 60_000 }
  );
  await page.getByRole("button", { name: "ارسال رمز", exact: true }).click();
  const otpResponse = await requested;
  expect(otpResponse.status()).toBe(200);
  const challenge = (await otpResponse.json()) as {
    challenge_id?: unknown;
    otp_length?: unknown;
  };
  expect(challenge.otp_length).toBe(6);
  expect(typeof challenge.challenge_id).toBe("string");
  await completeIssuedCode(
    page,
    page.getByRole("group", { name: "رمز یک‌بارمصرف" }),
    challenge.challenge_id as string
  );
  await expect(page).not.toHaveURL(/\/auth\/login/);
});

test("six-digit OTP completes the Portal login page", async ({ page }) => {
  await page.goto(`${portal}/login?portalReturn=%2Fme%2Fregistrations`);
  await page.getByRole("textbox", { name: "موبایل", exact: true }).fill(phone);
  await page.getByRole("button", { name: "ارسال کد", exact: true }).click();
  await completeIssuedCode(page, page.getByRole("group", { name: "کد یک‌بارمصرف" }));
  await expect(page).toHaveURL(/\/me\/registrations/);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`six-digit OTP completes the PDP modal at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/tours/${tour}?auth=login`);
    await page.getByRole("textbox", { name: "موبایل", exact: true }).fill(phone);
    await page.getByRole("button", { name: "ارسال کد", exact: true }).click();
    await completeIssuedCode(page, page.getByRole("group", { name: "کد یک‌بارمصرف" }));
    await expect(page).toHaveURL(/\/catalog\/[^/]+\/register/);
  });
}

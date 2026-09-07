import { expect, type Page } from "@playwright/test";

const SESSION_COOKIE = "atour_mb_session";
const DEV_OTP = "1234";
const URBAN_SMOKE_MEMBER_PHONE = "+15550004002";

function resolvePortalCookieUrl(): string {
  return (
    process.env.SMOKE_PORTAL_BASE_URL?.replace(/\/$/, "") ??
    process.env.PORTAL_INTERNAL_URL?.replace(/\/$/, "") ??
    "http://urban.portal.localhost:3003"
  );
}

/**
 * Urban portal member session via BFF OTP (memory smoke — no catalog registration route).
 */
export async function authenticateUrbanPortalMember(
  page: Page,
  input?: {
    readonly phone?: string;
    readonly fullName?: string;
  }
): Promise<void> {
  const phone = input?.phone ?? URBAN_SMOKE_MEMBER_PHONE;
  const fullName = input?.fullName ?? "Urban Notif Member";

  await page.context().clearCookies();

  const otpRes = await page.request.post("/api/public-auth/request-otp", {
    data: { phone },
    timeout: 120_000,
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const verifyRes = await page.request.post("/api/public-auth/verify-otp", {
    data: {
      phone,
      otp: DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  const verifyText = await verifyRes.text();
  expect(verifyRes.ok(), verifyText).toBeTruthy();
  const verifyBody = JSON.parse(verifyText) as {
    session_token?: string;
    requires_registration?: boolean;
    onboarding_token?: string;
  };

  let sessionToken = verifyBody.session_token;
  if (verifyBody.requires_registration === true) {
    expect(typeof verifyBody.onboarding_token).toBe("string");
    const completeRes = await page.request.post("/api/public-auth/register-complete", {
      data: {
        onboarding_token: verifyBody.onboarding_token,
        display_name: fullName,
      },
      timeout: 120_000,
    });
    const completeText = await completeRes.text();
    expect(completeRes.ok(), completeText).toBeTruthy();
    const completeBody = JSON.parse(completeText) as { session_token?: string };
    sessionToken = completeBody.session_token;
  }

  expect(typeof sessionToken).toBe("string");

  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: sessionToken!,
      url: resolvePortalCookieUrl(),
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const probe = await page.request.get("/api/me/notifications/unread-count");
  expect(probe.ok(), await probe.text()).toBeTruthy();
}

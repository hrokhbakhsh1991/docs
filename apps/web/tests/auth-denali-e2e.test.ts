import assert from "node:assert/strict";
import test from "node:test";

const BASE_URL = "http://denali.localhost:3000";
const TEST_PHONE = "+989121236598";
const INVITED_PHONE = "+989121234567";

function parseSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) {
    return null;
  }
  const match = setCookieHeader.match(/(?:^|,\s*)session=([^;,\s]+)/);
  if (!match || !match[1]) {
    return null;
  }
  return `session=${match[1]}`;
}

test("denali existing user OTP login flow", async () => {
  const preflightRes = await fetch(`${BASE_URL}/api/auth/phone-preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: TEST_PHONE })
  });
  const preflightJson = (await preflightRes.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("STEP1 /api/auth/phone-preflight", {
    status: preflightRes.status,
    body: preflightJson
  });
  assert.equal(preflightRes.status, 200);
  assert.equal(preflightJson.ok, true);
  if (preflightJson.mode !== "existing_user") {
    console.log("STEP1 NOTE: mode is not existing_user", { mode: preflightJson.mode });
  }

  const otpReqRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: TEST_PHONE })
  });
  const otpReqJson = (await otpReqRes.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("STEP2 /api/auth/request-otp", {
    status: otpReqRes.status,
    body: otpReqJson
  });
  assert.equal(otpReqRes.status, 200);
  assert.equal(otpReqJson.ok, true);
  assert.equal(otpReqJson.otp_requested, true);

  const loginRes = await fetch(`${BASE_URL}/api/auth/login-web-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: TEST_PHONE, otp: "1234" })
  });
  const loginJson = (await loginRes.json().catch(() => ({}))) as Record<string, unknown>;
  const setCookie = loginRes.headers.get("set-cookie");
  const sessionCookie = parseSessionCookie(setCookie);
  console.log("STEP3 /api/auth/login-web-session", {
    status: loginRes.status,
    body: loginJson,
    has_set_cookie: Boolean(setCookie),
    session_cookie_extracted: Boolean(sessionCookie)
  });
  assert.equal(loginRes.status, 200);
  assert.equal(typeof loginJson.ok, "boolean");
  if (loginJson.ok === false) {
    assert.equal(loginJson.error_code, "AUTH_NO_ACTIVE_MEMBERSHIP");
  } else {
    assert.notEqual(loginJson.requires_registration, true);
  }

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "GET",
    headers: sessionCookie ? { cookie: sessionCookie } : undefined
  });
  const sessionJson = (await sessionRes.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("STEP4 /api/auth/session", {
    status: sessionRes.status,
    body: sessionJson
  });
  assert.equal(sessionRes.status, 200);
  assert.equal(typeof sessionJson.authenticated, "boolean");

  if (loginJson.ok === true) {
    assert.equal(sessionJson.authenticated, true);
    assert.equal(typeof sessionJson.session_token, "string");
    assert.equal(typeof sessionJson.user_id, "string");
    assert.equal(typeof sessionJson.tenant_id, "string");
  }
});

test("denali OTP login fails for existing user without active membership", async () => {
  const preflightRes = await fetch(`${BASE_URL}/api/auth/phone-preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: INVITED_PHONE })
  });
  const preflightJson = (await preflightRes.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("INVITED_STEP1 /api/auth/phone-preflight", {
    status: preflightRes.status,
    body: preflightJson
  });
  assert.equal(preflightRes.status, 200);
  assert.equal(preflightJson.ok, true);
  assert.equal(preflightJson.mode, "existing_user");

  const otpReqRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: INVITED_PHONE })
  });
  const otpReqJson = (await otpReqRes.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("INVITED_STEP2 /api/auth/request-otp", {
    status: otpReqRes.status,
    body: otpReqJson
  });
  assert.equal(otpReqRes.status, 200);
  assert.equal(otpReqJson.ok, true);
  assert.equal(otpReqJson.otp_requested, true);

  const loginRes = await fetch(`${BASE_URL}/api/auth/login-web-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: INVITED_PHONE, otp: "1234" })
  });
  const loginJson = (await loginRes.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("INVITED_STEP3 /api/auth/login-web-session", {
    status: loginRes.status,
    body: loginJson
  });
  assert.equal(loginRes.status, 200);
  assert.equal(loginJson.ok, false);
  assert.equal(loginJson.error_code, "AUTH_NO_ACTIVE_MEMBERSHIP");

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "GET"
  });
  const sessionJson = (await sessionRes.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("INVITED_STEP4 /api/auth/session", {
    status: sessionRes.status,
    body: sessionJson
  });
  assert.equal(sessionRes.status, 200);
  assert.equal(sessionJson.authenticated, false);
});

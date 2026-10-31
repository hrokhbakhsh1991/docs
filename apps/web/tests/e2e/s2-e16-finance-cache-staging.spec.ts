import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { resolve } from "node:path";
import { checkServerIdentity } from "node:tls";

import { expect, test, type Page, type Route } from "@playwright/test";

import { loadTwoTenantStagingManifest } from "../../test/fixtures/two-tenant-staging-config.mts";
import { resolveS2E16IdentityInputs } from "../../test/fixtures/s2e16-finance-cache-contract.mts";
import { SESSION_TOKEN_COOKIE } from "../../src/auth/build-session-cookie";

const manifest = loadTwoTenantStagingManifest();
const identities = resolveS2E16IdentityInputs(process.env);
const relayPort = Number(process.env.DENALI_SECOND_STAGING_RELAY_PORT ?? "0");
const caPath = process.env.DENALI_SECOND_STAGING_CADDY_ROOT_CA?.trim() ?? "";
const expectedCaSha256 = process.env.DENALI_SECOND_STAGING_CADDY_ROOT_CA_SHA256?.trim() ?? "";
const otpPostPaths = new Set(["/api/auth/request-otp", "/api/auth/login-web-session"]);
const allowedHosts = new Set(
  Object.values(manifest.tenants).flatMap((tenant) =>
    Object.values(tenant.hosts).map((origin) => new URL(origin).hostname.toLowerCase())
  )
);

type RelayState = {
  requests: number;
  failures: number;
  blockedTargets: number;
  rejectedWrites: number;
  hostRequests: Record<string, number>;
};

type ResponseSummary = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  sessionCookie?: string;
};

type BrowserJsonResponse = {
  status: number;
  text: string;
};

type FinanceSnapshot = {
  registrationIds: readonly string[];
  paymentIds: readonly string[];
  rowFingerprints: readonly string[];
};

function resolveRelayPort(): number {
  if (!Number.isInteger(relayPort) || relayPort < 1024 || relayPort > 65535) {
    throw new Error("S2E16_RELAY_PORT_INVALID");
  }
  if (caPath.length === 0) throw new Error("S2E16_CA_PATH_REQUIRED");
  if (!/^[a-f0-9]{64}$/i.test(expectedCaSha256)) {
    throw new Error("S2E16_CA_SHA256_PIN_REQUIRED");
  }
  return relayPort;
}

async function readPinnedCa(): Promise<Buffer> {
  const ca = await readFile(resolve(caPath));
  const actual = createHash("sha256").update(ca).digest("hex");
  if (actual.toLowerCase() !== expectedCaSha256.toLowerCase()) {
    throw new Error("S2E16_CA_SHA256_PIN_MISMATCH");
  }
  return ca;
}

function summarizeText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function summarizeIds(values: readonly string[]): string {
  return summarizeText([...values].sort().join("\n"));
}

async function relayStagingRequest(
  route: Route,
  ca: Buffer,
  state: RelayState
): Promise<ResponseSummary> {
  const request = route.request();
  const url = new URL(request.url());
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(hostname) ||
    (url.port.length > 0 && url.port !== "443") ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    state.blockedTargets += 1;
    throw new Error("S2E16_RELAY_TARGET_REJECTED");
  }
  if (request.method() !== "GET" && request.method() !== "HEAD" && request.method() !== "OPTIONS") {
    const pathname = url.pathname;
    if (request.method() !== "POST" || !otpPostPaths.has(pathname)) {
      state.rejectedWrites += 1;
      throw new Error("S2E16_UNEXPECTED_WRITE_REJECTED");
    }
  }

  const headers = { ...request.headers(), host: hostname };
  delete headers["accept-encoding"];
  delete headers["content-length"];
  delete headers.connection;
  const body = request.postDataBuffer();
  state.requests += 1;
  state.hostRequests[hostname] = (state.hostRequests[hostname] ?? 0) + 1;

  return new Promise<ResponseSummary>((resolveResponse, reject) => {
    const outgoing = httpsRequest(
      {
        hostname: "127.0.0.1",
        port: resolveRelayPort(),
        path: `${url.pathname}${url.search}`,
        method: request.method(),
        headers,
        servername: hostname,
        ca,
        agent: false,
        rejectUnauthorized: true,
        timeout: 30_000,
        checkServerIdentity: (_serverName, certificate) =>
          checkServerIdentity(hostname, certificate),
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          const responseHeaders: Record<string, string> = {};
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (
              name === "connection" ||
              name === "transfer-encoding" ||
              name === "keep-alive" ||
              name === "content-length"
            ) {
              continue;
            }
            if (typeof value === "string") responseHeaders[name] = value;
          }
          const sessionCookie = (incoming.headers["set-cookie"] ?? []).find((value) =>
            value.startsWith(`${SESSION_TOKEN_COOKIE}=`)
          );
          if (
            request.method() === "POST" &&
            url.pathname === "/api/auth/login-web-session" &&
            sessionCookie === undefined
          ) {
            reject(new Error("S2E16_SESSION_COOKIE_MISSING"));
            return;
          }
          resolveResponse({
            status: incoming.statusCode ?? 502,
            headers: responseHeaders,
            body: Buffer.concat(chunks),
            ...(sessionCookie === undefined ? {} : { sessionCookie }),
          });
        });
      }
    );
    outgoing.on("timeout", () => outgoing.destroy(new Error("S2E16_RELAY_TIMEOUT")));
    outgoing.on("error", reject);
    if (body !== null) outgoing.write(body);
    outgoing.end();
  });
}

async function browserJson(
  page: Page,
  method: "GET" | "POST",
  path: string,
  data?: unknown
): Promise<BrowserJsonResponse> {
  return page.evaluate(
    async ({ method, path, data }) => {
      const response = await fetch(path, {
        method,
        cache: "no-store",
        credentials: "include",
        ...(data === undefined
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(data),
            }),
      });
      return { status: response.status, text: await response.text() };
    },
    { method, path, data }
  );
}

async function loginFinanceOnCurrentOrigin(page: Page, phone: string, otp: string): Promise<void> {
  const origin = new URL(page.url()).origin;
  const requestOtp = await browserJson(page, "POST", "/api/auth/request-otp", { phone });
  expect(requestOtp.status, "S2E16_REQUEST_OTP_FAILED").toBe(200);
  const challengeId = (JSON.parse(requestOtp.text) as { challenge_id?: unknown }).challenge_id;
  expect(typeof challengeId, "S2E16_OTP_CHALLENGE_MISSING").toBe("string");

  const login = await browserJson(page, "POST", "/api/auth/login-web-session", {
    phone,
    otp,
    challenge_id: challengeId,
  });
  expect(login.status, "S2E16_FINANCE_LOGIN_FAILED").toBe(200);
  const sessionToken = (JSON.parse(login.text) as { session_token?: unknown }).session_token;
  expect(typeof sessionToken, "S2E16_SESSION_TOKEN_MISSING").toBe("string");

  const hostname = new URL(origin).hostname;
  const tenantLabel = origin === manifest.tenants.A.hosts.admin ? "A" : "B";
  const cookieDomain = manifest.tenants[tenantLabel].cookieDomain;
  const cookies = await page.context().cookies(origin);
  const sessionCookies = cookies.filter((cookie) => cookie.name === SESSION_TOKEN_COOKIE);
  expect(sessionCookies, "S2E16_SERVER_SESSION_COOKIE_MISSING").toHaveLength(1);
  const sessionCookie = sessionCookies[0]!;
  expect(sessionCookie.value, "S2E16_SERVER_SESSION_COOKIE_VALUE_MISMATCH").toBe(sessionToken);
  expect(sessionCookie.httpOnly, "S2E16_SESSION_COOKIE_NOT_HTTP_ONLY").toBe(true);
  expect(sessionCookie.secure, "S2E16_SESSION_COOKIE_NOT_SECURE").toBe(true);
  expect(sessionCookie.domain.replace(/^\./, ""), "S2E16_SESSION_COOKIE_DOMAIN_MISMATCH").toBe(
    cookieDomain ?? hostname
  );
  if (cookieDomain === null) {
    expect(sessionCookie.domain, "S2E16_SESSION_COOKIE_NOT_HOST_ONLY").toBe(hostname);
  }

  const abilityResponse = await browserJson(page, "GET", "/api/auth/membership-ability-context");
  expect(abilityResponse.status, "S2E16_MEMBERSHIP_CONTEXT_FAILED").toBe(200);
  const ability = JSON.parse(abilityResponse.text) as {
    tenantId?: unknown;
    role?: unknown;
    capabilities?: { canManageTenant?: unknown };
  };
  expect(ability.tenantId, `S2E16_${tenantLabel}_TENANT_CONTEXT_MISMATCH`).toBe(
    manifest.tenants[tenantLabel].tenantId
  );
  expect(ability.role, `S2E16_${tenantLabel}_FINANCE_ROLE_MISMATCH`).toBe("admin");
}

async function readFinanceSnapshot(
  page: Page,
  origin: string,
  replaceCurrent = false
): Promise<FinanceSnapshot> {
  const paymentsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.hostname === new URL(origin).hostname &&
      url.pathname === "/api/finance/payments"
    );
  });
  const financePath = `${origin}/finance?tab=payments`;
  if (replaceCurrent) {
    await page.evaluate((path) => window.location.replace(path), financePath);
  } else {
    await page.goto(financePath, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
  const response = await paymentsResponse;
  expect(response.status(), "S2E16_FINANCE_PAYMENTS_READ_FAILED").toBe(200);
  const payload = (await response.json()) as {
    items?: readonly { id?: unknown; registrationId?: unknown }[];
  };
  const items = Array.isArray(payload.items) ? payload.items : [];
  const paymentIds = items
    .map((item) => (typeof item.id === "string" ? item.id : ""))
    .filter(Boolean);
  const registrationIds = items
    .map((item) => (typeof item.registrationId === "string" ? item.registrationId : ""))
    .filter(Boolean);

  await expect(page.getByTestId("finance-payments-panel")).toBeVisible({ timeout: 30_000 });
  const rows = page.getByTestId("finance-payment-row");
  await expect(rows.first(), "S2E16_FINANCE_FIXTURE_REQUIRED").toBeVisible({ timeout: 30_000 });
  const rowText = await rows.allTextContents();
  const rowFingerprints = rowText.map((text) => summarizeText(text.trim())).sort();
  expect(paymentIds.length, "S2E16_PAYMENT_FIXTURE_REQUIRED").toBeGreaterThan(0);
  expect(registrationIds.length, "S2E16_REGISTRATION_FIXTURE_REQUIRED").toBeGreaterThan(0);
  return { registrationIds, paymentIds, rowFingerprints };
}

async function currentFinanceRowFingerprints(page: Page): Promise<readonly string[]> {
  const values = await page.getByTestId("finance-payment-row").allTextContents();
  return values.map((text) => summarizeText(text.trim())).sort();
}

test("S2-E16 A→B warm finance cache switch, history restore and UI refresh stay tenant scoped", async ({
  page,
}, testInfo) => {
  const relayPort = resolveRelayPort();
  const ca = await readPinnedCa();
  const relayState: RelayState = {
    requests: 0,
    failures: 0,
    blockedTargets: 0,
    rejectedWrites: 0,
    hostRequests: {},
  };

  await page.context().route("**/*", async (route) => {
    try {
      const response = await relayStagingRequest(route, ca, relayState);
      await route.fulfill({
        status: response.status,
        headers: {
          ...response.headers,
          ...(response.sessionCookie === undefined ? {} : { "set-cookie": response.sessionCookie }),
        },
        body: response.body,
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !new Set(["S2E16_RELAY_TARGET_REJECTED", "S2E16_UNEXPECTED_WRITE_REJECTED"]).has(
          error.message
        )
      ) {
        relayState.failures += 1;
      }
      await route.abort("failed");
    }
  });

  const tenantAOrigin = manifest.tenants.A.hosts.admin;
  const tenantBOrigin = manifest.tenants.B.hosts.admin;
  await page.goto(`${tenantAOrigin}/auth/login`, { waitUntil: "domcontentloaded" });
  await loginFinanceOnCurrentOrigin(page, identities.tenantAMobile, identities.otp);
  const tenantASnapshot = await readFinanceSnapshot(page, tenantAOrigin);

  await page.goto(`${tenantBOrigin}/auth/login`, { waitUntil: "domcontentloaded" });
  await loginFinanceOnCurrentOrigin(page, identities.tenantBMobile, identities.otp);
  const tenantBSnapshot = await readFinanceSnapshot(page, tenantBOrigin, true);

  expect(
    tenantBSnapshot.paymentIds.some((id) => tenantASnapshot.paymentIds.includes(id)),
    "S2E16_B_PAYMENTS_OVERLAP_A"
  ).toBe(false);
  expect(
    tenantBSnapshot.registrationIds.some((id) => tenantASnapshot.registrationIds.includes(id)),
    "S2E16_B_REGISTRATIONS_OVERLAP_A"
  ).toBe(false);
  expect(
    tenantBSnapshot.rowFingerprints.some((fingerprint) =>
      tenantASnapshot.rowFingerprints.includes(fingerprint)
    ),
    "S2E16_B_RENDERED_FINANCE_ROWS_OVERLAP_A"
  ).toBe(false);

  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(`${tenantAOrigin}/finance?tab=payments`);
  expect(await currentFinanceRowFingerprints(page), "S2E16_HISTORY_RESTORE_MISMATCH").toEqual(
    tenantASnapshot.rowFingerprints
  );

  const refreshResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.hostname === new URL(tenantAOrigin).hostname &&
      url.pathname === "/api/finance/payments"
    );
  });
  await page.locator('select[data-testid="finance-payments-status-filter"] + button').click();
  await expect(page.getByTestId("finance-payments-loading")).toBeVisible();
  const refreshedResponse = await refreshResponse;
  expect(refreshedResponse.status(), "S2E16_A_REFRESH_READ_FAILED").toBe(200);
  const refreshed = (await refreshedResponse.json()) as {
    items?: readonly { id?: unknown; registrationId?: unknown }[];
  };
  const refreshedPaymentIds = (refreshed.items ?? [])
    .map((item) => (typeof item.id === "string" ? item.id : ""))
    .filter(Boolean)
    .sort();
  const refreshedRegistrationIds = (refreshed.items ?? [])
    .map((item) => (typeof item.registrationId === "string" ? item.registrationId : ""))
    .filter(Boolean)
    .sort();
  expect(summarizeIds(refreshedPaymentIds), "S2E16_A_REFRESH_PAYMENT_SET_CHANGED").toBe(
    summarizeIds(tenantASnapshot.paymentIds)
  );
  expect(summarizeIds(refreshedRegistrationIds), "S2E16_A_REFRESH_REGISTRATION_SET_CHANGED").toBe(
    summarizeIds(tenantASnapshot.registrationIds)
  );
  await expect(page.getByTestId("finance-payments-loading")).toBeHidden();
  await expect
    .poll(async () => (await currentFinanceRowFingerprints(page)).join("\n"), {
      message: "S2E16_A_REFRESH_ROWS_NOT_RENDERED",
    })
    .toBe(tenantASnapshot.rowFingerprints.join("\n"));
  expect(await currentFinanceRowFingerprints(page), "S2E16_A_REFRESH_RENDER_MISMATCH").toEqual(
    tenantASnapshot.rowFingerprints
  );

  await testInfo.attach("s2-e16-safe-summary.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          runId: process.env.DENALI_TWO_TENANT_RUN_ID,
          runtimeSha: manifest.runtimeSha,
          testSha: process.env.DENALI_TWO_TENANT_TEST_SHA,
          tenants: {
            A: {
              tenantId: manifest.tenants.A.tenantId,
              paymentCount: tenantASnapshot.paymentIds.length,
            },
            B: {
              tenantId: manifest.tenants.B.tenantId,
              paymentCount: tenantBSnapshot.paymentIds.length,
            },
          },
          financeRowsDisjoint: true,
          relay: {
            caSha256: expectedCaSha256.toLowerCase(),
            requests: relayState.requests,
            failures: relayState.failures,
            blockedTargets: relayState.blockedTargets,
            rejectedWrites: relayState.rejectedWrites,
            hostRequests: relayState.hostRequests,
          },
        },
        null,
        2
      )
    ),
    contentType: "application/json",
  });

  expect(relayState.requests).toBeGreaterThan(0);
  expect(relayState.failures, "S2E16_RELAY_FAILURES").toBe(0);
  expect(relayState.blockedTargets, "S2E16_BLOCKED_TARGETS").toBe(0);
  expect(relayState.rejectedWrites, "S2E16_UNEXPECTED_WRITES").toBe(0);
  expect(relayState.hostRequests[new URL(tenantAOrigin).hostname]).toBeGreaterThan(0);
  expect(relayState.hostRequests[new URL(tenantBOrigin).hostname]).toBeGreaterThan(0);
});

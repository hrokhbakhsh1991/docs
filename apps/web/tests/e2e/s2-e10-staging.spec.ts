import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { resolve } from "node:path";
import { checkServerIdentity } from "node:tls";

import {
  fillDenaliMultiDayWizardThroughReview,
  submitDenaliWizardDraftCreate,
} from "../../test/fixtures/denali-itinerary-wizard-fixture";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import {
  expectTourListedAsActive,
  openFlatEditForTour,
  publishTourFromFlatEdit,
} from "../../test/fixtures/tour-creation-publication-fixture";
import { navigateOperatorToNewTour } from "../../test/fixtures/operator-tour-navigation-fixture";

const tenantId = "f0ed9e65-2638-4351-847d-724f87ebbfce";
const ownerUserId = "c51ad260-53cd-49c9-8d43-72fbc0129006";
const runId = process.env.DENALI_SECOND_STAGING_RUN_ID?.trim() ?? "";
const relayPort = Number(process.env.DENALI_SECOND_STAGING_RELAY_PORT ?? "0");
const caPath = process.env.DENALI_SECOND_STAGING_CADDY_ROOT_CA?.trim() ?? "";
const runtimeSha = process.env.DENALI_SECOND_STAGING_RUNTIME_SHA?.trim() ?? "";
const testSha = process.env.DENALI_SECOND_STAGING_TEST_SHA?.trim() ?? "";
const allowedHosts = new Set(["admin.qa2.staging.test", "qa2.staging.test"]);

type RelayState = { requests: number; tlsFailures: number };
type RelayedResponse = { status: number; headers: Record<string, string>; body: Buffer };
type ActionObservation = {
  path: string;
  status: number;
  contentType: string;
  bodyBytes: number;
  errorCodes: string[];
};

function safeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined || Array.isArray(value)) return undefined;
  return value;
}

async function fetchFromStaging(
  route: Route,
  ca: Buffer,
  relayState: RelayState
): Promise<RelayedResponse> {
  const request = route.request();
  const url = new URL(request.url());
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(url.hostname) ||
    (url.port !== "" && Number(url.port) !== relayPort)
  ) {
    throw new Error("S2E10_RELAY_TARGET_REJECTED");
  }

  const headers = { ...request.headers(), host: url.hostname };
  const originHeaderName = Object.keys(headers).find((name) => name.toLowerCase() === "origin");
  const origin = originHeaderName === undefined ? undefined : headers[originHeaderName];
  if (origin !== undefined) {
    const originUrl = new URL(origin);
    if (allowedHosts.has(originUrl.hostname) && Number(originUrl.port) === relayPort) {
      // 9443 belongs to the local tunnel; staging Caddy forwards the real HTTPS origin on 443.
      headers[originHeaderName!] = `${originUrl.protocol}//${originUrl.hostname}`;
    }
  } else if (!new Set(["GET", "HEAD", "OPTIONS"]).has(request.method())) {
    // Playwright omits some browser-managed headers from request.headers(); restore the real origin.
    headers.origin = `${url.protocol}//${url.hostname}`;
  }
  delete headers["accept-encoding"];
  delete headers["content-length"];
  delete headers.connection;
  const body = request.postDataBuffer();
  relayState.requests += 1;

  return new Promise<RelayedResponse>((resolveResponse, reject) => {
    const outgoing = httpsRequest(
      {
        hostname: "127.0.0.1",
        port: relayPort,
        path: `${url.pathname}${url.search}`,
        method: request.method(),
        headers,
        servername: url.hostname,
        ca,
        agent: false,
        rejectUnauthorized: true,
        timeout: 30_000,
        checkServerIdentity: (_serverName, certificate) =>
          checkServerIdentity(url.hostname, certificate),
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
              name === "content-length" ||
              name === "set-cookie"
            ) {
              continue;
            }
            const safeValue = safeHeaderValue(value);
            if (safeValue !== undefined) responseHeaders[name] = safeValue;
          }
          resolveResponse({
            status: incoming.statusCode ?? 502,
            headers: responseHeaders,
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    outgoing.on("timeout", () => {
      outgoing.destroy(new Error("S2E10_RELAY_REQUEST_TIMEOUT"));
    });
    outgoing.on("error", (error) => {
      reject(error);
    });
    if (body !== null) outgoing.write(body);
    outgoing.end();
  });
}

function installBrowserApiRequestBridge(page: Page): void {
  const api = page.request as APIRequestContext;
  const browserFetch = async (
    method: string,
    url: string,
    data?: unknown
  ): Promise<{
    ok: () => boolean;
    status: () => number;
    json: () => Promise<unknown>;
    text: () => Promise<string>;
    headers: () => Record<string, string>;
  }> => {
    const result = await page.evaluate(
      async ({ method, url, data }) => {
        const response = await fetch(url, {
          method,
          cache: "no-store",
          ...(data === undefined
            ? {}
            : {
                headers: { "content-type": "application/json" },
                body: JSON.stringify(data),
              }),
        });
        return { ok: response.ok, status: response.status, text: await response.text() };
      },
      { method, url, data }
    );
    return {
      ok: () => result.ok,
      status: () => result.status,
      json: async () => JSON.parse(result.text) as unknown,
      text: async () => result.text,
      headers: () => ({}),
    };
  };

  Object.defineProperty(api, "get", {
    configurable: true,
    value: (url: string) => browserFetch("GET", url),
  });
  Object.defineProperty(api, "post", {
    configurable: true,
    value: (url: string, options?: { data?: unknown }) => browserFetch("POST", url, options?.data),
  });
}

test("S2-E10 B wizard create, publish, refresh and catalog", async ({ page }, testInfo) => {
  const caFile = resolve(caPath);
  const ca = await readFile(caFile);
  const relayState: RelayState = { requests: 0, tlsFailures: 0 };
  const actionObservations: ActionObservation[] = [];
  const actionResponseReads: Promise<void>[] = [];
  const title = `S2-E10 ${runId}`;
  const manifestPath = testInfo.outputPath("s2-e10-wizard-tour-manifest.json");
  let tourId: string | null = null;
  let testStartedAt: string | null = null;

  const writeManifest = async (status: "draft" | "active") => {
    testStartedAt ??= new Date().toISOString();
    const manifest = Buffer.from(
      JSON.stringify(
        {
          manifestVersion: 1,
          source: "denali-second-staging-wizard-e10",
          runId,
          tenantId,
          ownerUserId,
          runtimeSha,
          testSha,
          title,
          testStartedAt,
          tourId,
          status,
        },
        null,
        2
      )
    );
    await writeFile(manifestPath, manifest, { mode: 0o600 });
    await testInfo.attach("s2-e10-wizard-tour-manifest", {
      body: manifest,
      contentType: "application/json",
    });
  };

  await testInfo.attach("s2-e10-relay-ca-sha256", {
    body: Buffer.from(createHash("sha256").update(ca).digest("hex")),
    contentType: "text/plain",
  });
  await page.context().route("https://**/*", async (route) => {
    try {
      const response = await fetchFromStaging(route, ca, relayState);
      await route.fulfill(response);
    } catch {
      relayState.tlsFailures += 1;
      await route.abort("failed");
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    if (request.method() !== "POST") return;
    const url = new URL(response.url());
    if (
      url.hostname !== "admin.qa2.staging.test" ||
      url.pathname.startsWith("/api/") ||
      url.pathname.includes("/drafts/")
    ) {
      return;
    }
    actionResponseReads.push(
      response
        .body()
        .then((body) => {
          const text = body.toString("utf8");
          actionObservations.push({
            path: url.pathname,
            status: response.status(),
            contentType: response.headers()["content-type"] ?? "",
            bodyBytes: body.byteLength,
            errorCodes: [
              ...new Set(
                text.match(
                  /\b(?:AUTH_[A-Z_]+|DENALI_[A-Z_]+|TOUR_[A-Z_]+|VALIDATION_[A-Z_]+|INTERNAL_SERVER_ERROR|unknown_error)\b/g
                ) ?? []
              ),
            ],
          });
        })
        .catch(() => {
          actionObservations.push({
            path: url.pathname,
            status: response.status(),
            contentType: response.headers()["content-type"] ?? "",
            bodyBytes: -1,
            errorCodes: ["S2E10_ACTION_RESPONSE_BODY_UNAVAILABLE"],
          });
        })
    );
  });
  installBrowserApiRequestBridge(page);

  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await loginOperatorOwner(page);

  const templateResponse = await page.request.get("/api/settings/tour-wizard-template");
  expect(
    templateResponse.ok(),
    `wizard template request failed with HTTP ${templateResponse.status()}`
  ).toBeTruthy();
  const template = (await templateResponse.json()) as {
    source?: string;
    payload?: { published?: boolean; steps?: readonly unknown[] };
  };
  expect(template.source).toBe("tenant");
  expect(template.payload?.published).toBe(true);
  expect(template.payload?.steps?.length).toBeGreaterThanOrEqual(6);

  const duplicateCheck = await page.request.get(
    `/api/tours?view=operator&search=${encodeURIComponent(title)}`
  );
  expect(
    duplicateCheck.ok(),
    `unique-title preflight failed with HTTP ${duplicateCheck.status()}`
  ).toBeTruthy();
  const duplicatePayload = (await duplicateCheck.json()) as {
    items?: readonly { title?: string }[];
  };
  expect(Array.isArray(duplicatePayload.items)).toBe(true);
  expect(duplicatePayload.items?.some((tour) => tour.title === title)).toBe(false);

  // Capture recovery bounds before the wizard can autosave any draft state.
  await writeManifest("draft");
  await navigateOperatorToNewTour(page);
  await fillDenaliMultiDayWizardThroughReview(
    page,
    title,
    undefined,
    { paymentCollection: "free", registrationApproval: "auto" },
    3
  );
  // Refresh the manifest with the latest timestamp before the create request can mutate staging.
  await writeManifest("draft");
  try {
    tourId = await submitDenaliWizardDraftCreate(page, title);
  } catch (error) {
    await Promise.allSettled(actionResponseReads);
    const actionSummary = Buffer.from(JSON.stringify(actionObservations, null, 2));
    await writeFile(testInfo.outputPath("s2-e10-create-action-summary.json"), actionSummary, {
      mode: 0o600,
    });
    await testInfo.attach("s2-e10-create-action-summary", {
      body: actionSummary,
      contentType: "application/json",
    });
    throw error;
  }
  await writeManifest("draft");

  await openFlatEditForTour(page, tourId);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();

  await publishTourFromFlatEdit(page, tourId);
  await writeManifest("active");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-tour-status="active"]')).toBeVisible({ timeout: 30_000 });
  await expectTourListedAsActive(page, title);

  const catalogPage = await page.context().newPage();
  await catalogPage.goto("https://qa2.staging.test:9443/tours", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(catalogPage.locator("[data-marketing-catalog]")).toBeVisible();
  await expect(catalogPage.getByRole("heading", { name: title, exact: true })).toBeVisible({
    timeout: 30_000,
  });

  expect(relayState.requests).toBeGreaterThan(0);
  expect(relayState.tlsFailures).toBe(0);
  await writeManifest("active");
  await testInfo.attach("s2-e10-relay-summary", {
    body: Buffer.from(JSON.stringify({ strictTlsRequests: relayState.requests, tlsFailures: 0 })),
    contentType: "application/json",
  });
  await Promise.allSettled(actionResponseReads);
  const actionSummary = Buffer.from(JSON.stringify(actionObservations, null, 2));
  await writeFile(testInfo.outputPath("s2-e10-create-action-summary.json"), actionSummary, {
    mode: 0o600,
  });
  await testInfo.attach("s2-e10-create-action-summary", {
    body: actionSummary,
    contentType: "application/json",
  });
  expect(manifestPath.length).toBeGreaterThan(0);
});

test("S2-E10 existing created tour list and refresh", async ({ page }) => {
  const tourId = process.env.DENALI_SECOND_STAGING_EXISTING_TOUR_ID?.trim() ?? "";
  test.skip(
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tourId),
    "set DENALI_SECOND_STAGING_EXISTING_TOUR_ID to run the existing-tour readback check"
  );

  const ca = await readFile(resolve(caPath));
  const relayState: RelayState = { requests: 0, tlsFailures: 0 };
  await page.context().route("https://**/*", async (route) => {
    try {
      const response = await fetchFromStaging(route, ca, relayState);
      await route.fulfill(response);
    } catch {
      relayState.tlsFailures += 1;
      await route.abort("failed");
    }
  });
  installBrowserApiRequestBridge(page);

  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await loginOperatorOwner(page);
  const search = page.getByTestId("operator-tours-search");
  await page.goto("/tours", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(search).toBeVisible({ timeout: 60_000 });
  await search.fill(`S2-E10 ${runId}`);
  const tourRow = page.getByRole("row").filter({ hasText: `S2-E10 ${runId}` });
  const tourCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: `S2-E10 ${runId}`, exact: true }),
  });
  await expect(tourRow.or(tourCard).first()).toBeVisible({ timeout: 30_000 });

  await page.goto(`/tours?created=${encodeURIComponent(tourId)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(search).toBeVisible({ timeout: 60_000 });
  await search.fill(`S2-E10 ${runId}`);
  await expect(tourRow.or(tourCard).first()).toBeVisible({ timeout: 30_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(search).toBeVisible({ timeout: 60_000 });
  await search.fill(`S2-E10 ${runId}`);
  await expect(tourRow.or(tourCard).first()).toBeVisible({ timeout: 30_000 });
  expect(relayState.requests).toBeGreaterThan(0);
  expect(relayState.tlsFailures).toBe(0);
});

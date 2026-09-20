/**
 * Tour creation closure — cross-surface helpers (operator + marketing + portal + isolation).
 */
import { expect, type Page } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import { buildTourTitlePatch } from "../../src/features/tours/build-tour-title-patch";
import { TOUR_EDIT_TEST_IDS } from "../../src/features/tours/operator-tour-detail-types";
import { SESSION_TOKEN_COOKIE } from "../../src/auth/build-session-cookie";
import { OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M } from "./denali-itinerary-wizard-fixture";
import {
  createDenaliMultiDayDraftTour,
  expectTourInDenaliCatalog,
  fetchDenaliTourCanonicalData,
  prepareDenaliTourWizard,
  publishTourFromFlatEdit,
} from "./tour-creation-publication-fixture";
import {
  loginOperatorOwner,
  loginOperatorViewer,
  OPERATOR_OWNER_MOBILE,
  OPERATOR_SMOKE_TENANT_ID,
} from "./operator-owner-session";

export const MARKETING_OPERATOR_BASE_URL =
  process.env.SMOKE_MARKETING_OPERATOR_BASE_URL ?? "http://operator.localhost:3002";
export const PORTAL_OPERATOR_BASE_URL =
  process.env.SMOKE_PORTAL_OPERATOR_BASE_URL ?? "http://operator.portal.localhost:3003";
export const DENALI_ADMIN_BASE_URL =
  process.env.SMOKE_DENALI_ADMIN_BASE_URL ?? "http://denali.admin.localhost:3000";
export const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const OPERATOR_SMOKE_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";
const DENALI_SMOKE_WORKSPACE_ID = "ws-denali-dev";
const OPERATOR_SMOKE_WORKSPACE_ID = "ws-operator-smoke";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

function marketingHost(): string {
  return new URL(MARKETING_OPERATOR_BASE_URL).host;
}

function portalHost(): string {
  return new URL(PORTAL_OPERATOR_BASE_URL).host;
}

function denaliAdminHost(): string {
  return new URL(DENALI_ADMIN_BASE_URL).host;
}

function operatorAdminHost(page: Page): string {
  const context = page.context() as {
    readonly _options?: { readonly baseURL?: string };
  };
  const baseURL = context._options?.baseURL?.trim();
  if (typeof baseURL === "string" && baseURL.length > 0) {
    return new URL(baseURL).host;
  }
  return "admin.operator.localhost:3000";
}

export async function setOperatorLocale(page: Page, locale: "en" | "fa"): Promise<void> {
  await page.context().addCookies([
    {
      name: LOCALE_COOKIE_NAME,
      value: locale,
      domain: operatorAdminHost(page).split(":")[0]!,
      path: "/",
    },
  ]);
}

export type PublishedTourClosureContext = {
  readonly tourId: string;
  readonly title: string;
  readonly canonical: Record<string, unknown>;
};

export async function publishTourForClosure(
  page: Page,
  title: string
): Promise<PublishedTourClosureContext> {
  await prepareDenaliTourWizard(page);
  const tourId = await createDenaliMultiDayDraftTour(page, title);
  const canonical = await fetchDenaliTourCanonicalData(page, tourId);
  await publishTourFromFlatEdit(page, tourId);
  await expectTourInDenaliCatalog(page, title);
  return { tourId, title, canonical };
}

export type MarketingCatalogTourPayload = {
  readonly id?: string;
  readonly title?: string | null;
  readonly category?: string | null;
  readonly totalCapacity?: number | null;
  readonly peakHeightMeters?: number | null;
  readonly itineraryDays?: readonly { readonly dayNumber: number }[];
  readonly priceAmount?: number | null;
  readonly publishStatus?: string | null;
};

export async function fetchMarketingCatalogTour(
  page: Page,
  tourId: string
): Promise<MarketingCatalogTourPayload> {
  const response = await page.request.get(
    `${MARKETING_OPERATOR_BASE_URL}/api/catalog/${encodeURIComponent(tourId)}`,
    { headers: { host: marketingHost() } }
  );
  expect(
    response.ok(),
    `marketing catalog detail failed: ${response.status()} ${await response.text()}`
  ).toBeTruthy();
  const body = (await response.json()) as { data?: MarketingCatalogTourPayload };
  return body.data ?? {};
}

export async function fetchMarketingCatalogListItem(
  page: Page,
  tourId: string
): Promise<MarketingCatalogTourPayload | undefined> {
  const response = await page.request.get(`${MARKETING_OPERATOR_BASE_URL}/api/catalog`, {
    headers: { host: marketingHost() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as {
    data?: { items?: readonly MarketingCatalogTourPayload[] };
  };
  return body.data?.items?.find((item) => item.id === tourId);
}

export async function openMarketingTourDetail(
  page: Page,
  tourId: string,
  title: string
): Promise<void> {
  await page.goto(`${MARKETING_OPERATOR_BASE_URL}/tours/${encodeURIComponent(tourId)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

export function readCanonicalPeakHeight(canonical: Record<string, unknown>): number | undefined {
  const tripDetails = canonical.tripDetails as { overview?: { peakHeight?: number } } | undefined;
  return tripDetails?.overview?.peakHeight;
}

export function readCanonicalItineraryDayCount(canonical: Record<string, unknown>): number {
  const program = canonical.program as { itinerary?: unknown[] } | undefined;
  return Array.isArray(program?.itinerary) ? program.itinerary.length : 0;
}

export function readCanonicalBasePriceMinor(canonical: Record<string, unknown>): number | null {
  const pricing = canonical.pricing as { basePricePerPerson?: number } | undefined;
  return typeof pricing?.basePricePerPerson === "number" ? pricing.basePricePerPerson : null;
}

export async function completePortalRegistrationForTour(
  page: Page,
  tourId: string,
  input: { readonly phone: string; readonly fullName: string }
): Promise<void> {
  await page.goto(
    `${PORTAL_OPERATOR_BASE_URL}/catalog/${encodeURIComponent(tourId)}/register`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator(
      "dialog[open][data-portal-login-modal-open='true'] [data-public-registration-phone][data-registration-ready], [data-public-registration-intake][data-registration-ready]"
    )
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });

  const phoneStep = page.locator("[data-public-registration-phone][data-registration-ready]");
  if (await phoneStep.isVisible().catch(() => false)) {
    await requestRegistrationOtp(page, input.phone);
    await fillCatalogOtp(page, "1234");
  }

  await completeCatalogRegistrationIntake(page, {
    fullName: input.fullName,
    partySize: "2",
    phone: input.phone,
    registrantTarget: "self",
  });
  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 90_000,
  });
}

export async function fetchOperatorTourDetail(
  page: Page,
  tourId: string
): Promise<{ readonly projection?: { readonly title?: string }; readonly rowVersion?: number }> {
  const response = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as {
    projection?: { title?: string };
    rowVersion?: number;
  };
}

export async function assertViewerCannotMutateTour(
  page: Page,
  tourId: string,
  originalTitle: string
): Promise<void> {
  await loginOperatorViewer(page);
  await page.goto(`/tours/${encodeURIComponent(tourId)}/edit`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.title)).toBeDisabled();
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.save)).toHaveCount(0);
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.lifecycleMenu)).toHaveCount(0);

  const detailRes = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
  expect(detailRes.ok()).toBeTruthy();
  const detail = (await detailRes.json()) as Parameters<typeof buildTourTitlePatch>[0];
  const patchRes = await page.request.patch(`/api/tours/${encodeURIComponent(tourId)}`, {
    data: buildTourTitlePatch(detail, `${originalTitle} Viewer Hack`),
  });
  expect(
    patchRes.status(),
    `viewer PATCH must be rejected; body=${await patchRes.text()}`
  ).toBe(403);

  const after = await fetchOperatorTourDetail(page, tourId);
  expect(after.projection?.title).toBe(originalTitle);
}

async function loginOperatorOwnerOnHost(
  page: Page,
  baseUrl: string,
  host: string
): Promise<void> {
  await page.context().clearCookies();
  const otpRes = await page.request.post(`${baseUrl}/api/auth/request-otp`, {
    headers: { host },
    data: { phone: OPERATOR_OWNER_MOBILE },
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  const loginRes = await page.request.post(`${baseUrl}/api/auth/login-web-session`, {
    headers: { host },
    data: {
      phone: OPERATOR_OWNER_MOBILE,
      otp: "1234",
      challenge_id: otpBody.challenge_id,
    },
  });
  expect(loginRes.ok(), await loginRes.text()).toBeTruthy();
  const loginBody = (await loginRes.json()) as { session_token?: string };
  await page.context().addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: loginBody.session_token!,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function assertDenaliTenantCannotAccessOperatorTour(
  page: Page,
  tourId: string,
  originalTitle: string
): Promise<void> {
  await loginOperatorOwnerOnHost(page, DENALI_ADMIN_BASE_URL, denaliAdminHost());

  const bffGet = await page.request.get(
    `${DENALI_ADMIN_BASE_URL}/api/tours/${encodeURIComponent(tourId)}`,
    { headers: { host: denaliAdminHost() } }
  );
  expect([403, 404]).toContain(bffGet.status());

  const bffPatch = await page.request.patch(
    `${DENALI_ADMIN_BASE_URL}/api/tours/${encodeURIComponent(tourId)}`,
    {
      headers: { host: denaliAdminHost(), "content-type": "application/json" },
      data: { rowVersion: 1, data: { title: `${originalTitle} Cross Tenant` } },
    }
  );
  expect([403, 404]).toContain(bffPatch.status());

  const apiGetWrongTenant = await page.request.get(
    `${tourOpsApiBase()}/tours/${encodeURIComponent(tourId)}`,
    {
      headers: {
        "x-tenant-id": DENALI_SMOKE_TENANT_ID,
        "x-authenticated-tenant-id": DENALI_SMOKE_TENANT_ID,
        "x-user-id": OPERATOR_SMOKE_OWNER_USER_ID,
        "x-actor-role": "owner",
        "x-membership-status": "ACTIVE",
        "x-workspace-id": DENALI_SMOKE_WORKSPACE_ID,
      },
    }
  );
  expect([403, 404]).toContain(apiGetWrongTenant.status());

  const apiGetOwnerTenant = await page.request.get(
    `${tourOpsApiBase()}/tours/${encodeURIComponent(tourId)}`,
    {
      headers: {
        "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
        "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
        "x-user-id": OPERATOR_SMOKE_OWNER_USER_ID,
        "x-actor-role": "owner",
        "x-membership-status": "ACTIVE",
        "x-workspace-id": OPERATOR_SMOKE_WORKSPACE_ID,
      },
    }
  );
  expect(apiGetOwnerTenant.ok()).toBeTruthy();
  const ownerBody = (await apiGetOwnerTenant.json()) as { projection?: { title?: string } };
  expect(ownerBody.projection?.title).toBe(originalTitle);
}

export async function assertNoTourExportControls(page: Page, tourId: string): Promise<void> {
  await loginOperatorOwner(page);
  await page.goto(`/tours/${encodeURIComponent(tourId)}/edit`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /excel|xlsx|pdf|export/i })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /excel|xlsx|pdf|export/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /excel|xlsx|pdf|export/i })).toHaveCount(0);
}

export function expectedMarketingPeakHeight(canonical: Record<string, unknown>): number {
  return readCanonicalPeakHeight(canonical) ?? OPERATOR_SMOKE_DESTINATION_LOCKED_PEAK_HEIGHT_M;
}

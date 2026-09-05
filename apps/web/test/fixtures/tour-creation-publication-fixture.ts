/**
 * Tour creation + publication journey helpers (Denali operator).
 */
import { expect, type Page } from "@playwright/test";

import { TOUR_EDIT_TEST_IDS } from "../../src/features/tours/operator-tour-detail-types";
import { TOURS_LIST_TEST_IDS } from "../../src/features/tours/query-model";
import {
  fillDenaliMultiDayWizardThroughReview,
  resetOperatorWizardToBasic,
  submitDenaliWizardDraftCreate,
} from "./denali-itinerary-wizard-fixture";
import { navigateOperatorToNewTour } from "./operator-tour-navigation-fixture";
import { loginOperatorOwner } from "./operator-owner-session";
import { publishOperatorWizardTemplate } from "./operator-wizard-template-fixture";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";

function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

export async function prepareDenaliTourWizard(page: Page): Promise<void> {
  await loginOperatorOwner(page);
  await publishOperatorWizardTemplate(page, { fullTemplate: true });
  await navigateOperatorToNewTour(page);
  await resetOperatorWizardToBasic(page);
}

export async function createDenaliMultiDayDraftTour(
  page: Page,
  title: string
): Promise<string> {
  await fillDenaliMultiDayWizardThroughReview(page, title);
  return submitDenaliWizardDraftCreate(page);
}

export async function openFlatEditForTour(page: Page, tourId: string): Promise<void> {
  await page.goto(`/tours/${encodeURIComponent(tourId)}/edit`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.stickyActions)).toBeVisible({
    timeout: 60_000,
  });
  const draftIndicator = page.getByTestId("draft-sync-indicator");
  if (await draftIndicator.isVisible().catch(() => false)) {
    await expect
      .poll(() => draftIndicator.getAttribute("data-status"), { timeout: 60_000 })
      .toMatch(/^(?:IDLE|SAVED)$/);
  }
}

export async function publishTourFromFlatEdit(page: Page, tourId: string): Promise<void> {
  await openFlatEditForTour(page, tourId);

  await page.getByTestId(TOUR_EDIT_TEST_IDS.lifecycleMenu).click();
  await page
    .getByRole("menuitem", { name: /انتشار تور|Publish tour/i })
    .click();

  const validationList = page.getByTestId("denali-flat-edit-validation-list");

  await expect
    .poll(
      async () => {
        if (await validationList.isVisible().catch(() => false)) {
          return `blocked:${await validationList.innerText()}`;
        }
        const res = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
        if (!res.ok()) {
          return "pending";
        }
        const body = (await res.json()) as { projection?: { uiStatus?: string } };
        return body.projection?.uiStatus ?? "pending";
      },
      { timeout: 90_000 }
    )
    .toBe("active")
    .catch(async (error) => {
      if (await validationList.isVisible().catch(() => false)) {
        throw new Error(`Publish validation blocked: ${await validationList.innerText()}`);
      }
      throw error;
    });

  await expect(
    page.getByText(/Tour published to catalog\.|تور در کاتالوگ منتشر شد\./i)
  ).toBeVisible({ timeout: 20_000 });
}

export async function expectTourListedAsActive(
  page: Page,
  tourTitle: string
): Promise<void> {
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(TOURS_LIST_TEST_IDS.page)).toBeVisible({ timeout: 15_000 });
  const tourCard = page.locator('[data-operator-surface="card"]').filter({
    has: page.getByRole("heading", { name: tourTitle, exact: true }),
  });
  await expect(tourCard).toBeVisible({ timeout: 15_000 });
  await expect(tourCard.locator('[data-tour-status="active"]')).toBeVisible({ timeout: 15_000 });
}

export async function expectTourInDenaliCatalog(
  page: Page,
  tourTitle: string
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`${tourOpsApiBase()}/denali/catalog`, {
          headers: { "x-tenant-id": OPERATOR_SMOKE_TENANT_ID },
        });
        if (!res.ok()) {
          return [];
        }
        const body = (await res.json()) as {
          data?: { items?: readonly { title?: string }[] };
        };
        return (body.data?.items ?? [])
          .map((item) => item.title?.trim() ?? "")
          .filter((title) => title.length > 0);
      },
      { timeout: 30_000 }
    )
    .toContain(tourTitle);
}

export async function fetchDenaliTourCanonicalData(
  page: Page,
  tourId: string
): Promise<Record<string, unknown>> {
  const response = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
  expect(
    response.ok(),
    `GET /api/tours/${tourId} failed: ${response.status()} ${await response.text()}`
  ).toBeTruthy();
  const body = (await response.json()) as {
    canonical?: { data?: Record<string, unknown> };
  };
  return body.canonical?.data ?? {};
}

export async function expectDraftCanonicalFieldsPersisted(
  page: Page,
  tourId: string,
  expected: {
    readonly title: string;
    readonly category?: string;
    readonly capacityMax?: number;
    readonly peakHeight?: number;
    readonly itineraryDayCount?: number;
  }
): Promise<void> {
  const data = await fetchDenaliTourCanonicalData(page, tourId);
  expect(data.title).toBe(expected.title);
  if (expected.category !== undefined) {
    expect(data.category).toBe(expected.category);
  }
  if (expected.capacityMax !== undefined) {
    expect(data.capacityMax).toBe(expected.capacityMax);
  }
  if (expected.peakHeight !== undefined) {
    const tripDetails = data.tripDetails as { overview?: { peakHeight?: number } } | undefined;
    expect(tripDetails?.overview?.peakHeight).toBe(expected.peakHeight);
  }
  if (expected.itineraryDayCount !== undefined) {
    const program = data.program as { itinerary?: unknown[] } | undefined;
    expect(Array.isArray(program?.itinerary) ? program.itinerary.length : 0).toBe(
      expected.itineraryDayCount
    );
  }
}

export async function expectFlatEditShowsTitle(page: Page, title: string): Promise<void> {
  const titleField = page.getByRole("textbox", { name: /نام تور|^title$/i }).first();
  await expect(titleField).toBeVisible({ timeout: 30_000 });
  await expect(titleField).toHaveValue(title);
}

export async function runTourCreationPublicationJourney(
  page: Page,
  title: string
): Promise<string> {
  await prepareDenaliTourWizard(page);
  const tourId = await createDenaliMultiDayDraftTour(page, title);
  await publishTourFromFlatEdit(page, tourId);
  await expectTourListedAsActive(page, title);
  await expectTourInDenaliCatalog(page, title);
  return tourId;
}

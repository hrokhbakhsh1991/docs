/**
 * P15-W-D2 — fill required urban wizard fields for create smoke.
 */
import { expect, type Page } from "@playwright/test";

export async function waitForDraftSyncIdle(page: Page): Promise<void> {
  const busy = page.locator(
    '[data-testid="draft-sync-indicator"][data-status="SYNCING"], [data-testid="draft-sync-indicator"][data-status="CONFLICT_RESOLVING"]'
  );
  await expect(busy).toHaveCount(0, { timeout: 60_000 });
}

async function flushDraftIfDirty(page: Page): Promise<void> {
  await page.waitForTimeout(400);
  const save = page.getByTestId("wizard-save-draft");
  if ((await save.getAttribute("data-draft-sync-action")) === "flush" && (await save.isEnabled())) {
    await save.click();
  }
  await waitForDraftSyncIdle(page);
}

function wizardField(page: Page, canonicalPath: string) {
  return page.locator(`[data-field-path="${canonicalPath}"]`);
}

async function fillWizardText(page: Page, canonicalPath: string, value: string): Promise<void> {
  const input = wizardField(page, canonicalPath).locator("input, textarea").first();
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.fill(value);
  await input.blur();
}

async function fillWizardNumber(page: Page, canonicalPath: string, value: string): Promise<void> {
  const input = wizardField(page, canonicalPath).locator("input").first();
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.fill(value);
  await input.blur();
}

async function pickWizardDate(page: Page, canonicalPath: string, isoDate: string): Promise<void> {
  const picker = wizardField(page, canonicalPath)
    .locator("[data-wizard-date-picker] [data-operator-date-picker], [data-wizard-date-picker] button")
    .first();
  await picker.waitFor({ state: "visible", timeout: 30_000 });
  await picker.click();
  const calendar = page.locator('[data-testid="localized-calendar"]');
  await calendar.waitFor({ state: "visible", timeout: 10_000 });

  const dayBtn = calendar.getByRole("button", { name: isoDate, exact: true });
  for (let attempt = 0; attempt < 24 && !(await dayBtn.isVisible().catch(() => false)); attempt++) {
    await calendar.getByLabel(/next month|ماه بعد/i).click();
  }
  await dayBtn.click();
}

async function selectWizardEnum(page: Page, canonicalPath: string, value: string): Promise<void> {
  const select = wizardField(page, canonicalPath).locator("select").first();
  await select.waitFor({ state: "visible", timeout: 30_000 });
  await select.selectOption(value);
}

export type FillUrbanWizardTourDetailsOptions = {
  readonly title: string;
  readonly city?: string;
  readonly venueName?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly capacity?: string;
  readonly status?: string;
};

/** Fill step-1 required fields from {@link URBAN_FIELD_REGISTRY}. */
export async function fillUrbanWizardTourDetails(
  page: Page,
  options: FillUrbanWizardTourDetailsOptions
): Promise<void> {
  await fillWizardText(page, "tour.title", options.title);
  await fillWizardText(page, "tour.city", options.city ?? "Berlin");
  await fillWizardText(page, "tour.venueName", options.venueName ?? "Alexanderplatz");
  await pickWizardDate(page, "tour.startDate", options.startDate ?? "2026-07-01");
  await pickWizardDate(page, "tour.endDate", options.endDate ?? "2026-07-02");
  await fillWizardNumber(page, "tour.capacity", options.capacity ?? "120");
  await selectWizardEnum(page, "tour.status", options.status ?? "draft");
  await flushDraftIfDirty(page);
}

/** Review step — publishStatus is required on urban minimal template. */
export async function fillUrbanWizardReviewPublishStatus(
  page: Page,
  publishStatus: string = "draft"
): Promise<void> {
  await selectWizardEnum(page, "tour.publishStatus", publishStatus);
  await flushDraftIfDirty(page);
}

export async function clickWizardContinue(page: Page): Promise<void> {
  await waitForDraftSyncIdle(page);
  const btn = page.getByTestId("workspace-wizard-step-next");
  await expect(btn).toBeEnabled({ timeout: 15_000 });
  await btn.click();
  await expect(page.locator('[data-wizard-step="review"]')).toBeVisible({ timeout: 15_000 });
}

export async function submitUrbanWizardCreate(page: Page): Promise<void> {
  await waitForDraftSyncIdle(page);
  const createBtn = page.locator("[data-wizard-footer] button");
  await expect(createBtn).toBeVisible({ timeout: 15_000 });
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/tours", { timeout: 90_000 }),
    createBtn.click(),
  ]);
}

/** Operator list projection may show Untitled — assert canonical tour.title via BFF. */
export async function expectUrbanTourCanonicalTitle(
  page: Page,
  tourTitle: string
): Promise<void> {
  const listRes = await page.request.get(
    "/api/tours?limit=20&sortBy=created_at&sortDir=desc&view=operator"
  );
  expect(listRes.ok()).toBeTruthy();
  const listBody = (await listRes.json()) as { items?: readonly { id?: string }[] };
  for (const item of listBody.items ?? []) {
    if (typeof item.id !== "string") {
      continue;
    }
    const detailRes = await page.request.get(`/api/tours/${encodeURIComponent(item.id)}`);
    if (!detailRes.ok()) {
      continue;
    }
    const detail = (await detailRes.json()) as {
      canonical?: { data?: { tour?: { title?: string } } };
    };
    if (detail.canonical?.data?.tour?.title === tourTitle) {
      return;
    }
  }
  throw new Error(`Urban tour with canonical title "${tourTitle}" was not found`);
}

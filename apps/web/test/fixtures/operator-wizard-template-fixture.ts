/**
 * Phase 9.8 — operator wizard template publish helper (SMK-P9-02/05)
 */
import { buildDenaliFullWizardTemplatePayload } from "@app-tour/workspace-denali";
import { expect, type Page } from "@playwright/test";

import {
  buildWizardTemplatePutBody,
  parseWizardTemplateResponse,
} from "../../src/features/settings/wizard-template-logic";
import { WIZARD_TEMPLATE_TEST_IDS } from "../../src/features/settings/wizard-template-types";
import { WIZARD_TEMPLATE_CATALOG_TEST_IDS } from "../../src/tours/wizard-template-catalog-logic";

type PublishOperatorWizardTemplateOptions = {
  readonly seedLabel?: string;
  /** Denali default — starter smoke bridge uses `title` in UI catalog for tenant 014. */
  readonly titleCanonicalPath?: string;
  /** Load Denali full template (all steps including program.itinerary) before publish. */
  readonly fullTemplate?: boolean;
};

function hasPublishedProgramItinerary(
  payload: ReturnType<typeof parseWizardTemplateResponse>
): boolean {
  if (payload.published !== true) {
    return false;
  }
  return payload.steps.some(
    (step) =>
      step.stepId === "denali_program" &&
      step.fields.some((field) => field.canonicalPath.includes("itinerary"))
  );
}

async function publishFullDenaliWizardTemplateViaApi(
  page: Page,
  seedLabel?: string
): Promise<void> {
  const getRes = await page.request.get("/api/settings/tour-wizard-template");
  if (getRes.ok()) {
    const existing = parseWizardTemplateResponse((await getRes.json()) as never);
    if (hasPublishedProgramItinerary(existing)) {
      return;
    }
  }

  const payload = buildDenaliFullWizardTemplatePayload(
    seedLabel !== undefined && seedLabel.length > 0 ? seedLabel : undefined
  );
  const putRes = await page.request.put("/api/settings/tour-wizard-template", {
    data: buildWizardTemplatePutBody(payload),
  });
  if (putRes.ok()) {
    return;
  }

  // OPERATOR_SMOKE_E2E_SEED bootstraps a published full template on API warm-up.
}

export async function publishOperatorWizardTemplate(
  page: Page,
  options: PublishOperatorWizardTemplateOptions = {}
): Promise<void> {
  if (options.fullTemplate === true) {
    await publishFullDenaliWizardTemplateViaApi(page, options.seedLabel);
    return;
  }

  const titlePath = options.titleCanonicalPath ?? "title";

  await page.goto("/settings/tour-wizard-template");
  await expect(page.getByTestId(WIZARD_TEMPLATE_TEST_IDS.page)).toBeVisible({
    timeout: 15_000,
  });

  if (options.seedLabel !== undefined && options.seedLabel.length > 0) {
    await page.getByTestId(WIZARD_TEMPLATE_TEST_IDS.seedInput).fill(options.seedLabel);
  }

  const titleToggle = page.locator(
    `[data-testid="${WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldToggle}"][data-canonical-path="${titlePath}"]`
  );
  if ((await titleToggle.count()) > 0) {
    await titleToggle.check();
  }

  await page.getByTestId(WIZARD_TEMPLATE_TEST_IDS.publishToggle).check();
  await page.getByTestId(WIZARD_TEMPLATE_TEST_IDS.saveButton).click();
  await expect(page.getByTestId(WIZARD_TEMPLATE_TEST_IDS.success)).toBeVisible({
    timeout: 15_000,
  });
}

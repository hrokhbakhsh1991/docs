/**
 * Phase 9.8 — operator wizard template publish helper (SMK-P9-02/05)
 */
import { expect, type Page } from "@playwright/test";

import { WIZARD_TEMPLATE_TEST_IDS } from "../../src/features/settings/wizard-template-types";
import { WIZARD_TEMPLATE_CATALOG_TEST_IDS } from "../../src/tours/wizard-template-catalog-logic";

type PublishOperatorWizardTemplateOptions = {
  readonly seedLabel?: string;
  /** Denali default — starter smoke bridge uses `title` in UI catalog for tenant 014. */
  readonly titleCanonicalPath?: string;
  /** Load Denali full template (all steps including program.itinerary) before publish. */
  readonly fullTemplate?: boolean;
};

export async function publishOperatorWizardTemplate(
  page: Page,
  options: PublishOperatorWizardTemplateOptions = {}
): Promise<void> {
  const titlePath = options.titleCanonicalPath ?? "title";

  await page.goto("/settings/tour-wizard-template");
  await expect(page.getByTestId(WIZARD_TEMPLATE_TEST_IDS.page)).toBeVisible({
    timeout: 15_000,
  });

  if (options.fullTemplate === true) {
    await page.getByTestId(WIZARD_TEMPLATE_TEST_IDS.loadFullTemplateButton).click();
  }

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

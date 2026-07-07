/**
 * P15-W-D1 — urban wizard template publish helper (Playwright E2E prep)
 */
import type { Page } from "@playwright/test";

import { publishOperatorWizardTemplate } from "./operator-wizard-template-fixture";

export const URBAN_WIZARD_TEMPLATE_SETTINGS_PATH = "/settings/tour-wizard-template" as const;
export const URBAN_WIZARD_TITLE_CANONICAL_PATH = "tour.title" as const;

type PublishUrbanWizardTemplateOptions = {
  readonly seedLabel?: string;
};

/** Publish minimal urban create template (title required + publish toggle). */
export async function publishUrbanWizardTemplate(
  page: Page,
  options: PublishUrbanWizardTemplateOptions = {}
): Promise<void> {
  await publishOperatorWizardTemplate(page, {
    titleCanonicalPath: URBAN_WIZARD_TITLE_CANONICAL_PATH,
    ...options,
  });
}

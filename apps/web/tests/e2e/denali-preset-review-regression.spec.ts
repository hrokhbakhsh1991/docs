/**
 * Denali preset/review regressions — browser-level proof for template/preset/review wiring.
 */
import { expect, test } from "@playwright/test";

import { DENALI_REVIEW_STEP_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-review-test-ids";

import {
  clearOperatorWizardDraftIfPresent,
  fillDenaliMultiDayWizardThroughReview,
  OPERATOR_SMOKE_DESTINATION_LABEL,
} from "../../test/fixtures/denali-itinerary-wizard-fixture";
import {
  loginOperatorOwner,
  resolveOperatorWorkspaceId,
} from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";

test.describe("denali-preset-review-regression.spec.ts", () => {
  test.setTimeout(300_000);

  test("SMK-DENALI-PRESET-01 preset title overrides template seed in browser", async ({
    page,
  }) => {
    const templateSeed = `Template Seed ${Date.now()}`;
    const presetName = `Preset ${Date.now()}`;

    await loginOperatorOwner(page);
    const workspaceId = await resolveOperatorWorkspaceId(page);
    await page.request
      .delete(`/api/workspaces/${workspaceId}/drafts/operator.wizard/denali-create`)
      .catch(() => {});

    await publishOperatorWizardTemplate(page, {
      seedLabel: templateSeed,
      titleCanonicalPath: "title",
    });

    let presetId = "";
    try {
      const createRes = await page.request.post("/api/settings/resources/tour_presets", {
        data: { name: presetName },
      });
      const createText = await createRes.text();
      expect(createRes.ok(), createText).toBeTruthy();
      const listRes = await page.request.get("/api/settings/resources/tour_presets");
      const listText = await listRes.text();
      expect(listRes.ok(), listText).toBeTruthy();
      const listBody = JSON.parse(listText) as {
        items?: ReadonlyArray<{ id?: string; name?: string }>;
      };
      presetId =
        listBody.items?.find((item) => item?.name === presetName)?.id?.trim() ?? "";
      expect(presetId.length).toBeGreaterThan(0);

      await page.goto(`/tours/new?preset=${encodeURIComponent(presetId)}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator('[data-wizard-step="denali_basic"]')).toBeVisible({
        timeout: 90_000,
      });

      const titleInput = page.getByRole("textbox", { name: /نام تور|title/i });
      await expect
        .poll(() => titleInput.inputValue(), { timeout: 30_000 })
        .toBe(presetName);
      await expect(titleInput).not.toHaveValue(templateSeed);
    } finally {
      if (presetId.length > 0) {
        await page.request.delete(`/api/settings/resources/tour_presets/${presetId}`).catch(() => {});
      }
      await page.request
        .delete(`/api/workspaces/${workspaceId}/drafts/operator.wizard/denali-create`)
        .catch(() => {});
    }
  });

  test("SMK-DENALI-REVIEW-01 review shows destination label instead of UUID", async ({ page }) => {
    const tourTitle = `SMK-DENALI-REVIEW-01 ${Date.now()}`;

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 120_000 });
    await clearOperatorWizardDraftIfPresent(page);
    await fillDenaliMultiDayWizardThroughReview(page, tourTitle);

    const destination = page.getByTestId(DENALI_REVIEW_STEP_TEST_IDS.destinationName);
    await expect(destination).toHaveText(OPERATOR_SMOKE_DESTINATION_LABEL, { timeout: 30_000 });
    await expect(destination).not.toContainText(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});

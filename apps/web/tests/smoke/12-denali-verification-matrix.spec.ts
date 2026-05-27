import { expect, test } from "@playwright/test";

import {
  advanceDenaliWizardToStep,
  applyDenaliWizardIntegrationPatch,
  denaliTitleInput,
  denaliWizardBackButton,
  denaliWizardNextButton,
  fillDenaliMountainBasicsForNavigation,
  fillDenaliShortDescription,
  fillDenaliTitle,
  installDenaliVerificationMatrixSetup,
  installScopedDraftEngineRoutes,
  restoreDenaliDraftAfterReload,
  setNativeSelectValue,
  SMOKE_DENALI_DRAFT_WORKSPACE_A,
  SMOKE_DENALI_DRAFT_WORKSPACE_B,
  waitForDraftConflictPatch,
  waitForDraftPatch,
  waitForDraftPatchAttempt,
  waitForDenaliDraftEngineInitialized,
  waitForDenaliWizardAuthHydrated,
} from "./tour-wizard-smoke-helpers";

async function saveDenaliDraftTitle(page: import("@playwright/test").Page, title: string): Promise<void> {
  await waitForDenaliDraftEngineInitialized(page);
  const patchPromise = waitForDraftPatch(page);
  await fillDenaliTitle(page, title);
  await patchPromise;
}

/**
 * Denali Final Verification Matrix (MAP.MD Phase A).
 *
 * 2a) Kind Switch Flow
 * 2b) Multi-Step Back/Forward
 * 2c) Draft engine snapshot restore
 * 2c-multi-step) Partial hydration through step 3 + reload
 * 2d) Draft save error + retry
 * 2d-logistics) Network interruption on logistics step
 * 2e) Two-tab stale draft conflict notice
 * 2f) Tenant-scoped draft isolation
 */

async function requireDenaliWizardVisible(page: import("@playwright/test").Page): Promise<void> {
  const denali = page.getByTestId("denali-create-tour-wizard");
  const wizardReady = await denali
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (!wizardReady) {
    test.skip(true, "Denali wizard not available on this host (must be a Denali tenant subdomain)");
  }
}

test.describe("denali verification matrix", () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? process.env.PW_BASE_URL ?? "http://denali.localhost:3000";
    await installScopedDraftEngineRoutes(context);
    await installDenaliVerificationMatrixSetup(page, context, { baseURL });
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await waitForDenaliWizardAuthHydrated(page);
    await requireDenaliWizardVisible(page);
    await waitForDenaliDraftEngineInitialized(page);
  });

  test("2a) kind switch mid-wizard purges ghost fields from UI", async ({ page }) => {
    await applyDenaliWizardIntegrationPatch(page);
    await denaliWizardNextButton(page).click();
    await expect(page.getByTestId("denali-step-photos")).toBeVisible({ timeout: 15_000 });
    await denaliWizardNextButton(page).click();
    await expect(page.getByTestId("denali-program-difficulty-slider")).toBeVisible({ timeout: 15_000 });

    await denaliWizardBackButton(page).click();
    await denaliWizardBackButton(page).click();
    await setNativeSelectValue(page.getByTestId("denali-basics-category"), "event");

    await denaliWizardNextButton(page).click();
    await denaliWizardNextButton(page).click();
    await expect(page.getByTestId("denali-program-difficulty-slider")).toBeHidden();

    for (let i = 0; i < 3; i += 1) {
      await denaliWizardNextButton(page).click();
    }
    await expect(page.getByTestId("denali-review-participants-section")).toBeHidden();
  });

  test("2b) navigation preserves valid fields and validations", async ({ page }) => {
    await applyDenaliWizardIntegrationPatch(page);
    await fillDenaliTitle(page, "Matrix Test Tour");
    await denaliWizardNextButton(page).click();

    await expect(page.locator('[data-field-path="programNature.shortDescription"]')).toBeVisible({
      timeout: 15_000,
    });
    await fillDenaliShortDescription(page, "Short desc");

    await denaliWizardBackButton(page).click();
    await expect(denaliTitleInput(page)).toHaveValue("Matrix Test Tour");
  });

  test("2c) draft engine restore survives reload", async ({ page }) => {
    await applyDenaliWizardIntegrationPatch(page);
    await saveDenaliDraftTitle(page, "Draft Restore Test");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForDenaliWizardAuthHydrated(page);
    await requireDenaliWizardVisible(page);
    await waitForDenaliDraftEngineInitialized(page);
    await restoreDenaliDraftAfterReload(page);

    await expect(page.getByTestId("denali-draft-save-error")).toBeHidden();
    await expect(denaliTitleInput(page)).toHaveValue("Draft Restore Test");
  });

  test("2c-multi-step) partial hydration restores step 3 fields after reload", async ({ page }) => {
    const title = "Hydration Step3 Test";
    const shortDesc = "Short desc step2";

    await applyDenaliWizardIntegrationPatch(page, {
      basicInfo: { title },
      programNature: { shortDescription: shortDesc },
    });

    await denaliWizardNextButton(page).click();
    await expect(page.getByTestId("denali-step-photos")).toBeVisible({ timeout: 15_000 });
    await denaliWizardNextButton(page).click();
    await expect(page.getByTestId("denali-step-program")).toBeVisible({ timeout: 15_000 });

    const slider = page.getByTestId("denali-program-difficulty-slider");
    const patchPromise = waitForDraftPatch(page);
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = "8";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await patchPromise;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForDenaliWizardAuthHydrated(page);
    await requireDenaliWizardVisible(page);
    await waitForDenaliDraftEngineInitialized(page);
    await restoreDenaliDraftAfterReload(page);

    await expect(page.getByTestId("denali-draft-save-error")).toBeHidden();
    await expect(page.getByTestId("denali-step-program")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("denali-wizard-step-denali_program")).toHaveAttribute(
      "aria-current",
      "step",
    );
    await denaliWizardBackButton(page).click();
    await expect(page.locator('[data-field-path="programNature.shortDescription"]')).toHaveValue(
      shortDesc,
    );
    await denaliWizardBackButton(page).click();
    await expect(denaliTitleInput(page)).toHaveValue(title);
  });

  test("2d) draft save error is visible and retry clears it", async ({ page }) => {
    let patchAttempts = 0;
    await page.route("**/api/workspaces/**/draft-engine/**", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }

      patchAttempts += 1;
      if (patchAttempts === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "save failed" }),
        });
        return;
      }

      const rawBody = route.request().postData() ?? "{}";
      const payload = JSON.parse(rawBody) as {
        data?: unknown;
        version?: number;
        schemaVersion?: number;
        lastModified?: number;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: payload.data ?? {},
          version: (payload.version ?? 0) + 1,
          schemaVersion: payload.schemaVersion ?? 1,
          lastModified: payload.lastModified ?? Date.now(),
        }),
      });
    });

    await applyDenaliWizardIntegrationPatch(page);
    await waitForDenaliDraftEngineInitialized(page);
    const patchPromise = waitForDraftPatchAttempt(page);
    await fillDenaliTitle(page, "Retry Flow Draft");
    await patchPromise;
    await expect(page.getByTestId("denali-draft-save-error")).toBeVisible();

    await page.getByTestId("denali-draft-save-error").getByRole("button").click();
    await expect.poll(() => patchAttempts).toBeGreaterThan(1);
    await expect(page.getByTestId("denali-draft-save-error")).toBeHidden();
  });

  test("2d-logistics) network interruption on logistics step shows error and retry", async ({
    page,
  }) => {
    await applyDenaliWizardIntegrationPatch(page, {
      basicInfo: { title: "Logistics Retry Draft" },
    });

    await advanceDenaliWizardToStep(page, "denali-step-logistics");
    await expect(page.getByTestId("denali-step-logistics")).toBeVisible();

    let patchAttempts = 0;
    await page.route("**/api/workspaces/**/draft-engine/**", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }

      patchAttempts += 1;
      if (patchAttempts === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "logistics save failed" }),
        });
        return;
      }

      const rawBody = route.request().postData() ?? "{}";
      const payload = JSON.parse(rawBody) as {
        data?: unknown;
        version?: number;
        schemaVersion?: number;
        lastModified?: number;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: payload.data ?? {},
          version: (payload.version ?? 0) + 1,
          schemaVersion: payload.schemaVersion ?? 1,
          lastModified: payload.lastModified ?? Date.now(),
        }),
      });
    });

    await setNativeSelectValue(page.getByTestId("denali-transport-mode"), "bus");
    await expect(page.getByTestId("denali-draft-save-error")).toBeVisible();
    await expect(page.getByTestId("denali-step-logistics")).toBeVisible();

    await page.getByTestId("denali-draft-save-error").getByRole("button").click();
    await expect.poll(() => patchAttempts).toBeGreaterThan(1);
    await expect(page.getByTestId("denali-draft-save-error")).toBeHidden();
    await expect(page.getByTestId("denali-step-logistics")).toBeVisible();
  });

  test("2e) two tabs detect stale draft after concurrent save", async ({ context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? process.env.PW_BASE_URL ?? "http://denali.localhost:3000";
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await installDenaliVerificationMatrixSetup(pageA, context, { baseURL });
    await installDenaliVerificationMatrixSetup(pageB, context, { baseURL });
    await pageA.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await pageB.goto("/tours/new", { waitUntil: "domcontentloaded" });

    await waitForDenaliWizardAuthHydrated(pageA);
    await waitForDenaliWizardAuthHydrated(pageB);
    await requireDenaliWizardVisible(pageA);
    await requireDenaliWizardVisible(pageB);
    await waitForDenaliDraftEngineInitialized(pageA);
    await waitForDenaliDraftEngineInitialized(pageB);

    const titleA = denaliTitleInput(pageA);
    const titleB = denaliTitleInput(pageB);

    await applyDenaliWizardIntegrationPatch(pageA);
    await applyDenaliWizardIntegrationPatch(pageB);
    await saveDenaliDraftTitle(pageA, "Tab A Title");

    await restoreDenaliDraftAfterReload(pageB);
    await saveDenaliDraftTitle(pageB, "Tab B Title");

    await saveDenaliDraftTitle(pageA, "Tab A Updated");

    const conflictPatchB = waitForDraftConflictPatch(pageB);
    await fillDenaliTitle(pageB, "Tab B Title ");
    await conflictPatchB;

    await expect(pageB.getByTestId("denali-draft-stale-notice")).toBeVisible();
    await expect(titleB).toHaveValue(/Tab B Title/);

    await fillDenaliTitle(pageA, "Tab A still editable");
    await expect(titleA).toHaveValue("Tab A still editable");

    await pageA.close();
    await pageB.close();
  });

  test("2f) tenant-scoped drafts do not leak across workspace ids", async ({ context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? process.env.PW_BASE_URL ?? "http://denali.localhost:3000";

    const pageA = await context.newPage();
    await installDenaliVerificationMatrixSetup(pageA, context, {
      tenantId: SMOKE_DENALI_DRAFT_WORKSPACE_A,
      baseURL,
    });
    await pageA.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await waitForDenaliWizardAuthHydrated(pageA);
    await requireDenaliWizardVisible(pageA);
    await waitForDenaliDraftEngineInitialized(pageA);

    const tenantATitle = "Tenant A Isolated Draft";
    await applyDenaliWizardIntegrationPatch(pageA, { basicInfo: { title: "Tenant A seed" } });
    const patchPromise = waitForDraftPatch(pageA);
    await fillDenaliTitle(pageA, tenantATitle);
    const patchA = await patchPromise;
    const workspaceA = new URL(patchA.url()).pathname.match(/\/api\/workspaces\/([^/]+)\//)?.[1];
    expect(workspaceA).toBe(SMOKE_DENALI_DRAFT_WORKSPACE_A);

    const pageB = await context.newPage();
    await installDenaliVerificationMatrixSetup(pageB, context, {
      tenantId: SMOKE_DENALI_DRAFT_WORKSPACE_B,
      baseURL,
    });
    await pageB.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await waitForDenaliWizardAuthHydrated(pageB);
    await requireDenaliWizardVisible(pageB);
    await waitForDenaliDraftEngineInitialized(pageB);

    const titleB = denaliTitleInput(pageB);
    await expect(titleB).not.toHaveValue(tenantATitle);
    const bValue = await titleB.inputValue();
    expect(bValue.trim()).toBe("");

    await pageA.close();
    await pageB.close();
  });
});

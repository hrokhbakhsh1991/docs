import { expect, test } from "@playwright/test";

/**
 * Denali Final Verification Matrix (map.md §2).
 * 
 * 2a) Kind Switch Flow
 * 2b) Multi-Step Back/Forward
 * 2c) Draft engine snapshot restore
 * 2e) Two-tab stale draft conflict notice
 */

function waitForDraftPatch(page: import("@playwright/test").Page, status = 200) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      /\/api\/workspaces\/[^/]+\/draft-engine\/[^/]+/.test(response.url()) &&
      response.status() === status,
    { timeout: 15_000 },
  );
}

/** REFETCH_REAPPLY ends on 409 + merge; no guaranteed follow-up PATCH 200. */
function waitForDraftConflictPatch(page: import("@playwright/test").Page) {
  return waitForDraftPatch(page, 409);
}

test.describe("denali verification matrix", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    const denali = page.getByTestId("denali-create-tour-wizard");
    if (!(await denali.isVisible().catch(() => false))) {
      test.skip(true, "Denali wizard not available on this host (must be a Denali tenant subdomain)");
    }
  });

  test("2a) kind switch mid-wizard purges ghost fields from UI", async ({ page }) => {
    // 1. Fill mountain-specific fields on step 2
    await page.getByRole("button", { name: /بعدی|next/i }).click(); // To step 2 (program)
    await expect(page.getByTestId("denali-program-difficulty")).toBeVisible();
    await page.getByTestId("denali-program-difficulty").selectOption("hard");

    // 2. Go back to step 1 and switch to event
    await page.getByRole("button", { name: /قبلی|previous/i }).click();
    await page.getByTestId("denali-tour-category-event").click();

    // 3. Go forward to step 2
    await page.getByRole("button", { name: /بعدی|next/i }).click();
    
    // 4. Assert outdoor fields are hidden
    await expect(page.getByTestId("denali-program-difficulty")).toBeHidden();
    
    // 5. Go to review and assert no participant fields
    for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: /بعدی|next/i }).click();
    }
    await expect(page.getByTestId("denali-review-participants-section")).toBeHidden();
  });

  test("2b) navigation preserves valid fields and validations", async ({ page }) => {
    await page.getByPlaceholder(/عنوان|title/i).fill("Matrix Test Tour");
    await page.getByRole("button", { name: /بعدی|next/i }).click();
    
    await expect(page.getByPlaceholder(/توضیح کوتاه|short description/i)).toBeVisible();
    await page.getByPlaceholder(/توضیح کوتاه|short description/i).fill("Short desc");
    
    await page.getByRole("button", { name: /قبلی|previous/i }).click();
    await expect(page.getByPlaceholder(/عنوان|title/i)).toHaveValue("Matrix Test Tour");
  });

  test("2c) draft engine restore survives reload", async ({ page }) => {
    const draftPatch = page
      .waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          /\/api\/workspaces\/[^/]+\/draft-engine\/[^/]+/.test(response.url()),
        { timeout: 5_000 },
      )
      .catch(() => null);

    await page.getByPlaceholder(/عنوان|title/i).fill("Draft Restore Test");
    const patchResponse = await draftPatch;
    if (patchResponse == null) {
      // Keep a small fallback for hosts where draft autosave is intentionally disabled.
      await page.waitForTimeout(700);
    }
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("denali-draft-save-error")).toBeHidden();
    await expect(page.getByPlaceholder(/عنوان|title/i)).toHaveValue("Draft Restore Test");
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
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "save failed" }) });
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

    await page.getByPlaceholder(/عنوان|title/i).fill("Retry Flow Draft");
    await expect(page.getByTestId("denali-draft-save-error")).toBeVisible();

    await page.getByTestId("denali-draft-save-error").getByRole("button").click();
    await expect.poll(() => patchAttempts).toBeGreaterThan(1);
    await expect(page.getByTestId("denali-draft-save-error")).toBeHidden();
  });

  test("2e) two tabs detect stale draft after concurrent save", async ({ context }) => {
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await pageA.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await pageB.goto("/tours/new", { waitUntil: "domcontentloaded" });

    const denaliA = pageA.getByTestId("denali-create-tour-wizard");
    if (!(await denaliA.isVisible().catch(() => false))) {
      test.skip(true, "Denali wizard not available on this host (must be a Denali tenant subdomain)");
    }
    await expect(pageB.getByTestId("denali-create-tour-wizard")).toBeVisible();

    const titleA = pageA.getByPlaceholder(/عنوان|title/i);
    const titleB = pageB.getByPlaceholder(/عنوان|title/i);

    await titleA.fill("Tab A Title");
    await waitForDraftPatch(pageA);

    await titleB.fill("Tab B Title");

    await titleA.fill("Tab A Updated");
    await waitForDraftPatch(pageA);

    const conflictPatchB = waitForDraftConflictPatch(pageB);
    await titleB.fill("Tab B Title ");
    await conflictPatchB;

    await expect(pageB.getByTestId("denali-draft-stale-notice")).toBeVisible();
    await expect(titleB).toHaveValue(/Tab B Title/);

    await pageA.close();
    await pageB.close();
  });
});

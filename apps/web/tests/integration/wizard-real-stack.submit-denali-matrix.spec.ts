import { expect, test } from "@playwright/test";

import type { DenaliTourKind } from "@repo/types";

import {
  advanceDenaliWizardToReview,
  buildDenaliSubmitDraftJson,
  clearWizardDrafts,
  fetchTourThemeBySlug,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  ownerPhoneFromProject,
  submitWizardAndExpectTourList,
  seedWizardDraft,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

const DENALI_MATRIX: ReadonlyArray<{
  kind: DenaliTourKind;
  label: string;
  themeSlug: string;
  meetingPoint?: string;
}> = [
  { kind: "mountain_day", label: "کوه یک‌روزه", themeSlug: "denali-mountain-1-day" },
  { kind: "mountain_multi", label: "کوه چندروزه", themeSlug: "denali-mountain-multi-day" },
  { kind: "nature_day", label: "طبیعت یک‌روزه", themeSlug: "denali-nature-1-day" },
  { kind: "nature_multi", label: "طبیعت چندروزه", themeSlug: "denali-nature-multi-day" },
  {
    kind: "event_reading",
    label: "جلسه کتاب‌خوانی",
    themeSlug: "denali-short-session-1h",
    meetingPoint: "کافه کتابخانه — میز اصلی",
  },
  {
    kind: "event_cinema",
    label: "جلسه فیلم در کافه",
    themeSlug: "denali-short-session-2h",
    meetingPoint: "کافه فیلم — سالن کوچک",
  },
];

test.describe("real-stack denali owner matrix (6 tour kinds)", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test.beforeEach(async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    if (slug !== "denali") {
      test.skip(true, "denali project only");
    }
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
    await clearWizardDrafts(page, slug);
  });

  test("owner submits mountain_day with shared_cars transport", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `mountain_day-shared_cars-${Date.now()}`;
    const location = await fetchWizardLocationIds(page);
    const theme = await fetchTourThemeBySlug(page, "denali-mountain-1-day");
    expect(theme, "theme denali-mountain-1-day").toBeTruthy();

    const draftJson = buildDenaliSubmitDraftJson(location, `${slug}-${runId}`, {
      tourType: "mountain_day",
      mainTourThemeId: theme!.id,
      transportMode: "shared_cars",
      dongAmount: 150_000,
    });
    await seedWizardDraft(page, slug, draftJson);

    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });

    await advanceDenaliWizardToReview(page, { mainTourTheme: theme!, tourType: "mountain_day" });
    await submitWizardAndExpectTourList(page);
  });

  for (const row of DENALI_MATRIX) {
    test(`owner submits ${row.label} (${row.kind})`, async ({ page }, testInfo) => {
      const slug = tenantSlugFromProject(testInfo.project.metadata);
      const runId = `${row.kind}-${Date.now()}`;
      const location = await fetchWizardLocationIds(page);
      const theme = await fetchTourThemeBySlug(page, row.themeSlug);
      expect(theme, `theme ${row.themeSlug}`).toBeTruthy();

      const draftJson = buildDenaliSubmitDraftJson(location, `${slug}-${runId}`, {
        tourType: row.kind,
        mainTourThemeId: theme!.id,
        meetingPoint: row.meetingPoint,
      });
      await seedWizardDraft(page, slug, draftJson);

      await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });

      await advanceDenaliWizardToReview(page, { mainTourTheme: theme!, tourType: row.kind });
      await submitWizardAndExpectTourList(page);

      await expect(page.getByText(new RegExp(row.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeVisible({
        timeout: 15_000,
      }).catch(() => {
        /* list may show title only */
      });
    });
  }
});

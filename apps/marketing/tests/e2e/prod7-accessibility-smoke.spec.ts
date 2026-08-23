import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  completeCatalogRegistrationIntake,
  completeGuestPdpRegisterModalThenOpenPortalIntake,
} from "./fixtures/catalog-registration-otp";
import {
  resolveSmokePublishedTourId,
  SMOKE_PUBLISHED_TOUR_TITLE,
} from "./fixtures/smoke-published-tour";

type AxeViolation = {
  readonly id: string;
  readonly impact?: "minor" | "moderate" | "serious" | "critical" | null;
  readonly help: string;
  readonly nodes: ReadonlyArray<{
    readonly target: readonly string[];
    readonly failureSummary?: string;
  }>;
};

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();
const AXE_SOURCE = readFileSync(
  resolve(process.cwd(), "../../node_modules/.pnpm/node_modules/axe-core/axe.min.js"),
  "utf8"
);

async function assertNoSeriousA11yViolations(page: Page, label: string): Promise<void> {
  await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as {
      axe: {
        run: (
          context: Document,
          options: {
            readonly runOnly: {
              readonly type: "tag";
              readonly values: readonly string[];
            };
          }
        ) => Promise<{ readonly violations: readonly AxeViolation[] }>;
      };
    }).axe;
    const result = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
    return result.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
  });

  expect(
    violations,
    `${label} serious/critical accessibility violations:\n${JSON.stringify(violations, null, 2)}`
  ).toEqual([]);
}

test.describe("PROD-7 R7-23 automated accessibility smoke", () => {
  test.setTimeout(420_000);

  test("critical Marketing and Portal registration/member states have no serious/critical axe violations", async ({
    page,
  }) => {
    const email = `prod7-a11y-${Date.now()}@denali-smoke.local`;
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE).first()).toBeVisible({
      timeout: 60_000,
    });
    await assertNoSeriousA11yViolations(page, "marketing catalog list");

    await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });
    await assertNoSeriousA11yViolations(page, "marketing catalog detail");

    await completeGuestPdpRegisterModalThenOpenPortalIntake(page, {
      phone,
      fullName: "PROD7 Accessibility Guest",
      email,
    });
    await expect(page.locator("[data-public-registration-flow]")).toBeVisible({
      timeout: 60_000,
    });
    await assertNoSeriousA11yViolations(page, "portal registration intake");

    await completeCatalogRegistrationIntake(page, {
      email,
      fullName: "PROD7 Accessibility Guest",
      partySize: "2",
      phone,
    });
    await expect(page.locator("[data-public-registration-success]")).toBeVisible({
      timeout: 60_000,
    });
    await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
    await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
      timeout: 60_000,
    });
    await assertNoSeriousA11yViolations(page, "portal member registrations");
  });
});

/**
 * MEG-001 — portal engagement dashboard axe accessibility smoke.
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { authenticatePortalMemberForEngagement } from "./fixtures/authenticate-portal-member-for-engagement";

type AxeViolation = {
  readonly id: string;
  readonly impact?: "minor" | "moderate" | "serious" | "critical" | null;
  readonly help: string;
};

const AXE_SOURCE = readFileSync(
  resolve(process.cwd(), "../../node_modules/.pnpm/node_modules/axe-core/axe.min.js"),
  "utf8",
);

async function assertNoSeriousA11yViolations(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async (contextSelector) => {
    const context = document.querySelector(contextSelector);
    if (context === null) {
      return [];
    }
    const axe = (window as unknown as {
      axe: {
        run: (
          context: Element,
          options: {
            readonly runOnly: { readonly type: "tag"; readonly values: readonly string[] };
          },
        ) => Promise<{ readonly violations: readonly AxeViolation[] }>;
      };
    }).axe;
    const result = await axe.run(context, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
  }, selector);
  expect(violations, `${label} serious/critical axe violations`).toEqual([]);
}

test.describe("MEG-001 portal engagement accessibility", () => {
  test.setTimeout(240_000);

  test("member home engagement panel has no serious/critical axe violations", async ({
    page,
  }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "Engagement A11y Member",
    });

    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-dashboard-engagement]")).toBeVisible({
      timeout: 90_000,
    });
    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-dashboard-engagement]",
      "engagement dashboard",
    );
  });
});

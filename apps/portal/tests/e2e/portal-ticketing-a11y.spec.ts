/**
 * TKT-L — portal member ticketing axe accessibility smoke.
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";

type AxeViolation = {
  readonly id: string;
  readonly impact?: "minor" | "moderate" | "serious" | "critical" | null;
  readonly help: string;
};

const AXE_SOURCE = readFileSync(
  resolve(process.cwd(), "../../node_modules/.pnpm/node_modules/axe-core/axe.min.js"),
  "utf8",
);

async function assertNoSeriousA11yViolations(page: Page, label: string): Promise<void> {
  await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as {
      axe: {
        run: (
          context: Document,
          options: {
            readonly runOnly: { readonly type: "tag"; readonly values: readonly string[] };
          },
        ) => Promise<{ readonly violations: readonly AxeViolation[] }>;
      };
    }).axe;
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
  });
  expect(violations, `${label} serious/critical axe violations`).toEqual([]);
}

test.describe("TKT-L portal ticketing accessibility", () => {
  test.setTimeout(240_000);

  test("member tickets list has no serious/critical axe violations", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await authenticatePortalMemberForTickets(page, {
      phone,
      fullName: "Portal A11y Member",
    });
    await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });
    await assertNoSeriousA11yViolations(page, "portal member tickets list");
  });
});

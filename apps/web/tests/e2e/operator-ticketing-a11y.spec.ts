/**
 * TKT-L — operator ticketing axe accessibility smoke.
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { OPERATOR_TICKETS_TEST_IDS } from "../../src/features/tickets/operator-tickets-types";

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

test.describe("TKT-L operator ticketing accessibility", () => {
  test.setTimeout(240_000);

  test("inbox and detail have no serious/critical axe violations", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/tickets", { waitUntil: "load" });
    await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.shell)).toBeVisible({ timeout: 90_000 });
    await assertNoSeriousA11yViolations(page, "[data-operator-tickets-inbox]", "operator tickets inbox");

    const rows = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow);
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await expect(
        page.locator("[data-operator-tickets-detail-state='ready']").filter({ visible: true }),
      ).toBeVisible({ timeout: 60_000 });
      await assertNoSeriousA11yViolations(
        page,
        "[data-operator-tickets-detail][data-operator-tickets-detail-state='ready']",
        "operator tickets detail",
      );
    }
  });
});

/**
 * NOTIF-BQC-13 — portal member notifications axe accessibility smoke.
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";
import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";
import { ensurePortalSmokeMemberHasUnreadNotifications } from "./fixtures/ensure-portal-smoke-member-has-unread-notifications";
import { gotoMemberNotificationsReady } from "./fixtures/portal-member-notifications";

type AxeViolation = {
  readonly id: string;
  readonly impact?: "minor" | "moderate" | "serious" | "critical" | null;
  readonly help: string;
};

const AXE_SOURCE = readFileSync(
  resolve(process.cwd(), "../../node_modules/.pnpm/node_modules/axe-core/axe.min.js"),
  "utf8",
);

const MEMBER_PHONE = "+15550001003";
const MEMBER_NAME = "Smoke Member";

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

test.describe("NOTIF-BQC portal notifications accessibility", () => {
  test.setTimeout(240_000);

  test("NOTIF-BQC-13 notifications inbox has no serious/critical axe violations", async ({
    page,
  }) => {
    await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });
    await ensurePortalSmokeMemberHasUnreadNotifications(page);
    await gotoMemberNotificationsReady(page);

    await expect(page.locator("[data-portal-member-notification-item]").first()).toBeVisible({
      timeout: 30_000,
    });

    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-notifications-panel][data-portal-member-notifications-state='ready']",
      "portal member notifications inbox",
    );

    await captureBqcArtifact(page, "/opt/cursor/artifacts/bqc-notifications-inbox-a11y.png", { fullPage: true });
  });
});

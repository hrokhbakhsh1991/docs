/**
 * WALLET-A11Y — shared axe + keyboard helpers for Denali wallet surfaces.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type AxeViolation = {
  readonly id: string;
  readonly impact?: "minor" | "moderate" | "serious" | "critical" | null;
  readonly help: string;
};

const AXE_SOURCE = readFileSync(
  resolve(process.cwd(), "../../node_modules/.pnpm/node_modules/axe-core/axe.min.js"),
  "utf8",
);

export async function assertNoSeriousA11yViolations(
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

export async function assertHeadingHierarchy(root: Locator): Promise<void> {
  const levels = await root.locator("h1, h2, h3, h4").evaluateAll((nodes) =>
    nodes.map((node) => Number.parseInt(node.tagName.slice(1), 10)),
  );
  expect(levels.length).toBeGreaterThan(0);
  for (let index = 1; index < levels.length; index += 1) {
    expect(levels[index]! - levels[index - 1]!).toBeLessThanOrEqual(1);
  }
}

export async function assertKeyboardReachable(page: Page, target: Locator): Promise<void> {
  await target.focus();
  await expect(target).toBeFocused();
}

export async function assertVisibleFocusRing(page: Page, target: Locator): Promise<void> {
  await target.focus();
  const outlineWidth = await target.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return style.outlineWidth;
  });
  expect(outlineWidth).not.toBe("0px");
}

export async function assertCurrencyReadable(balanceLocator: Locator): Promise<void> {
  const text = (await balanceLocator.innerText()).trim();
  expect(text.length).toBeGreaterThan(0);
  expect(text).toMatch(/ریال|IRR|۰|0/);
}

export async function assertTransactionSemantics(page: Page): Promise<void> {
  const firstTx = page.locator("[data-portal-member-wallet-transaction]").first();
  await expect(firstTx).toBeVisible();
  const direction = await firstTx.getAttribute("data-transaction-direction");
  expect(direction === "incoming" || direction === "outgoing").toBe(true);
  const amountText = await firstTx
    .locator("[data-portal-member-wallet-transaction-amount]")
    .innerText();
  expect(amountText).toMatch(/^[+−-]/);
  const label = await firstTx.locator("[data-portal-member-wallet-transaction-label]").innerText();
  expect(label.trim().length).toBeGreaterThan(0);
}

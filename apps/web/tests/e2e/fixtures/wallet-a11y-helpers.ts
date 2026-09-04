/**
 * WALLET-A11Y — shared axe + keyboard helpers for operator wallet surfaces.
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

export async function assertFormLabelsPresent(root: Locator): Promise<void> {
  const inputs = root.locator("input, textarea");
  const count = await inputs.count();
  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    const id = await input.getAttribute("id");
    const ariaLabel = await input.getAttribute("aria-label");
    const ariaLabelledby = await input.getAttribute("aria-labelledby");
    if (id !== null) {
      const labelFor = root.locator(`label[for="${id}"]`);
      if ((await labelFor.count()) > 0) {
        continue;
      }
    }
    expect(
      ariaLabel !== null || ariaLabelledby !== null,
      `input ${index} must have label, aria-label, or aria-labelledby`,
    ).toBe(true);
  }
}

export async function assertKeyboardReachable(page: Page, target: Locator): Promise<void> {
  await target.focus();
  await expect(target).toBeFocused();
}

export async function assertDialogFocusManagement(page: Page, dialogTestId: string): Promise<void> {
  const dialog = page.getByTestId(dialogTestId);
  await expect(dialog).toBeVisible();
  const focusedInDialog = await dialog.evaluate((element) => element.contains(document.activeElement));
  expect(focusedInDialog).toBe(true);
}

import type { Page } from "@playwright/test";

/** Controlled `LocalizedNumericInput` — use keyboard events, not `fill()`. */
export async function typeLoginPhone(page: Page, phone: string): Promise<void> {
  const input = page.locator("#phone");
  await input.click();
  await input.press("ControlOrMeta+a");
  await input.press("Backspace");
  await input.pressSequentially(phone, { delay: 20 });
}

import type { Page } from "@playwright/test";

/** Best-effort walkthrough screenshot; never fails the spec on artifact I/O errors. */
export async function captureBqcArtifact(
  page: Page,
  path: string,
  options?: { fullPage?: boolean },
): Promise<void> {
  try {
    await page.screenshot({ path, fullPage: options?.fullPage ?? true });
  } catch (error) {
    console.warn(`BQC artifact screenshot skipped (${path}):`, error);
  }
}

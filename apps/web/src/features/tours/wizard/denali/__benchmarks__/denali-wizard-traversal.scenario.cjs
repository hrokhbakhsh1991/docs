/**
 * Memlab scenario: wizard step 1 (basics) → step 7 (review) → step 1.
 * Served by `scripts/run-denali-wizard-memlab.mjs` (static harness bundle).
 */

/** @param {import('puppeteer').Page} page */
async function waitForHarness(page) {
  await page.waitForSelector('[data-testid="denali-memlab-harness"]', { timeout: 30_000 });
}

function url() {
  const port = process.env.DENALI_MEMLAB_PORT ?? "8765";
  return `http://127.0.0.1:${port}/index.html`;
}

/** @param {import('puppeteer').Page} page */
async function action(page) {
  await waitForHarness(page);
  await page.click('[data-testid="memlab-traverse-forward"]');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="memlab-active-step-index"]');
      return el?.textContent === "6";
    },
    { timeout: 10_000 },
  );
}

/** @param {import('puppeteer').Page} page */
async function back(page) {
  await waitForHarness(page);
  await page.click('[data-testid="memlab-traverse-back"]');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="memlab-active-step-index"]');
      return el?.textContent === "0";
    },
    { timeout: 10_000 },
  );
}

module.exports = { action, back, url };

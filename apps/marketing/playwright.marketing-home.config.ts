import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing home smoke — SMK-MKT-HOME-01..06
 * @see docs/workspaces/denali/marketing-landing.mdoc §28
 *
 * Uses Chromium + iPhone 13 viewport (CI installs chromium only — not WebKit).
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const denaliBaseUrl = process.env.SMOKE_MARKETING_BASE_URL ?? "http://operator.localhost:3002";
const urbanBaseUrl = process.env.SMOKE_MARKETING_URBAN_BASE_URL ?? "http://urban.localhost:3002";
const motherBaseUrl = process.env.SMOKE_MOTHER_BASE_URL ?? "http://localhost:3002";

const iphone13Viewport = devices["iPhone 13"].viewport;
const iphone13Mobile = {
  viewport: iphone13Viewport,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["iPhone 13"].userAgent,
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-home-smoke.spec.ts"],
  fullyParallel: false,
  retries: process.env.CI || process.env.PW_EXTERNAL_SERVERS === "1" ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  projects: [
    {
      name: "home-denali",
      grep: /SMK-MKT-HOME-0(1|2|3|7|8)|SMK-MKT-HOME-10/,
      use: {
        ...devices["Desktop Chrome"],
        ...iphone13Mobile,
        baseURL: denaliBaseUrl,
      },
    },
    {
      name: "home-urban",
      grep: /SMK-MKT-HOME-0(2|3|5)/,
      use: {
        ...devices["Desktop Chrome"],
        ...iphone13Mobile,
        baseURL: urbanBaseUrl,
      },
    },
    {
      name: "home-mother",
      grep: /SMK-MKT-HOME-06/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: motherBaseUrl,
      },
    },
  ],
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-marketing-e2e-servers.mjs",
          url: `${denaliBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});

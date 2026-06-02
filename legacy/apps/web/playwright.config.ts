import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: process.env.CI
    ? ["smoke/**/*.spec.ts", "e2e/**/*.spec.ts", "auth/session-logout.spec.ts"]
    : ["**/*.spec.ts", "**/*.test.ts"],
  snapshotDir: "./tests/visual/screenshots",
  retries: 1,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  use: {
    // Bind the Next standalone server to `127.0.0.1` (see `webServer.env.HOSTNAME`).
    // Using loopback IPv4 here avoids flaky `localhost` → `::1` mismatches on some Linux setups.
    baseURL: "http://127.0.0.1:3000",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        /** Local fallback when `playwright install chromium` cannot reach CDN (CI installs Chromium explicitly). */
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL as "chrome" | "chromium" | "msedge" }
          : {}),
      },
    },
  ],
  webServer: {
    // `next.config.mjs` sets `output: "standalone"` — `next start` is not supported for this mode.
    command: "node .next/standalone/apps/web/server.js",
    cwd: __dirname,
    url: "http://127.0.0.1:3000",
    // Default: reuse an already-running server locally (common dev workflow). CI forces a fresh server.
    // To force a fresh local server: `PW_NO_REUSE_SERVER=1 pnpm exec playwright …` (requires port 3000 free).
    reuseExistingServer: process.env.CI ? false : process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: "3000",
      HOSTNAME: "127.0.0.1",
      // Point Tour-Ops calls at the same origin as the Next.js server so Playwright can intercept
      // `http://127.0.0.1:3000/api/v2/**` reliably (matches dynamic tenant origin from workspace host).
      NEXT_PUBLIC_API_DYNAMIC_ORIGIN: "true",
      NEXT_PUBLIC_API_PORT: "3001",
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});

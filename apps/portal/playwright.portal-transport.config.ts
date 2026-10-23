import { defineConfig, devices } from "@playwright/test";

if (process.env.PW_EXTERNAL_SERVERS === "1") {
  throw new Error(
    "The transport smoke gate is local-only; do not point its seeded scenario at staging."
  );
}

const portalSmokeBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://portal.operator.localhost:3003";
const chromiumExecutablePath = process.env.PW_CHROMIUM_EXECUTABLE_PATH?.trim();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["portal-registration-transport-smoke.spec.ts"],
  forbidOnly: true,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 120_000,
    launchOptions: {
      ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
      args: [
        "--host-resolver-rules=MAP portal.operator.localhost 127.0.0.1, MAP operator.portal.localhost 127.0.0.1",
      ],
    },
  },
  webServer: {
    command: "node scripts/smoke-portal-e2e-servers.mjs",
    url: `${portalSmokeBaseUrl}/health`,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});

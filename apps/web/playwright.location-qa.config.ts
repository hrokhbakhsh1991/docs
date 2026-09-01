import dns from "node:dns";
import { defineConfig, devices } from "@playwright/test";

dns.setDefaultResultOrder("ipv4first");

/**
 * Location QA — canonical WRS admin host after legacy 308 redirect.
 * @see packages/tenant-kernel — operator.admin.localhost → admin.operator.localhost
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.operator.localhost:3000";

const hostResolverRules = [
  "MAP admin.operator.localhost 127.0.0.1",
  "MAP operator.admin.localhost 127.0.0.1",
].join(",");

export default defineConfig({
  globalSetup: "./tests/e2e/location-qa-global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: ["denali-location-ux-browser-qa.spec.ts"],
  workers: 1,
  timeout: 300_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    locale: "fa-IR",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: [`--host-resolver-rules=${hostResolverRules}`],
    },
  },
  ...(process.env.PW_EXTERNAL_SERVERS === "1"
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-operator-e2e-servers.mjs",
          url: "http://127.0.0.1:3000/auth/login",
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
        },
      }),
  reporter: [["list"]],
});

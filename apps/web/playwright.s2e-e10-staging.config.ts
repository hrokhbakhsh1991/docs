import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

const runId = process.env.DENALI_SECOND_STAGING_RUN_ID?.trim() ?? "";
const baseURL = process.env.DENALI_SECOND_STAGING_ADMIN_URL?.trim() ?? "";
const relayPort = Number(process.env.DENALI_SECOND_STAGING_RELAY_PORT ?? "0");
const caPath = process.env.DENALI_SECOND_STAGING_CADDY_ROOT_CA?.trim() ?? "";
const runtimeSha = process.env.DENALI_SECOND_STAGING_RUNTIME_SHA?.trim() ?? "";
const testSha = process.env.DENALI_SECOND_STAGING_TEST_SHA?.trim() ?? "";
const ownerMobile = process.env.OPERATOR_OWNER_MOBILE?.trim() ?? "";

if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(runId)) {
  throw new Error("DENALI_SECOND_STAGING_RUN_ID must be a unique filesystem-safe identifier");
}
if (baseURL !== "https://admin.qa2.staging.test:9443") {
  throw new Error("DENALI_SECOND_STAGING_ADMIN_URL must use the approved QA2 relay origin");
}
if (!Number.isInteger(relayPort) || relayPort < 1024 || relayPort > 65535) {
  throw new Error("DENALI_SECOND_STAGING_RELAY_PORT must be an unprivileged TCP port");
}
if (!/^[a-f0-9]{40}$/i.test(runtimeSha)) {
  throw new Error("DENALI_SECOND_STAGING_RUNTIME_SHA must be the exact staging runtime commit SHA");
}
if (!/^[a-f0-9]{40}$/i.test(testSha)) {
  throw new Error("DENALI_SECOND_STAGING_TEST_SHA must be the exact test checkout commit SHA");
}
const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (checkoutSha.toLowerCase() !== testSha.toLowerCase()) {
  throw new Error("DENALI_SECOND_STAGING_TEST_SHA must match the current test checkout");
}
const checkoutStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
  encoding: "utf8",
}).trim();
if (checkoutStatus.length > 0) {
  throw new Error("S2-E10 requires a clean test checkout for exact test SHA provenance");
}
if (Number(new URL(baseURL).port) !== relayPort) {
  throw new Error("DENALI_SECOND_STAGING_RELAY_PORT must match the approved QA2 relay origin");
}
if (caPath.length === 0) {
  throw new Error("DENALI_SECOND_STAGING_CADDY_ROOT_CA must point to the verified staging CA");
}
if (!/^\+1555\d{7}$/.test(ownerMobile)) {
  throw new Error("OPERATOR_OWNER_MOBILE must be the dedicated synthetic QA2 Owner identity");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "s2-e10-staging.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 300_000,
  outputDir: `test-results/denali-second-tenant-staging/${runId}`,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    ignoreHTTPSErrors: false,
    screenshot: "only-on-failure",
    trace: "off",
  },
});

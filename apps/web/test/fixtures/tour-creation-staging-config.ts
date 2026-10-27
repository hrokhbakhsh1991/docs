import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";

import closureConfig from "../../playwright.tour-creation-closure.config";

const stagingAdminUrl = "https://staging-admin-denali.shenski.com";
const stagingUrls = {
  PLAYWRIGHT_BASE_URL: stagingAdminUrl,
  SMOKE_OPERATOR_WEB_BASE_URL: stagingAdminUrl,
  SMOKE_DENALI_ADMIN_BASE_URL: stagingAdminUrl,
  SMOKE_MARKETING_OPERATOR_BASE_URL: "https://staging-denali.shenski.com",
  SMOKE_PORTAL_OPERATOR_BASE_URL: "https://staging-portal-denali.shenski.com",
} as const;

// These focused configs must never start the local smoke stack: its setup kills
// listeners on ports 3000–3003 and seeds an in-memory API.
process.env.PW_EXTERNAL_SERVERS = "1";
for (const [name, expectedUrl] of Object.entries(stagingUrls)) {
  const configuredUrl = process.env[name] ?? expectedUrl;
  const parsed = new URL(configuredUrl);
  const expected = new URL(expectedUrl);
  if (parsed.protocol !== "https:" || parsed.host !== expected.host) {
    throw new Error(`${name} must target ${expected.host}; refusing a non-staging E2E run`);
  }
  process.env[name] = configuredUrl;
}

type StagingConfigOverrides = Omit<PlaywrightTestConfig, "globalSetup" | "webServer" | "use"> & {
  readonly use?: PlaywrightTestConfig["use"];
};

export function defineTourCreationStagingConfig(
  overrides: StagingConfigOverrides
): PlaywrightTestConfig {
  const overrideUse = overrides.use ?? {};
  const baseUse = closureConfig.use ?? {};
  const inheritedLaunchOptions = baseUse.launchOptions;
  const launchArgs = Array.isArray(inheritedLaunchOptions?.args)
    ? inheritedLaunchOptions.args.filter(
        (argument) =>
          argument !== "--disable-web-security" && !argument.startsWith("--host-resolver-rules=")
      )
    : [];
  return defineConfig({
    ...closureConfig,
    ...overrides,
    globalSetup: undefined,
    webServer: undefined,
    use: {
      ...baseUse,
      ...overrideUse,
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? stagingAdminUrl,
      launchOptions: {
        ...baseUse.launchOptions,
        ...overrideUse.launchOptions,
        args: launchArgs,
      },
    },
  });
}

import { defineConfig } from "@playwright/test";
import sessionConfig from "./playwright.session-sync-regression.config";

export default defineConfig({
  ...sessionConfig,
  testMatch: ["otp-length-contract.spec.ts"],
  expect: { timeout: 60_000 },
  webServer: Array.isArray(sessionConfig.webServer)
    ? sessionConfig.webServer.map((server) => ({
        ...server,
        stdout: "pipe" as const,
        stderr: "pipe" as const,
      }))
    : sessionConfig.webServer,
});

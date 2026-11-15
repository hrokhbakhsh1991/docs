import { defineConfig } from "@playwright/test";
import base from "./playwright.session-sync-regression.config";

export default defineConfig({
  ...base,
  testMatch: ["password-modal.spec.ts"],
  timeout: 360_000,
});

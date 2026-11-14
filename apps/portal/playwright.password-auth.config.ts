import base from "./playwright.portal.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...base,
  testMatch: ["portal-password-auth.spec.ts"],
  timeout: 360_000,
});

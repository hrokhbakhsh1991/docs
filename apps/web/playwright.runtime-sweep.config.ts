import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
<<<<<<< HEAD
  testMatch: ["operator-ux-runtime-sweep.spec.ts", "settings-responsive.spec.ts", "users-directory-controls-responsive.spec.ts"],
=======
  testMatch: ["operator-ux-runtime-sweep.spec.ts", "users-loyalty-detail-responsive.spec.ts"],
>>>>>>> cursor/users-loyalty-detail-ui-dd87
  workers: 1,
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.denali.localhost:3000",
  },
  reporter: [["list"]],
});

import { defineConfig, devices } from "@playwright/test";

const port = process.env.PW_WEB_PORT?.trim() || "3002";

const tenantProjects = [
  { slug: "denali", phone: "+989121000001" },
  { slug: "urban-demo", phone: "+989121000002" },
  { slug: "mix-demo", phone: "+989121000003" },
] as const;

export default defineConfig({
  testDir: "./tests",
  testMatch: ["integration/**/*.spec.ts"],
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    navigationTimeout: 60_000,
  },
  projects: [
    ...tenantProjects.map((t) => ({
      name: t.slug,
      testMatch: /wizard-real-stack\.shell\.spec\.ts/,
      use: {
        baseURL: `http://${t.slug}.localhost:${port}`,
      },
      metadata: { ownerPhone: t.phone, tenantSlug: t.slug },
    })),
    {
      name: "urban-demo-submit",
      testMatch: /wizard-real-stack\.submit-urban\.spec\.ts/,
      use: { baseURL: `http://urban-demo.localhost:${port}` },
      metadata: { ownerPhone: "+989121000002", tenantSlug: "urban-demo" },
    },
    {
      name: "denali-submit",
      testMatch:
        /wizard-real-stack\.(submit-denali-(mountain|matrix|from-preset|from-preset-in-wizard|from-clone)|denali-preset-settings|denali-map-fields)\.spec\.ts/,
      use: { baseURL: `http://denali.localhost:${port}` },
      metadata: { ownerPhone: "+989121000001", tenantSlug: "denali" },
    },
    {
      name: "mix-demo-submit",
      testMatch: /wizard-real-stack\.submit-mix-urban\.spec\.ts/,
      use: { baseURL: `http://mix-demo.localhost:${port}` },
      metadata: { ownerPhone: "+989121000003", tenantSlug: "mix-demo" },
    },
    {
      name: "denali-tour-detail",
      testMatch: /tour-detail-catalog-aggregation\.spec\.ts/,
      use: { baseURL: `http://denali.localhost:${port}` },
      metadata: { ownerPhone: "+989121000001", tenantSlug: "denali" },
    },
  ],
  webServer: process.env.PW_NO_WEB_SERVER
    ? undefined
    : {
        command: "node .next/standalone/apps/web/server.js",
        cwd: __dirname,
        url: `http://denali.localhost:${port}`,
        reuseExistingServer: process.env.CI ? false : true,
        timeout: 180_000,
        env: {
          ...process.env,
          HOSTNAME: "0.0.0.0",
          PORT: port,
          NEXT_PUBLIC_TENANT_ROOT_DOMAIN: "localhost",
          NEXT_PUBLIC_API_DYNAMIC_ORIGIN: "true",
          NEXT_PUBLIC_API_PORT: "3001",
          NEXT_PUBLIC_DENALI_SIX_TAB_WIZARD: "1",
        },
      },
  reporter: [["list"]],
});

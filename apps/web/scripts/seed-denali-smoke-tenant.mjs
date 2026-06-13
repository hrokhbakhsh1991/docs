#!/usr/bin/env node
/**
 * Seeds Phase 6.6 denali smoke tenant (workspace_type=denali).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dbUrl = process.env.DATABASE_URL_ADMIN?.trim() || process.env.DATABASE_URL?.trim() || "";

if (!dbUrl) {
  console.error("seed-denali-smoke-tenant: DATABASE_URL or DATABASE_URL_ADMIN required");
  process.exit(1);
}

const seed = spawnSync(
  "pnpm",
  [
    "--filter",
    "@apps/api",
    "exec",
    "node",
    "--import",
    "tsx",
    "-e",
    `
    import { ProvisioningService } from "./src/internal/provisioning.service.ts";
    import { seedDenaliOperatorIdentity } from "./scripts/seed-denali-operator-identity.ts";
    import { seedDenaliFullWizardTemplate } from "./src/settings/seed-denali-full-wizard-template.ts";
    const row = await new ProvisioningService().seedDenaliSmokeTenant();
    await seedDenaliOperatorIdentity();
    await seedDenaliFullWizardTemplate(row.id);
    console.log(JSON.stringify(row));
  `,
  ],
  {
    cwd: path.join(repoRoot, "apps/api"),
    env: { ...process.env, DATABASE_URL: dbUrl, NODE_ENV: "development" },
    stdio: "inherit",
  }
);

process.exit(seed.status ?? 1);

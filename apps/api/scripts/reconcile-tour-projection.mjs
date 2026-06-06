#!/usr/bin/env node
/**
 * DEC-088 — scan tour projection drift for a tenant.
 * @see docs/phase-5/appendices/outbox-projection-reconcile.md
 *
 * Usage:
 *   pnpm run reconcile:tour-projection -- --tenant=<uuid> [--limit=100]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readArg(name) {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
  }
  return undefined;
}

const tenantId = readArg("tenant");
const limitRaw = readArg("limit") ?? "100";
const limit = Number.parseInt(limitRaw, 10);

if (!tenantId) {
  console.error("reconcile:tour-projection: --tenant=<uuid> required");
  process.exit(1);
}

const script = `
import { reconcileTourProjectionsForTenant } from "./src/outbox/reconcile-tour-projection.ts";
import { disconnectPrisma } from "./src/db/prisma.ts";

const result = await reconcileTourProjectionsForTenant(${JSON.stringify(tenantId)}, ${Number.isFinite(limit) ? limit : 100});
console.log(JSON.stringify(result));
await disconnectPrisma();
`;

const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

#!/usr/bin/env node
/**
 * DEC-086 / Phase 3.17 — replay terminal failed outbox rows for a tenant.
 * Prefer HTTP dry-run + confirm in production; CLI is break-glass.
 *
 * Usage:
 *   pnpm run outbox:replay-failed -- --tenant=<uuid> [--id=<uuid>] [--apply]
 * Default is dry-run. Pass --apply to confirm mutate (confirmPhrase REPLAY).
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

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

const tenantId = readArg("tenant");
const outboxId = readArg("id");
const apply = hasFlag("apply");

if (!tenantId) {
  console.error("outbox:replay-failed: --tenant=<uuid> required");
  process.exit(1);
}

const script = `
import { runOutboxProdReplay } from "./src/outbox/outbox-prod-replay.ts";
import { disconnectPrisma } from "./src/db/prisma.ts";

const tenantId = ${JSON.stringify(tenantId)};
const outboxId = ${JSON.stringify(outboxId ?? null)};
const apply = ${apply ? "true" : "false"};

const result = await runOutboxProdReplay(
  outboxId
    ? {
        mode: "single",
        tenantId,
        outboxId,
        dryRun: !apply,
        confirm: apply,
        confirmPhrase: apply ? "REPLAY" : undefined,
        actorUserId: "cli:outbox-replay-failed",
      }
    : {
        mode: "tenant",
        tenantId,
        dryRun: !apply,
        confirm: apply,
        confirmPhrase: apply ? "REPLAY" : undefined,
        actorUserId: "cli:outbox-replay-failed",
      }
);

console.log(JSON.stringify(result, null, 2));
await disconnectPrisma();
`;

const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
